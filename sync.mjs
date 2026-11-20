import {GoogleAuth} from 'google-auth-library';
import {
  SCHEMA_VERSION,
  buildSnapshot,
  isValidSnapshot,
  publicSnapshot,
} from './lib/sheet.mjs';

export {SCHEMA_VERSION, isValidSnapshot, publicSnapshot};

export const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1f1vOMxt6fHW-auk2xxiq5ruejH6PXK_gWs1jexW7wyc';
export const GIDS = {matrix: 1260333280, summary: 218355462};
export const TABS = {matrix: 'Ma_tran_Automation', summary: 'Tong_hop_du_an'};

// Read the whole used area; the parser detects the real header row, so the
// sheet can grow and the title/legend rows can change without breaking sync.
export const ranges = [
  `'${TABS.matrix}'!A1:Z1002`,
  `'${TABS.summary}'!A1:AG1002`,
];

const dateFormatter = () => new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
});

/**
 * Read both tabs through the Sheets API using UNFORMATTED_VALUE.
 * That returns real numbers (1460) instead of display strings ("1.460"),
 * which removes the Vietnamese thousands-separator ambiguity at the source.
 */
export async function readSheets() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    : undefined;
  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const client = await auth.getClient();
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SHEET_ID)}/values:batchGet`);
  for (const range of ranges) url.searchParams.append('ranges', range);
  url.searchParams.set('valueRenderOption', 'UNFORMATTED_VALUE');
  url.searchParams.set('dateTimeRenderOption', 'FORMATTED_STRING');
  url.searchParams.set('majorDimension', 'ROWS');

  const {data} = await client.request({url: url.href, timeout: 30000});
  const [matrixRows = [], summaryRows = []] = (data.valueRanges ?? []).map(range => range.values ?? []);
  const now = new Date();
  return buildSnapshot({
    matrixRows,
    summaryRows,
    syncedAt: now.toISOString(),
    date: dateFormatter().format(now),
    source: {
      sheetId: SHEET_ID,
      tabs: [TABS.matrix, TABS.summary],
      gids: GIDS,
      ranges,
      valueRenderOption: 'UNFORMATTED_VALUE',
    },
  });
}
