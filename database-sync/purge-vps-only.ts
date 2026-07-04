/**
 * purge-vps-only.ts  —  One-way reconciliation: delete rows on VPS (TARGET) whose
 * primary key does NOT exist in Supabase (SOURCE).
 *
 * Supabase is the source of truth. This script removes VPS-only excess rows so
 * a subsequent delta sync can make both databases equal.
 *
 * Deletes run in reverse FK topological order (children before parents).
 * auth.users / auth.identities are handled after public tables.
 *
 * Credentials: SOURCE_DATABASE_URL / TARGET_DATABASE_URL (env vars only).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'pg';
import {
  makeClient,
  requireEnv,
  listTables,
  getForeignKeys,
  getPrimaryKey,
  getColumns,
  topoSort,
  toSqlLiteral,
  qIdent,
  fqName,
  pkKey,
  initSession,
  RAW_TYPES,
  type FkMeta,
  type GraphNode,
} from './common.js';

const PUBLIC_SCHEMA = 'public';
const AUTH_TABLES = ['identities', 'users']; // delete identities before users
const FETCH_BATCH = 5000;
const DELETE_BATCH = 500;
const REPORT_DIR = join(process.cwd(), 'reports');

interface PurgeTable {
  schema: string;
  name: string;
  fq: string;
  keyCols: string[];
}

interface PurgeResult {
  table: string;
  vpsOnlyCount: number;
  deleted: number;
  note?: string;
}

function resolveKeyCols(pk: string[], columns: { name: string; type: string }[]): string[] | null {
  if (pk.length > 0) return pk;
  const id = columns.find((c) => c.name === 'id');
  if (id && (id.type === 'uuid' || /^(integer|bigint|smallint)$/.test(id.type))) return ['id'];
  return null;
}

async function loadKeySet(client: Client, fq: string, keyCols: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  const colList = keyCols.map(qIdent).join(', ');
  await client.query('BEGIN');
  try {
    await client.query(`DECLARE pcur NO SCROLL CURSOR FOR SELECT ${colList} FROM ${fq}`);
    for (;;) {
      const res = await client.query({
        text: `FETCH ${FETCH_BATCH} FROM pcur`,
        rowMode: 'array',
        types: RAW_TYPES,
      });
      const rows = res.rows as (string | null)[][];
      if (rows.length === 0) break;
      for (const r of rows) set.add(pkKey(r));
    }
    await client.query('CLOSE pcur');
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  }
  return set;
}

/** Decode pkKey back to raw string values (for WHERE clause). */
function decodePkKey(key: string, colCount: number): (string | null)[] {
  const parts = key.split('\u0001');
  return parts.map((p) => (p === '\u0000NULL' ? null : p));
}

async function buildPurgePlan(src: Client, tgt: Client): Promise<{
  tables: PurgeTable[];
  deleteOrder: PurgeTable[];
  fks: FkMeta[];
  skipped: PurgeResult[];
}> {
  const fks = await getForeignKeys(tgt, [PUBLIC_SCHEMA, 'auth']);
  const skipped: PurgeResult[] = [];
  const tables: PurgeTable[] = [];
  const nodes: GraphNode[] = [];

  const addTable = async (schema: string, name: string, inSource: boolean): Promise<void> => {
    const fq = fqName(schema, name);
    const pk = await getPrimaryKey(tgt, schema, name);
    const columns = await getColumns(tgt, schema, name);
    const keyCols = resolveKeyCols(pk, columns);
    if (!keyCols) {
      skipped.push({ table: fq, vpsOnlyCount: 0, deleted: 0, note: 'no key — skipped' });
      return;
    }
    const pt: PurgeTable = { schema, name, fq, keyCols };
    tables.push(pt);
    nodes.push({ key: `${schema}.${name}`, schema, table: name });
  };

  const srcPublic = new Set(await listTables(src, PUBLIC_SCHEMA));
  const tgtPublic = new Set(await listTables(tgt, PUBLIC_SCHEMA));
  const srcAuth = new Set(await listTables(src, 'auth').catch(() => []));
  const tgtAuth = new Set(await listTables(tgt, 'auth').catch(() => []));

  // public tables present in target (source may or may not have them)
  for (const name of [...tgtPublic].sort()) {
    await addTable(PUBLIC_SCHEMA, name, srcPublic.has(name));
  }
  // auth after public
  for (const name of AUTH_TABLES) {
    if (tgtAuth.has(name)) await addTable('auth', name, srcAuth.has(name));
  }

  const { order } = topoSort(nodes, fks);
  const byKey = new Map(tables.map((t) => [`${t.schema}.${t.name}`, t]));
  const deleteOrder = [...order].reverse().map((n) => byKey.get(n.key)!).filter(Boolean);
  return { tables, deleteOrder, fks, skipped };
}

