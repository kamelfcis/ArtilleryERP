/**
 * generateDelta.ts  —  Steps 3-7 of the delta-sync pipeline.
 *
 * For every syncable table it detects:
 *   - rows present in Supabase but MISSING from the VPS (by primary key), and
 *   - rows that CHANGED (via `updated_at` when the column exists, otherwise a
 *     full-column compare),
 * then writes `delta_sync.sql` containing ONLY:
 *   - INSERT ... ON CONFLICT (pk) DO NOTHING   for missing rows, and
 *   - UPDATE ... WHERE pk = ... [AND updated_at guard]   for changed rows.
 *
 * It NEVER emits DELETE / TRUNCATE / DROP / ALTER. INSERTs are ordered
 * FK-safe (parents before children) via a topological sort of FK dependencies.
 * Serial/identity sequences are repaired at the end with setval().
 *
 * Reads are streamed with a server-side cursor (batched) to support 100k+ rows.
 * Credentials come only from SOURCE_DATABASE_URL / TARGET_DATABASE_URL.
 */
import { createReadStream, createWriteStream, mkdirSync, unlinkSync, type WriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';
import type { Client } from 'pg';
import {
  makeClient,
  requireEnv,
  listTables,
  introspectTable,
  getForeignKeys,
  topoSort,
  toSqlLiteral,
  pkKey,
  qIdent,
  fqName,
  initSession,
  RAW_TYPES,
  type TableMeta,
  type FkMeta,
  type GraphNode,
} from './common.js';

const PUBLIC_SCHEMA = 'public';
// auth tables synced INSERT-ONLY (never updated) so public FKs to auth.users resolve.
const AUTH_TABLES = ['users', 'identities'];
const FETCH_BATCH = 2000; // rows per cursor FETCH
// Rows per multi-row INSERT statement. Set INSERT_BATCH=1 when applying to a
// LIVE target with `psql -v ON_ERROR_ROLLBACK=on`, so that a single row that
// conflicts (unique/FK against target-only data) is skipped individually
// instead of taking its whole batch down with it.
const INSERT_BATCH = Math.max(1, Number(process.env.INSERT_BATCH) || 500);
const OUT_SQL = join(process.cwd(), 'delta_sync.sql');
const REPORT_DIR = join(process.cwd(), 'reports');

interface SyncTable {
  meta: TableMeta;
  mode: 'upsert' | 'insert-only';
  /** effective key columns used to match rows */
  keyCols: string[];
  keyKind: 'pk' | 'uuid-id' | 'int-id';
  hasUpdatedAt: boolean;
}

interface TableResult {
  table: string;
  inserts: number;
  updates: number;
  skippedNoKey: boolean;
  note?: string;
}

function log(msg: string): void {
  console.error(msg);
}

/** Decide which columns identify a row: composite PK, else uuid id, else int id. */
function resolveKey(meta: TableMeta): { keyCols: string[]; keyKind: SyncTable['keyKind'] } | null {
  if (meta.pk.length > 0) return { keyCols: meta.pk, keyKind: 'pk' };
  const idCol = meta.columns.find((c) => c.name === 'id');
  if (idCol) {
    if (idCol.type === 'uuid') return { keyCols: ['id'], keyKind: 'uuid-id' };
    if (/^(integer|bigint|smallint)$/.test(idCol.type)) return { keyCols: ['id'], keyKind: 'int-id' };
  }
  return null;
}

/** Stream all rows of a table via a server-side cursor, invoking cb per batch. */
async function streamRows(
  client: Client,
  fq: string,
  columns: string[],
  onBatch: (rows: (string | null)[][]) => void | Promise<void>,
): Promise<void> {
  const colList = columns.map(qIdent).join(', ');
  const cursorName = 'delta_cur';
  await client.query('BEGIN');
  try {
    await client.query(`DECLARE ${cursorName} NO SCROLL CURSOR FOR SELECT ${colList} FROM ${fq}`);
    for (;;) {
      const res = await client.query({
        text: `FETCH ${FETCH_BATCH} FROM ${cursorName}`,
        rowMode: 'array',
        types: RAW_TYPES,
      });
      const rows = res.rows as (string | null)[][];
      if (rows.length === 0) break;
      await onBatch(rows);
    }
    await client.query(`CLOSE ${cursorName}`);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  }
}

/** Load the target's key -> updated_at (raw) map (light: only key + updated_at). */
async function loadTargetUpdatedMap(
  client: Client,
  st: SyncTable,
): Promise<Map<string, string | null>> {
  const cols = [...st.keyCols, 'updated_at'];
  const map = new Map<string, string | null>();
  await streamRows(client, st.meta.fq, cols, (rows) => {
    for (const r of rows) {
      const key = pkKey(r.slice(0, st.keyCols.length));
      map.set(key, r[st.keyCols.length]);
    }
  });
  return map;
}

/** Load the target's key -> full-row (raw tuple joined) map for full compare. */
async function loadTargetFullMap(
  client: Client,
  st: SyncTable,
  allCols: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const keyIdx = st.keyCols.map((k) => allCols.indexOf(k));
  await streamRows(client, st.meta.fq, allCols, (rows) => {
    for (const r of rows) {
      const key = pkKey(keyIdx.map((i) => r[i]));
      map.set(key, JSON.stringify(r));
    }
  });
  return map;
}

/** Load just the target's key set (for insert-only tables). */
async function loadTargetKeySet(client: Client, st: SyncTable): Promise<Set<string>> {
  const set = new Set<string>();
  await streamRows(client, st.meta.fq, st.keyCols, (rows) => {
    for (const r of rows) set.add(pkKey(r));
  });
  return set;
}

function buildInsertStatement(st: SyncTable, colTypes: Map<string, string>, batch: (string | null)[][]): string {
  const cols = st.meta.columns.map((c) => c.name);
  const colList = cols.map(qIdent).join(', ');
  const valuesSql = batch
    .map(
      (row) =>
        '  (' +
        row.map((v, i) => toSqlLiteral(v, colTypes.get(cols[i])!)).join(', ') +
        ')',
    )
    .join(',\n');
  // Bare ON CONFLICT DO NOTHING (no target) so a row is skipped if it collides
  // on the PK *or* any other unique/exclusion constraint (e.g. a live-target
  // booking already occupying the same unit+date range). This guarantees we
  // never clobber or error on target-only rows.
  return `INSERT INTO ${st.meta.fq} (${colList}) VALUES\n${valuesSql}\nON CONFLICT DO NOTHING;\n`;
}

function buildUpdateStatement(
  st: SyncTable,
  colTypes: Map<string, string>,
  row: (string | null)[],
): string {
  const cols = st.meta.columns.map((c) => c.name);
  const keySet = new Set(st.keyCols);
  const setParts: string[] = [];
  row.forEach((v, i) => {
    const col = cols[i];
    if (keySet.has(col)) return; // never change the key
    setParts.push(`${qIdent(col)} = ${toSqlLiteral(v, colTypes.get(col)!)}`);
  });
  const whereParts = st.keyCols.map((k) => {
    const idx = cols.indexOf(k);
    return `${qIdent(k)} = ${toSqlLiteral(row[idx], colTypes.get(k)!)}`;
  });
  let where = whereParts.join(' AND ');
  if (st.hasUpdatedAt) {
    // Do NOT clobber a target row that is newer than the source row.
    const uIdx = cols.indexOf('updated_at');
    const uType = colTypes.get('updated_at')!;
    const srcTs = toSqlLiteral(row[uIdx], uType);
    where += ` AND (${qIdent('updated_at')} IS NULL OR ${qIdent('updated_at')} <= ${srcTs})`;
  }
  return `UPDATE ${st.meta.fq} SET ${setParts.join(', ')} WHERE ${where};\n`;
}

async function processTable(
  src: Client,
  tgt: Client,
  st: SyncTable,
  out: WriteStream,
): Promise<{ result: TableResult; updates: string[] }> {
  const cols = st.meta.columns.map((c) => c.name);
  const colTypes = new Map(st.meta.columns.map((c) => [c.name, c.type]));
  const keyIdx = st.keyCols.map((k) => cols.indexOf(k));

  let inserts = 0;
  let updates = 0;
  const updateStmts: string[] = [];

  // Build target lookup structures according to mode / detection strategy.
  let targetUpdated: Map<string, string | null> | null = null;
  let targetFull: Map<string, string> | null = null;
  let targetKeys: Set<string>;

  if (st.mode === 'insert-only') {
    targetKeys = await loadTargetKeySet(tgt, st);
  } else if (st.hasUpdatedAt) {
    targetUpdated = await loadTargetUpdatedMap(tgt, st);
    targetKeys = new Set(targetUpdated.keys());
  } else {
    targetFull = await loadTargetFullMap(tgt, st, cols);
    targetKeys = new Set(targetFull.keys());
  }

  let insertBatch: (string | null)[][] = [];
  const flushInserts = () => {
    if (insertBatch.length === 0) return;
    out.write(buildInsertStatement(st, colTypes, insertBatch));
    insertBatch = [];
  };

  await streamRows(src, st.meta.fq, cols, (rows) => {
    for (const row of rows) {
      const key = pkKey(keyIdx.map((i) => row[i]));
      if (!targetKeys.has(key)) {
        insertBatch.push(row);
        inserts++;
        if (insertBatch.length >= INSERT_BATCH) flushInserts();
        continue;
      }
      if (st.mode === 'insert-only') continue; // present already -> leave alone
      if (st.hasUpdatedAt) {
        const tgtTs = targetUpdated!.get(key) ?? null;
        const uIdx = cols.indexOf('updated_at');
        const srcTs = row[uIdx];
        if (srcTs !== tgtTs) {
          updateStmts.push(buildUpdateStatement(st, colTypes, row));
          updates++;
        }
      } else {
        const tgtRow = targetFull!.get(key);
        if (tgtRow !== JSON.stringify(row)) {
          updateStmts.push(buildUpdateStatement(st, colTypes, row));
          updates++;
        }
      }
    }
  });
  flushInserts();

  return { result: { table: st.meta.fq, inserts, updates, skippedNoKey: false }, updates: updateStmts };
}

async function buildSyncPlan(src: Client, tgt: Client): Promise<{
  order: SyncTable[];
  fks: FkMeta[];
  cycles: string[];
  skipped: TableResult[];
}> {
  const fks = await getForeignKeys(src, [PUBLIC_SCHEMA, 'auth']);

  // Which tables exist in BOTH databases?
  const srcPublic = new Set(await listTables(src, PUBLIC_SCHEMA));
  const tgtPublic = new Set(await listTables(tgt, PUBLIC_SCHEMA));
  const srcAuth = new Set(await listTables(src, 'auth').catch(() => []));
  const tgtAuth = new Set(await listTables(tgt, 'auth').catch(() => []));

  const skipped: TableResult[] = [];
  const syncTables: SyncTable[] = [];
  const nodes: GraphNode[] = [];

  const addTable = async (
    schema: string,
    name: string,
    mode: SyncTable['mode'],
  ): Promise<void> => {
    const meta = { ...(await introspectTable(src, schema, name)), fks: [] as FkMeta[] };
    const key = resolveKey(meta);
    if (!key) {
      skipped.push({
        table: meta.fq,
        inserts: 0,
        updates: 0,
        skippedNoKey: true,
        note: 'no primary key / id column — cannot dedupe safely',
      });
      return;
    }
    const hasUpdatedAt = meta.columns.some((c) => c.name === 'updated_at');
    syncTables.push({ meta, mode, keyCols: key.keyCols, keyKind: key.keyKind, hasUpdatedAt });
    nodes.push({ key: `${schema}.${name}`, schema, table: name });
  };

  // auth first (insert-only), only where present in both.
  for (const t of AUTH_TABLES) {
    if (srcAuth.has(t) && tgtAuth.has(t)) await addTable('auth', t, 'insert-only');
  }
  // public tables present in both -> upsert.
  for (const name of [...srcPublic].sort()) {
    if (!tgtPublic.has(name)) {
      skipped.push({
        table: fqName(PUBLIC_SCHEMA, name),
        inserts: 0,
        updates: 0,
        skippedNoKey: false,
        note: 'table missing in TARGET — cannot INSERT without schema (never altering target)',
      });
      continue;
    }
    await addTable(PUBLIC_SCHEMA, name, 'upsert');
  }

  const { order, cycles } = topoSort(nodes, fks);
  const bySortKey = new Map(syncTables.map((s) => [`${s.meta.schema}.${s.meta.name}`, s]));
  const ordered = order.map((n) => bySortKey.get(n.key)!).filter(Boolean);
  return { order: ordered, fks, cycles, skipped };
}

async function main(): Promise<void> {
  const sourceUrl = requireEnv('SOURCE_DATABASE_URL');
  const targetUrl = requireEnv('TARGET_DATABASE_URL');

  const src = makeClient(sourceUrl, 'SOURCE');
  const tgt = makeClient(targetUrl, 'TARGET');
  await src.connect();
  await tgt.connect();
  await initSession(src);
  await initSession(tgt);

  try {
    log('Building sync plan (FK-safe topological order) ...');
    const plan = await buildSyncPlan(src, tgt);
    log(`Tables to sync: ${plan.order.length}; skipped: ${plan.skipped.length}`);
    if (plan.cycles.length) log(`WARNING: FK cycle(s) detected & broken: ${plan.cycles.join(', ')}`);

    mkdirSync(REPORT_DIR, { recursive: true });

    // The body (INSERT/UPDATE/setval) is written to a temp file first so we can
    // learn which tables are actually touched, then wrap ONLY those with
    // DISABLE/ENABLE TRIGGER USER in the final file. Streaming through a temp
    // file keeps memory flat for 100k+ rows.
    const bodyPath = OUT_SQL + '.body';
    const body = createWriteStream(bodyPath, { encoding: 'utf8' });

    const results: TableResult[] = [...plan.skipped];
    const allUpdates: string[] = [];

    // Phase 1: INSERTs, FK-safe order.
    body.write('-- ---------------- INSERT missing rows (FK-safe order) ----------------\n\n');
    for (const st of plan.order) {
      body.write(`-- ${st.meta.fq}  (key: ${st.keyCols.join(',')} [${st.keyKind}], mode: ${st.mode})\n`);
      const { result, updates } = await processTable(src, tgt, st, body);
      results.push(result);
      allUpdates.push(...updates);
      body.write('\n');
      log(`  ${st.meta.fq}: +${result.inserts} inserts, ~${result.updates} updates`);
    }

    // Phase 2: UPDATEs (after all inserts so referenced rows exist).
    body.write('\n-- ---------------- UPDATE changed rows ----------------\n\n');
    for (const u of allUpdates) body.write(u);

    // Phase 3: sequence repair.
    body.write('\n-- ---------------- Sequence repair (serial/identity) ----------------\n\n');
    let seqCount = 0;
    for (const st of plan.order) {
      for (const s of st.meta.serials) {
        body.write(
          `SELECT setval('${s.sequence.replace(/'/g, "''")}', ` +
            `(SELECT COALESCE(MAX(${qIdent(s.column)}), 1) FROM ${st.meta.fq}), true);\n`,
        );
        seqCount++;
      }
    }
    await new Promise<void>((resolve, reject) => {
      body.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });

    // Tables actually modified (need their user-triggers suppressed), topo order.
    const resultByFq = new Map(results.map((r) => [r.table, r]));
    const touched = plan.order.filter((st) => {
      const r = resultByFq.get(st.meta.fq);
      return r && (r.inserts > 0 || r.updates > 0);
    });

    // Assemble the final transactional file.
    const out = createWriteStream(OUT_SQL, { encoding: 'utf8' });
    const header = [
      '-- =====================================================================',
      '-- delta_sync.sql  —  generated by generateDelta.ts',
      `-- Generated: ${new Date().toISOString()}`,
      '-- SOURCE: Supabase (source of truth)   TARGET: VPS artillery_erp_staging',
      '--',
      '-- Contains ONLY INSERT (missing rows) and UPDATE (changed rows).',
      '-- NEVER deletes, truncates, drops or alters schema (see trigger note).',
      '-- INSERTs are ordered FK-safe (parents before children).',
      '--',
      '-- Trigger handling: the LIVE target carries business-logic triggers',
      '-- (e.g. no-double-booking), audit triggers, and updated_at triggers.',
      '-- To load Supabase (source of truth) faithfully and without side effects,',
      '-- USER triggers on the touched tables are DISABLEd for the duration of',
      '-- this transaction and ENABLEd again before COMMIT (net-zero; auto-reverts',
      '-- on ROLLBACK). This is done by the table OWNER (artillery_app); FK and',
      '-- CHECK constraints stay fully ENFORCED (only USER triggers are paused).',
      '--',
      '-- APPLY (two supported modes, both fully transactional BEGIN..COMMIT):',
      '--',
      '--  A) STRICT / all-or-nothing (any error rolls the WHOLE file back):',
      '--       psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f delta_sync.sql',
      '--',
      '--  B) RESILIENT (recommended for a LIVE target): skip only the individual',
      '--     rows that conflict with target-only data (unique/FK), commit the',
      '--     rest. Generate with INSERT_BATCH=1 so skips are per-row:',
      '--       psql "$TARGET_DATABASE_URL" -v ON_ERROR_ROLLBACK=on -f delta_sync.sql',
      '--     (ON_ERROR_ROLLBACK wraps each statement in an implicit SAVEPOINT;',
      '--      a failing row is rolled back to its savepoint and the load continues.',
      '--      Re-run verifySync.ts afterwards to see anything left unsynced.)',
      '-- =====================================================================',
      '',
      'BEGIN;',
      '',
      "-- Fail fast instead of blocking the live site if a table lock is contended.",
      "SET lock_timeout = '30s';",
      '',
      '-- Defer any DEFERRABLE FK constraints so intra-batch ordering is forgiving.',
      'SET CONSTRAINTS ALL DEFERRED;',
      '',
      '-- Pause USER triggers on touched tables (FK/CHECK stay enforced).',
      ...touched.map((st) => `ALTER TABLE ${st.meta.fq} DISABLE TRIGGER USER;`),
      '',
    ].join('\n');
    out.write(header);

    await pipeline(createReadStream(bodyPath, { encoding: 'utf8' }), out, { end: false });

    const footer = [
      '',
      '-- Re-enable USER triggers on touched tables.',
      ...[...touched].reverse().map((st) => `ALTER TABLE ${st.meta.fq} ENABLE TRIGGER USER;`),
      '',
      'COMMIT;',
      '',
    ].join('\n');
    out.write(footer);
    await new Promise<void>((resolve, reject) => {
      out.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
    try {
      unlinkSync(bodyPath);
    } catch {
      /* best-effort temp cleanup */
    }

    const totalInserts = results.reduce((a, r) => a + r.inserts, 0);
    const totalUpdates = results.reduce((a, r) => a + r.updates, 0);

    // Console summary
    console.log('\n================ DELTA SUMMARY ================');
    console.log('Table                                    Inserts   Updates');
    console.log('----------------------------------------------------------');
    for (const r of results) {
      if (r.skippedNoKey || r.note) continue;
      console.log(`${r.table.padEnd(40)} ${String(r.inserts).padStart(8)} ${String(r.updates).padStart(9)}`);
    }
    console.log('----------------------------------------------------------');
    console.log(`${'TOTAL'.padEnd(40)} ${String(totalInserts).padStart(8)} ${String(totalUpdates).padStart(9)}`);
    console.log(`Sequence-repair statements: ${seqCount}`);
    if (results.some((r) => r.note)) {
      console.log('\nSkipped / notes:');
      for (const r of results.filter((x) => x.note)) console.log(`  - ${r.table}: ${r.note}`);
    }
    console.log(`\ndelta_sync.sql written to ${OUT_SQL}`);
    console.log('================================================\n');

    const { writeFileSync } = await import('node:fs');
    writeFileSync(
      join(REPORT_DIR, 'delta_summary.json'),
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          totalInserts,
          totalUpdates,
          sequenceRepairs: seqCount,
          cycles: plan.cycles,
          tables: results,
        },
        null,
        2,
      ),
      'utf8',
    );
  } finally {
    await src.end();
    await tgt.end();
  }
}

main().catch((err) => {
  console.error('\ngenerateDelta FAILED:', err);
  process.exit(1);
});
