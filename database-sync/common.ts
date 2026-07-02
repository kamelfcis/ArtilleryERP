/**
 * Shared utilities for the Artillery ERP delta-sync toolkit.
 *
 * Connection strings are ALWAYS read from environment variables:
 *   SOURCE_DATABASE_URL  -> Supabase (source of truth)
 *   TARGET_DATABASE_URL  -> VPS PostgreSQL (artillery_erp_staging)
 *
 * Nothing here hardcodes credentials.
 */
import { Client, type ClientConfig, type QueryArrayConfig } from 'pg';

/**
 * A pg "types" object whose parsers are the identity function. This makes the
 * driver return the *raw text* representation Postgres produces for every
 * column (or JS null for SQL NULL). Emitting those raw strings back with an
 * explicit `::type` cast is the most faithful, version-independent way to move
 * values between a PG17 (Supabase) source and a PG18 (VPS) target: timestamps,
 * numerics, json, arrays, enums and bytea all round-trip exactly.
 */
export const RAW_TYPES = {
  getTypeParser: () => (val: unknown) => val,
} as unknown as QueryArrayConfig['types'];

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`\nERROR: required environment variable ${name} is not set.`);
    console.error('See README.md — export SOURCE_DATABASE_URL and TARGET_DATABASE_URL first.\n');
    process.exit(1);
  }
  return v.trim();
}

/**
 * Build a pg Client, enabling TLS for Supabase / any sslmode=require URL.
 *
 * We strip ssl-related query params from the connection string and set the
 * `ssl` option ourselves. Newer pg versions treat `sslmode=require` in the URL
 * as `verify-full` (rejecting Supabase's chain), so we normalize to encrypted-
 * but-not-cert-verified, which is what a pooled connection over the public
 * internet needs here.
 */
export function makeClient(connectionString: string, label: string): Client {
  const lower = connectionString.toLowerCase();
  let wantsSsl =
    lower.includes('supabase.com') ||
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify') ||
    lower.includes('sslmode=prefer');

  let cleaned = connectionString;
  try {
    const u = new URL(connectionString);
    const sslmode = u.searchParams.get('sslmode');
    if (sslmode && sslmode !== 'disable') wantsSsl = true;
    if (sslmode === 'disable') wantsSsl = false;
    for (const p of ['sslmode', 'ssl', 'uselibpqcompat', 'sslrootcert', 'sslcert', 'sslkey']) {
      u.searchParams.delete(p);
    }
    cleaned = u.toString();
  } catch {
    // Non-URL connection string form; leave as-is.
  }

  const cfg: ClientConfig = {
    connectionString: cleaned,
    connectionTimeoutMillis: 30_000,
    statement_timeout: 0,
    application_name: `artillery-delta-sync (${label})`,
  };
  if (wantsSsl) cfg.ssl = { rejectUnauthorized: false };
  return new Client(cfg);
}

/**
 * Normalize per-session output formatting so that IDENTICAL rows produce
 * IDENTICAL text on BOTH servers. Without this, a source and target that hold
 * the same data still disagree on the raw text of `timestamptz` (session time
 * zone), floats, bytea and intervals — which would flag every row as "changed"
 * and generate a flood of spurious UPDATEs. Must run right after connect() on
 * every connection used for value comparison.
 */
export async function initSession(client: Client): Promise<void> {
  await client.query("SET TIME ZONE 'UTC'");
  await client.query("SET datestyle = 'ISO, MDY'");
  await client.query('SET extra_float_digits = 3');
  await client.query("SET bytea_output = 'hex'");
  await client.query("SET intervalstyle = 'postgres'");
}

// ----------------------------- introspection -----------------------------

export interface ColumnMeta {
  name: string;
  num: number;
  /** SQL type expression from format_type(), safe to use directly as a cast. */
  type: string;
  notNull: boolean;
}

export interface FkMeta {
  name: string;
  childSchema: string;
  childTable: string;
  childColumns: string[];
  parentSchema: string;
  parentTable: string;
  parentColumns: string[];
}

export interface UniqueMeta {
  name: string;
  columns: string[];
}

export interface IndexMeta {
  name: string;
  def: string;
}

export interface SerialColMeta {
  column: string;
  sequence: string;
}

export interface TableMeta {
  schema: string;
  name: string;
  /** Quoted, schema-qualified: "public"."reservations" */
  fq: string;
  columns: ColumnMeta[];
  pk: string[];
  uniques: UniqueMeta[];
  indexes: IndexMeta[];
  fks: FkMeta[];
  serials: SerialColMeta[];
  rowCount: number;
}