async function countAndDelete(
  src: Client,
  tgt: Client,
  pt: PurgeTable,
  dryRun: boolean,
): Promise<PurgeResult> {
  const srcHasTable = await tableExists(src, pt.schema, pt.name);
  const srcKeys = srcHasTable ? await loadKeySet(src, pt.fq, pt.keyCols) : new Set<string>();
  const tgtKeys = await loadKeySet(tgt, pt.fq, pt.keyCols);

  const vpsOnly: string[] = [];
  for (const k of tgtKeys) {
    if (!srcKeys.has(k)) vpsOnly.push(k);
  }

  if (vpsOnly.length === 0) {
    return { table: pt.fq, vpsOnlyCount: 0, deleted: 0 };
  }

  if (dryRun) {
    return { table: pt.fq, vpsOnlyCount: vpsOnly.length, deleted: 0, note: 'dry-run' };
  }

  const columns = await getColumns(tgt, pt.schema, pt.name);
  const colTypes = new Map(columns.map((c) => [c.name, c.type]));

  let deleted = 0;
  await tgt.query('BEGIN');
  try {
    for (let i = 0; i < vpsOnly.length; i += DELETE_BATCH) {
      const batch = vpsOnly.slice(i, i + DELETE_BATCH);
      for (const key of batch) {
        const vals = decodePkKey(key, pt.keyCols.length);
        const where = pt.keyCols
          .map((col, j) => {
            const v = vals[j];
            if (v === null) return `${qIdent(col)} IS NULL`;
            return `${qIdent(col)} = ${toSqlLiteral(v, colTypes.get(col)!)}`;
          })
          .join(' AND ');
        const res = await tgt.query(`DELETE FROM ${pt.fq} WHERE ${where}`);
        deleted += res.rowCount ?? 0;
      }
    }
    await tgt.query('COMMIT');
  } catch (e) {
    await tgt.query('ROLLBACK').catch(() => undefined);
    throw e;
  }

  return { table: pt.fq, vpsOnlyCount: vpsOnly.length, deleted };
}

async function tableExists(client: Client, schema: string, name: string): Promise<boolean> {
  const res = await client.query(
    `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2 AND c.relkind = 'r'`,
    [schema, name],
  );
  return res.rowCount !== null && res.rowCount > 0;
}

async function main(): Promise<void> {
  const sourceUrl = requireEnv('SOURCE_DATABASE_URL');
  const targetUrl = requireEnv('TARGET_DATABASE_URL');
  const dryRun = process.env.PURGE_DRY_RUN === '1';

  const src = makeClient(sourceUrl, 'SOURCE');
  const tgt = makeClient(targetUrl, 'TARGET');
  await src.connect();
  await tgt.connect();
  await initSession(src);
  await initSession(tgt);

  const results: PurgeResult[] = [];

  try {
    console.error(`Building purge plan${dryRun ? ' (DRY RUN)' : ''} ...`);
    const plan = await buildPurgePlan(src, tgt);
    results.push(...plan.skipped);

    console.log('\n================ PURGE VPS-ONLY ROWS ================');
    console.log('Table                                    VPS-only  Deleted');
    console.log('----------------------------------------------------------');

    for (const pt of plan.deleteOrder) {
      process.stderr.write(`  scanning ${pt.fq} ...\n`);
      const r = await countAndDelete(src, tgt, pt, dryRun);
      results.push(r);
      if (r.vpsOnlyCount > 0 || r.note) {
        console.log(
          `${r.table.padEnd(40)} ${String(r.vpsOnlyCount).padStart(8)} ${String(r.deleted).padStart(9)}` +
            (r.note ? `  (${r.note})` : ''),
        );
      }
    }

    const totalVpsOnly = results.reduce((a, r) => a + r.vpsOnlyCount, 0);
    const totalDeleted = results.reduce((a, r) => a + r.deleted, 0);
    console.log('----------------------------------------------------------');
    console.log(`${'TOTAL'.padEnd(40)} ${String(totalVpsOnly).padStart(8)} ${String(totalDeleted).padStart(9)}`);
    console.log('=======================================================\n');

    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(
      join(REPORT_DIR, 'purge_report.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), dryRun, totalVpsOnly, totalDeleted, results }, null, 2),
      'utf8',
    );
    console.log('Report written to reports/purge_report.json');
  } finally {
    await src.end();
    await tgt.end();
  }
}

main().catch((err) => {
  console.error('\npurge-vps-only FAILED:', err);
  process.exit(1);
});
