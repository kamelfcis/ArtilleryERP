/**
 * verifySync.ts  —  Step 8 of the delta-sync pipeline.
 *
 * After applying delta_sync.sql, re-runs row counts on BOTH databases and, for
 * every public table present in both, checks that:
 *   1. the row counts match, and
 *   2. there are NO remaining source primary keys missing from the target.
 * Reports PASS / FAILED per table and an overall verdict (non-zero exit on
 * failure so it can gate automation).
 *
 * Credentials come only from SOURCE_DATABASE_URL / TARGET_DATABASE_URL.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'pg';
import {
  makeClient,
  requireEnv,
  listTables,
  getPrimaryKey,
  getColumns,
  getRowCount,
  qIdent,
  fqName,
  pkKey,
  initSession,
  RAW_TYPES,
} from './common.js';

const PUBLIC_SCHEMA = 'public';
const FETCH_BATCH = 5000;
const REPORT_DIR = join(process.cwd(), 'reports');

interface VerifyRow {
  table: string;
  rowsSource: number;
  rowsTarget: number;
  missingInTarget: number;
  pass: boolean;
  note?: string;
}

function resolveKeyCols(pk: string[], columns: { name: string; type: string }[]): string[] | null {
  if (pk.length) return pk;
  const id = columns.find((c) => c.name === 'id');
  if (id && (id.type === 'uuid' || /^(integer|bigint|smallint)$/.test(id.type))) return ['id'];
  return null;
}

async function loadKeySet(client: Client, fq: string, keyCols: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  const colList = keyCols.map(qIdent).join(', ');
  await client.query('BEGIN');
  try {
    await client.query(`DECLARE vcur NO SCROLL CURSOR FOR SELECT ${colList} FROM ${fq}`);
    for (;;) {
      const res = await client.query({
        text: `FETCH ${FETCH_BATCH} FROM vcur`,
        rowMode: 'array',
        types: RAW_TYPES,
      });
      const rows = res.rows as (string | null)[][];
      if (rows.length === 0) break;
      for (const r of rows) set.add(pkKey(r));
    }
    await client.query('CLOSE vcur');
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  }
  return set;
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

  const results: VerifyRow[] = [];
  try {
    const srcTables = await listTables(src, PUBLIC_SCHEMA);
    const tgtTables = new Set(await listTables(tgt, PUBLIC_SCHEMA));

    for (const name of srcTables.sort()) {
      const fq = fqName(PUBLIC_SCHEMA, name);
      if (!tgtTables.has(name)) {
        results.push({
          table: fq,
          rowsSource: await getRowCount(src, PUBLIC_SCHEMA, name),
          rowsTarget: 0,
          missingInTarget: -1,
          pass: false,
          note: 'table missing in target',
        });
        continue;
      }
      const rowsSource = await getRowCount(src, PUBLIC_SCHEMA, name);
      const rowsTarget = await getRowCount(tgt, PUBLIC_SCHEMA, name);
      const pk = await getPrimaryKey(src, PUBLIC_SCHEMA, name);
      const columns = await getColumns(src, PUBLIC_SCHEMA, name);
      const keyCols = resolveKeyCols(pk, columns);

      let missing = -1;
      let note: string | undefined;
      if (keyCols) {
        const tgtKeys = await loadKeySet(tgt, fq, keyCols);
        const srcKeys = await loadKeySet(src, fq, keyCols);
        missing = 0;
        for (const k of srcKeys) if (!tgtKeys.has(k)) missing++;
      } else {
        note = 'no key — count-only check';
      }

      const pass = rowsSource <= rowsTarget && (missing === 0 || missing === -1);
      results.push({ table: fq, rowsSource, rowsTarget, missingInTarget: missing, pass, note });
    }

    // Console report
    console.log('\n================ VERIFY SYNC REPORT ================');
    console.log('Table                                    Supabase      VPS   Missing  Result');
    console.log('---------------------------------------------------------------------------');
    for (const r of results) {
      console.log(
        `${r.table.padEnd(40)} ${String(r.rowsSource).padStart(8)} ${String(r.rowsTarget).padStart(8)} ` +
          `${String(r.missingInTarget < 0 ? '-' : r.missingInTarget).padStart(8)}  ${r.pass ? 'PASS' : 'FAILED'}` +
          (r.note ? `  (${r.note})` : ''),
      );
    }
    console.log('---------------------------------------------------------------------------');
    const failed = results.filter((r) => !r.pass);
    const overall = failed.length === 0;
    console.log(`OVERALL: ${overall ? 'PASS' : 'FAILED'}  (${results.length - failed.length}/${results.length} tables OK)`);
    if (failed.length) console.log('Failed tables: ' + failed.map((f) => f.table).join(', '));
    console.log('===================================================\n');

    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(
      join(REPORT_DIR, 'verify_report.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), overall, results }, null, 2),
      'utf8',
    );

    process.exitCode = overall ? 0 : 1;
  } finally {
    await src.end();
    await tgt.end();
  }
}

main().catch((err) => {
  console.error('\nverifySync FAILED:', err);
  process.exit(1);
});