export function qIdent(id: string): string {
  return '"' + id.replace(/"/g, '""') + '"';
}

export function fqName(schema: string, name: string): string {
  return `${qIdent(schema)}.${qIdent(name)}`;
}

/**
 * Parse a PostgreSQL array text literal (e.g. `{a,b,"c,d"}`) into a string[].
 * Needed because array_agg() inside a scalar subquery comes back to node-pg as
 * a raw string (unrecognized OID) rather than a parsed array.
 */
export function parsePgArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value === null || value === undefined) return [];
  const s = String(value);
  if (!(s.startsWith('{') && s.endsWith('}'))) return [s];
  const inner = s.slice(1, -1);
  if (inner.length === 0) return [];
  const out: string[] = [];
  let i = 0;
  while (i < inner.length) {
    let elem = '';
    if (inner[i] === '"') {
      i++;
      while (i < inner.length) {
        const ch = inner[i];
        if (ch === '\\') {
          elem += inner[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (ch === '"') {
          i++;
          break;
        }
        elem += ch;
        i++;
      }
    } else {
      while (i < inner.length && inner[i] !== ',') {
        elem += inner[i];
        i++;
      }
    }
    out.push(elem);
    if (inner[i] === ',') i++;
  }
  return out;
}

export async function listTables(client: Client, schema: string): Promise<string[]> {
  const res = await client.query(
    `SELECT c.relname AS name
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relkind = 'r'
      ORDER BY c.relname`,
    [schema],
  );
  return res.rows.map((r) => r.name as string);
}

export async function getColumns(client: Client, schema: string, table: string): Promise<ColumnMeta[]> {
  const res = await client.query(
    `SELECT a.attname AS name,
            a.attnum  AS num,
            format_type(a.atttypid, a.atttypmod) AS type,
            a.attnotnull AS notnull
       FROM pg_attribute a
      WHERE a.attrelid = format('%I.%I', $1::text, $2::text)::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [schema, table],
  );
  return res.rows.map((r) => ({
    name: r.name as string,
    num: Number(r.num),
    type: r.type as string,
    notNull: r.notnull as boolean,
  }));
}

export async function getPrimaryKey(client: Client, schema: string, table: string): Promise<string[]> {
  const res = await client.query(
    `SELECT a.attname AS name
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
      WHERE i.indrelid = format('%I.%I', $1::text, $2::text)::regclass
        AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)`,
    [schema, table],
  );
  return res.rows.map((r) => r.name as string);
}

export async function getUniques(client: Client, schema: string, table: string): Promise<UniqueMeta[]> {
  const res = await client.query(
    `SELECT c.conname AS name,
            array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS cols
       FROM pg_constraint c
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = format('%I.%I', $1::text, $2::text)::regclass
        AND c.contype = 'u'
      GROUP BY c.conname
      ORDER BY c.conname`,
    [schema, table],
  );
  return res.rows.map((r) => ({ name: r.name as string, columns: parsePgArray(r.cols) }));
}

export async function getIndexes(client: Client, schema: string, table: string): Promise<IndexMeta[]> {
  const res = await client.query(
    `SELECT indexname AS name, indexdef AS def
       FROM pg_indexes
      WHERE schemaname = $1 AND tablename = $2
      ORDER BY indexname`,
    [schema, table],
  );
  return res.rows.map((r) => ({ name: r.name as string, def: r.def as string }));
}

export async function getSerialColumns(
  client: Client,
  schema: string,
  table: string,
): Promise<SerialColMeta[]> {
  const res = await client.query(
    `SELECT a.attname AS col,
            pg_get_serial_sequence(format('%I.%I', $1::text, $2::text), a.attname) AS seq
       FROM pg_attribute a
      WHERE a.attrelid = format('%I.%I', $1::text, $2::text)::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped`,
    [schema, table],
  );
  return res.rows
    .filter((r) => r.seq)
    .map((r) => ({ column: r.col as string, sequence: r.seq as string }));
}

/** All foreign keys whose child table lives in one of the given schemas. */
export async function getForeignKeys(client: Client, schemas: string[]): Promise<FkMeta[]> {
  const res = await client.query(
    `SELECT con.conname AS name,
            ns.nspname   AS child_schema,
            cl.relname   AS child_table,
            fns.nspname  AS parent_schema,
            fcl.relname  AS parent_table,
            (SELECT array_agg(att.attname ORDER BY ck.ord)
               FROM unnest(con.conkey) WITH ORDINALITY ck(attnum, ord)
               JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ck.attnum
            ) AS child_cols,
            (SELECT array_agg(att.attname ORDER BY fk.ord)
               FROM unnest(con.confkey) WITH ORDINALITY fk(attnum, ord)
               JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = fk.attnum
            ) AS parent_cols
       FROM pg_constraint con
       JOIN pg_class cl      ON cl.oid = con.conrelid
       JOIN pg_namespace ns  ON ns.oid = cl.relnamespace
       JOIN pg_class fcl     ON fcl.oid = con.confrelid
       JOIN pg_namespace fns ON fns.oid = fcl.relnamespace
      WHERE con.contype = 'f'
        AND ns.nspname = ANY ($1)`,
    [schemas],
  );
  return res.rows.map((r) => ({
    name: r.name as string,
    childSchema: r.child_schema as string,
    childTable: r.child_table as string,
    childColumns: parsePgArray(r.child_cols),
    parentSchema: r.parent_schema as string,
    parentTable: r.parent_table as string,
    parentColumns: parsePgArray(r.parent_cols),
  }));
}

export async function getRowCount(client: Client, schema: string, table: string): Promise<number> {
  const res = await client.query(`SELECT count(*)::bigint AS c FROM ${fqName(schema, table)}`);
  return Number(res.rows[0].c);
}

/** Full introspection of a single table (excluding FKs, which are fetched in bulk). */
export async function introspectTable(
  client: Client,
  schema: string,
  table: string,
): Promise<Omit<TableMeta, 'fks'>> {
  // A single pg Client cannot run concurrent queries, so these run in sequence.
  const columns = await getColumns(client, schema, table);
  const pk = await getPrimaryKey(client, schema, table);
  const uniques = await getUniques(client, schema, table);
  const indexes = await getIndexes(client, schema, table);
  const serials = await getSerialColumns(client, schema, table);
  const rowCount = await getRowCount(client, schema, table);
  return { schema, name: table, fq: fqName(schema, table), columns, pk, uniques, indexes, serials, rowCount };
}

// ----------------------------- serialization -----------------------------

/**
 * Turn a raw column value (already a string in Postgres' text output form, or
 * null) into a SQL literal with an explicit cast to the column's type.
 * Standard-conforming strings are assumed (the default in modern PostgreSQL),
 * so only the single quote needs doubling.
 */
export function toSqlLiteral(raw: string | null, sqlType: string): string {
  if (raw === null || raw === undefined) return 'NULL';
  const escaped = String(raw).replace(/'/g, "''");
  return `'${escaped}'::${sqlType}`;
}

/** Build a stable string key for a (possibly composite) primary key tuple. */
export function pkKey(values: (string | null)[]): string {
  // \u0001 is a control char that cannot appear in normal identifiers/values here.
  return values.map((v) => (v === null ? '\u0000NULL' : v)).join('\u0001');
}

// ----------------------------- topological sort --------------------------

export interface GraphNode {
  key: string; // schema.table
  schema: string;
  table: string;
}

/**
 * Topologically sort tables so that referenced (parent) tables come before
 * referencing (child) tables — FK-safe insert order. Self-references are
 * ignored for ordering. Cycles across tables are broken deterministically and
 * reported via the returned `cycles` list.
 */
export function topoSort(
  nodes: GraphNode[],
  fks: FkMeta[],
): { order: GraphNode[]; cycles: string[] } {
  const keyOf = (s: string, t: string) => `${s}.${t}`;
  const present = new Map<string, GraphNode>();
  for (const n of nodes) present.set(n.key, n);

  const deps = new Map<string, Set<string>>(); // node -> set of parents it depends on
  for (const n of nodes) deps.set(n.key, new Set());

  for (const fk of fks) {
    const child = keyOf(fk.childSchema, fk.childTable);
    const parent = keyOf(fk.parentSchema, fk.parentTable);
    if (child === parent) continue; // self-ref
    if (!present.has(child) || !present.has(parent)) continue;
    deps.get(child)!.add(parent);
  }

  const order: GraphNode[] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycles: string[] = [];

  const sortedKeys = [...present.keys()].sort();
  const visit = (key: string): void => {
    if (visited.has(key)) return;
    if (inStack.has(key)) {
      cycles.push(key);
      return;
    }
    inStack.add(key);
    for (const parent of [...deps.get(key)!].sort()) visit(parent);
    inStack.delete(key);
    visited.add(key);
    order.push(present.get(key)!);
  };
  for (const key of sortedKeys) visit(key);

  return { order, cycles: [...new Set(cycles)] };
}

export function nowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
