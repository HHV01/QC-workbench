/**
 * Rebuild web/rd-data.js from the public Google Sheet tabs.
 *
 * This is only used to refresh the checked-in fallback seed. Production sync
 * uses the Sheets API (sync.mjs) and never depends on the gviz endpoint.
 *
 * Usage: node scripts/build-seed.mjs
 */
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildSnapshot} from '../lib/sheet.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1f1vOMxt6fHW-auk2xxiq5ruejH6PXK_gWs1jexW7wyc';
const GIDS = {matrix: '1260333280', summary: '218355462'};

async function readGviz(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${gid}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không tải được gid ${gid}: HTTP ${response.status}`);
  const text = await response.text();
  const data = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const table = data.table;
  const header = (table.cols ?? []).map(column => column?.label ?? '');
  const rows = (table.rows ?? []).map(row => (row.c ?? []).map(cell => cell?.v ?? null));
  return [header, ...rows];
}

const [matrixRows, summaryRows] = await Promise.all([readGviz(GIDS.matrix), readGviz(GIDS.summary)]);
const now = new Date();
const snapshot = buildSnapshot({
  matrixRows,
  summaryRows,
  syncedAt: now.toISOString(),
  date: new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(now),
  source: {
    sheetId: SHEET_ID,
    tabs: ['Ma_tran_Automation', 'Tong_hop_du_an'],
    gids: {matrix: Number(GIDS.matrix), summary: Number(GIDS.summary)},
    fallback: 'gviz',
  },
  seed: true,
});

await writeFile(
  path.join(root, 'web/rd-data.js'),
  'const rdSeed = ' + JSON.stringify(snapshot) + ';\n',
  'utf8',
);

console.log(`Đã ghi web/rd-data.js: ${snapshot.projects.length} dự án, ${snapshot.groups.length} nhóm, ${snapshot.dataIssues.length} cảnh báo.`);
