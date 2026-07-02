/**
 * compare_databases.ts  —  Steps 1 & 2 of the delta-sync pipeline.
 *
 * Introspects BOTH databases (SOURCE = Supabase, TARGET = VPS) and produces:
 *   1. A schema comparison  (tables present/missing, per-table column / PK /
 *      unique / index / FK differences).
 *   2. A row-count comparison report:  Table | Rows Supabase | Rows VPS | Diff.
 *
 * Output goes to stdout (human readable) AND to files:
 *   reports/compare_report.md   and   reports/compare_report.json
 *
 * No credentials are hardcoded — set SOURCE_DATABASE_URL / TARGET_DATABASE_URL.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  makeClient,
  requireEnv,
  listTables,
  introspectTable,
  getForeignKeys,
  initSession,
  type TableMeta,
  type FkMeta,
} from './common.js';

const SCHEMAS = ['public']; // primary focus; auth handled separately/cautiously
const REPORT_DIR = join(process.cwd(), 'reports');

interface DbSnapshot {
  label: string;
  tables: Map<string, TableMeta>; // key: schema.table
  fks: FkMeta[];
}

async function snapshot(url: string, label: string): Promise<DbSnapshot> {
  const client = makeClient(url, label);
  await client.connect();
  await initSession(client);
  try {
    const version = (await client.query('SHOW server_version')).rows[0].server_version as string;
    console.error(`[${label}] connected — PostgreSQL ${version}`);
    const fks = await getForeignKeys(client, SCHEMAS);
    const tables = new Map<string, TableMeta>();
    for (const schema of SCHEMAS) {
      const names = await listTables(client, schema);
      for (const name of names) {
        const base = await introspectTable(client, schema, name);
        const key = `${schema}.${name}`;
        tables.set(key, {
          ...base,
          fks: fks.filter((f) => f.childSchema === schema && f.childTable === name),
        });
      }
    }
    return { label, tables, fks };
  } finally {
    await client.end();
  }
}

interface TableDiff {
  table: string;
  inSource: boolean;
  inTarget: boolean;
  rowsSource: number | null;
  rowsTarget: number | null;
  diff: number | null; // source - target
  columnDiffs: string[];
  pkDiff: string | null;
  uniqueDiff: string | null;
  indexDiff: string | null;
  fkDiff: string | null;
}

function compare(src: DbSnapshot, tgt: DbSnapshot): TableDiff[] {
  const keys = new Set<string>([...src.tables.keys(), ...tgt.tables.keys()]);
  const diffs: TableDiff[] = [];

  for (const key of [...keys].sort()) {
    const s = src.tables.get(key);
    const t = tgt.tables.get(key);
    const d: TableDiff = {
      table: key,
      inSource: !!s,
      inTarget: !!t,
      rowsSource: s ? s.rowCount : null,
      rowsTarget: t ? t.rowCount : null,
      diff: s && t ? s.rowCount - t.rowCount : null,
      columnDiffs: [],
      pkDiff: null,
      uniqueDiff: null,
      indexDiff: null,
      fkDiff: null,
    };

    if (s && t) {
      const sCols = new Map(s.columns.map((c) => [c.name, c]));
      const tCols = new Map(t.columns.map((c) => [c.name, c]));
      for (const [name, c] of sCols) {
        const tc = tCols.get(name);
        if (!tc) d.columnDiffs.push(`- column '${name}' (${c.type}) only in SOURCE`);
        else if (tc.type !== c.type)
          d.columnDiffs.push(`~ column '${name}' type differs: source=${c.type} target=${tc.type}`);
      }
      for (const [name, c] of tCols) {
        if (!sCols.has(name)) d.columnDiffs.push(`+ column '${name}' (${c.type}) only in TARGET`);
      }
      if (s.pk.join(',') !== t.pk.join(','))
        d.pkDiff = `source PK [${s.pk.join(', ')}] vs target PK [${t.pk.join(', ')}]`;

      const uSet = (m: TableMeta) => new Set(m.uniques.map((u) => u.columns.join(',')));
      const su = uSet(s);
      const tu = uSet(t);
      const uOnlyS = [...su].filter((x) => !tu.has(x));
      const uOnlyT = [...tu].filter((x) => !su.has(x));
      if (uOnlyS.length || uOnlyT.length)
        d.uniqueDiff = `uniques only-in-source: [${uOnlyS.join(' | ')}]; only-in-target: [${uOnlyT.join(' | ')}]`;

      const iSet = (m: TableMeta) => new Set(m.indexes.map((i) => i.name));
      const si = iSet(s);
      const ti = iSet(t);
      const iOnlyS = [...si].filter((x) => !ti.has(x));
      const iOnlyT = [...ti].filter((x) => !si.has(x));
      if (iOnlyS.length || iOnlyT.length)
        d.indexDiff = `indexes only-in-source: [${iOnlyS.join(', ')}]; only-in-target: [${iOnlyT.join(', ')}]`;

      const fkSet = (m: TableMeta) =>
        new Set(
          m.fks.map(
            (f) =>
              `${f.childColumns.join(',')}->${f.parentSchema}.${f.parentTable}(${f.parentColumns.join(',')})`,
          ),
        );
      const sf = fkSet(s);
      const tf = fkSet(t);
      const fOnlyS = [...sf].filter((x) => !tf.has(x));
      const fOnlyT = [...tf].filter((x) => !sf.has(x));
      if (fOnlyS.length || fOnlyT.length)
        d.fkDiff = `FKs only-in-source: [${fOnlyS.join(' ; ')}]; only-in-target: [${fOnlyT.join(' ; ')}]`;
    }
    diffs.push(d);
  }
  return diffs;
}

function renderMarkdown(diffs: TableDiff[]): string {
  const lines: string[] = [];
  lines.push('# Database Comparison Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('SOURCE = Supabase (source of truth)  ·  TARGET = VPS artillery_erp_staging');
  lines.push('');

  lines.push('## Row-count comparison');
  lines.push('');
  lines.push('| Table | Rows Supabase | Rows VPS | Difference | Status |');
  lines.push('|-------|--------------:|---------:|-----------:|--------|');
  let totS = 0;
  let totT = 0;
  for (const d of diffs) {
    const s = d.rowsSource;
    const t = d.rowsTarget;
    if (s !== null) totS += s;
    if (t !== null) totT += t;
    let status = 'match';
    if (!d.inTarget) status = 'MISSING IN TARGET';
    else if (!d.inSource) status = 'target-only';
    else if (d.diff !== null && d.diff > 0) status = `**+${d.diff} to sync**`;
    else if (d.diff !== null && d.diff < 0) status = `target ahead (${d.diff})`;
    lines.push(
      `| ${d.table} | ${s ?? '—'} | ${t ?? '—'} | ${d.diff === null ? '—' : d.diff} | ${status} |`,
    );
  }
  lines.push(`| **TOTAL** | **${totS}** | **${totT}** | **${totS - totT}** | |`);
  lines.push('');

  lines.push('## Schema differences');
  lines.push('');
  const withSchema = diffs.filter(
    (d) =>
      !d.inSource ||
      !d.inTarget ||
      d.columnDiffs.length ||
      d.pkDiff ||
      d.uniqueDiff ||
      d.indexDiff ||
      d.fkDiff,
  );
  if (withSchema.length === 0) {
    lines.push('_No schema differences detected across compared tables._');
  } else {
    for (const d of withSchema) {
      lines.push(`### ${d.table}`);
      if (!d.inTarget) lines.push('- **Table missing in TARGET** (cannot INSERT without schema).');
      if (!d.inSource) lines.push('- Table exists only in TARGET (target-only, left untouched).');
      for (const c of d.columnDiffs) lines.push(`- ${c}`);
      if (d.pkDiff) lines.push(`- PK: ${d.pkDiff}`);
      if (d.uniqueDiff) lines.push(`- ${d.uniqueDiff}`);
      if (d.indexDiff) lines.push(`- ${d.indexDiff}`);
      if (d.fkDiff) lines.push(`- ${d.fkDiff}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

function renderConsole(diffs: TableDiff[]): void {
  console.log('\n================ ROW-COUNT COMPARISON ================');
  const pad = (v: string | number, n: number) => String(v).padStart(n);
  const padE = (v: string, n: number) => v.padEnd(n);
  const nameW = Math.max(20, ...diffs.map((d) => d.table.length));
  console.log(
    `${padE('Table', nameW)}  ${pad('Supabase', 10)}  ${pad('VPS', 10)}  ${pad('Diff', 8)}  Status`,
  );
  console.log('-'.repeat(nameW + 46));
  let totS = 0;
  let totT = 0;
  for (const d of diffs) {
    if (d.rowsSource !== null) totS += d.rowsSource;
    if (d.rowsTarget !== null) totT += d.rowsTarget;
    let status = 'match';
    if (!d.inTarget) status = 'MISSING IN TARGET';
    else if (!d.inSource) status = 'target-only';
    else if (d.diff && d.diff > 0) status = `>>> +${d.diff} to sync`;
    else if (d.diff && d.diff < 0) status = `target ahead (${d.diff})`;
    console.log(
      `${padE(d.table, nameW)}  ${pad(d.rowsSource ?? '-', 10)}  ${pad(d.rowsTarget ?? '-', 10)}  ${pad(
        d.diff ?? '-',
        8,
      )}  ${status}`,
    );
  }
  console.log('-'.repeat(nameW + 46));
  console.log(`${padE('TOTAL', nameW)}  ${pad(totS, 10)}  ${pad(totT, 10)}  ${pad(totS - totT, 8)}`);
  console.log('=====================================================\n');
}

async function main(): Promise<void> {
  const sourceUrl = requireEnv('SOURCE_DATABASE_URL');
  const targetUrl = requireEnv('TARGET_DATABASE_URL');

  console.error('Introspecting SOURCE (Supabase) and TARGET (VPS) ...');
  const [src, tgt] = await Promise.all([
    snapshot(sourceUrl, 'SOURCE'),
    snapshot(targetUrl, 'TARGET'),
  ]);

  const diffs = compare(src, tgt);
  renderConsole(diffs);

  const missingInTarget = diffs.filter((d) => d.inSource && !d.inTarget).map((d) => d.table);
  const targetOnly = diffs.filter((d) => !d.inSource && d.inTarget).map((d) => d.table);
  const needSync = diffs.filter((d) => d.diff !== null && d.diff > 0);

  console.log(`Tables to sync (source ahead): ${needSync.length}`);
  if (missingInTarget.length) console.log(`Tables MISSING in target: ${missingInTarget.join(', ')}`);
  if (targetOnly.length) console.log(`Target-only tables (left untouched): ${targetOnly.join(', ')}`);

  mkdirSync(REPORT_DIR, { recursive: true });
  const md = renderMarkdown(diffs);
  writeFileSync(join(REPORT_DIR, 'compare_report.md'), md, 'utf8');
  writeFileSync(
    join(REPORT_DIR, 'compare_report.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), diffs }, null, 2),
    'utf8',
  );
  console.log(`\nReports written to reports/compare_report.md and reports/compare_report.json`);
}

main().catch((err) => {
  console.error('\ncompare_databases FAILED:', err);
  process.exit(1);
});
