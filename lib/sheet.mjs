/**
 * Pure parsing / normalization for the QC Workbench Google Sheet.
 *
 * The sheet is maintained by hand, so every value is treated as untrusted:
 * numbers may be Vietnamese formatted ("5.045", "97,5%"), empty cells may
 * contain dashes, merged cells leave child rows blank, and a footer contains
 * legends instead of data. Nothing here reads from the network.
 */

export const SCHEMA_VERSION = 2;
export const DEFAULT_TARGET = {min: 80, max: 90, label: '80–90%'};

const PLACEHOLDER_RE = /^(?:[-–—]+|--+|n\/?a|na|chưa có dữ liệu|chưa cập nhật|null|undefined|none)$/i;

/** Remove diacritics, lower-case and collapse whitespace. */
export function foldText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Key used to match project names across the two tabs. */
export function nameKey(value) {
  return foldText(value).replace(/[^a-z0-9]+/g, ' ').trim();
}

/** True for "", "-", "--", "–", "—", "Chưa có dữ liệu"... */
export function isPlaceholder(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return false;
  if (typeof value !== 'string') return true;
  const text = value.replace(/\u00a0/g, ' ').trim();
  return text === '' || PLACEHOLDER_RE.test(text);
}

/** Text field: trimmed string, or null when empty/placeholder. */
export function cleanText(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  const text = String(value).replace(/\u00a0/g, ' ').trim();
  return text === '' || PLACEHOLDER_RE.test(text) ? null : text;
}

/**
 * Parse a number that may use Vietnamese formatting.
 * "." is a thousands separator when every group is exactly three digits
 * ("1.460" -> 1460, "5.045" -> 5045); otherwise it is a decimal point.
 * "," is always the decimal separator ("97,5" -> 97.5).
 */
export function parseVnNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.replace(/\u00a0/g, ' ').trim();
  if (!text || PLACEHOLDER_RE.test(text)) return null;

  let sign = 1;
  if (/^\(.*\)$/.test(text)) {
    sign = -1;
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    sign = -1;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }

  text = text.replace(/[%\s]/g, '').replace(/[^\d.,]/g, '');
  if (!/\d/.test(text)) return null;

  const dots = (text.match(/\./g) || []).length;
  const commas = (text.match(/,/g) || []).length;

  if (dots && commas) {
    // "1.234,56" (VN) vs "1,234.56" (US): the separator closest to the end
    // is the decimal separator.
    if (text.indexOf('.') < text.indexOf(',')) text = text.replace(/\./g, '').replace(',', '.');
    else text = text.replace(/,/g, '');
  } else if (commas > 1) {
    // 1,234,567 -> thousands separators
    text = text.replace(/,/g, '');
  } else if (commas === 1) {
    // decimal comma
    text = text.replace(',', '.');
  } else if (dots > 1) {
    if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
      text = text.replace(/\./g, '');
    } else {
      const parts = text.split('.');
      const last = parts.pop();
      text = parts.join('') + '.' + last;
    }
  } else if (dots === 1 && /^\d{1,3}\.\d{3}$/.test(text)) {
    // "1.460" / "5.045" are Vietnamese thousands separators.
    // Any other single dot ("97.5", "0.9607") stays a decimal point.
    text = text.replace('.', '');
  }

  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return sign * number;
}

/**
 * Parse a percentage. Google Sheets returns either a ratio (0.975) when the
 * UNFORMATTED_VALUE of a percent-formatted cell is read, or text ("97,5%").
 * ratioHint=true converts 0 < value <= 1 to 0..100.
 */
export function parsePercent(value, {ratioHint = true} = {}) {
  if (value === null || value === undefined || isPlaceholder(value)) return null;
  const hasPercent = typeof value === 'string' && /[%％]/.test(value);
  const number = parseVnNumber(value);
  if (number === null) return null;
  if (ratioHint && !hasPercent && number > 0 && number <= 1) return round(number * 100, 4);
  return number;
}

/** "80-90%" -> {min:80,max:90,label:"80–90%"} */
export function parseTarget(value) {
  if (isPlaceholder(value)) return null;
  const matches = String(value).match(/\d+(?:[.,]\d+)?/g);
  if (!matches?.length) return null;
  let numbers = matches.map(parseVnNumber).filter(number => number !== null && Number.isFinite(number));
  if (!numbers.length) return null;
  // Summary tab stores 0.8 for 80%.
  numbers = numbers.map(number => (number > 0 && number <= 1 ? number * 100 : number));
  const min = numbers[0];
  const max = numbers.length > 1 ? numbers[numbers.length - 1] : min;
  return {min, max, label: `${formatNumber(min)}–${formatNumber(max)}%`};
}

/** "Loan, Ý" -> ["Loan","Ý"], de-duplicated accent-insensitively. */
export function splitPeople(value) {
  if (value === null || value === undefined) return [];
  const values = Array.isArray(value) ? value : String(value).split(/[,;\n]+|\s+\/\s+/);
  const seen = new Set();
  const people = [];
  for (const raw of values) {
    const name = cleanText(raw)?.replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const key = foldText(name);
    if (seen.has(key)) continue;
    seen.add(key);
    people.push(name);
  }
  return people;
}

export function formatNumber(value, maximumFractionDigits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('vi-VN', {maximumFractionDigits});
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function findColumn(header, predicate, fallback) {
  const index = header.findIndex(cell => predicate(foldText(cell)));
  return index >= 0 ? index : fallback;
}

function detectHeader(header) {
  if (!Array.isArray(header)) return false;
  const text = header.map(foldText);
  return text.some(cell => cell.includes('ten du an'))
    && text.some(cell => cell.includes('tong case'))
    && text.some(cell => cell.includes('da auto'));
}

/** Map the Ma_tran_Automation header, tolerating title prefixes. */
export function mapMatrixHeader(header) {
  const has = (needle) => header.some(cell => foldText(cell).includes(needle));
  if (!has('ten du an') || !has('tong case') || !has('da auto')) {
    throw new Error('Không nhận diện được tiêu đề tab Ma_tran_Automation');
  }
  return {
    stt: findColumn(header, text => text === 'stt' || text.startsWith('stt'), 0),
    category: findColumn(header, text => text.includes('phan loai'), 1),
    product: findColumn(header, text => text.startsWith('san pham'), 2),
    code: findColumn(header, text => text.includes('ma du an'), 3),
    name: findColumn(header, text => text.includes('ten du an'), 4),
    version: findColumn(header, text => text.includes('version'), 5),
    qcMain: findColumn(header, text => text.startsWith('qc chinh'), 6),
    qcSub: findColumn(header, text => text.startsWith('qc phu') && !text.includes('trach'), 7),
    priority: findColumn(header, text => text.includes('uu tien') && text.includes('muc'), 8),
    total: findColumn(header, text => text.includes('tong case'), 9),
    auto: findColumn(header, text => text.includes('da auto'), 10),
    manual: findColumn(header, text => text.includes('con manual'), 11),
    autoPercent: findColumn(header, text => text.includes('% automation'), 12),
    manualPercent: findColumn(header, text => text.includes('% manual'), 13),
    target: findColumn(header, text => text.includes('muc tieu') && !text.includes('con thieu'), 14),
    gap: findColumn(header, text => text.includes('con thieu') && text.includes('muc tieu'), 15),
    week1: findColumn(header, text => text.includes('coverage tuan 1'), 16),
    week2: findColumn(header, text => text.includes('coverage tuan 2'), 17),
    week3: findColumn(header, text => text.includes('coverage tuan 3'), 18),
    week4: findColumn(header, text => text.includes('coverage tuan 4'), 19),
    assessment: findColumn(header, text => text.includes('danh gia muc tieu'), 20),
    bugManual: findColumn(header, text => text.includes('bug manual'), 21),
    bugAuto: findColumn(header, text => text.includes('bug automation'), 22),
    note: findColumn(header, text => text.includes('ghi chu') || text.includes('viec tiep theo'), 23),
  };
}

function isMilestoneRow(row) {
  if (!Array.isArray(row)) return false;
  return row.some(cell => typeof cell === 'string' && /^[≥>]=?\s*\d+%/.test(cell.trim()));
}

export function isLegendRow(own) {
  const hasIdentity = own.stt !== null || own.version !== null || own.qcMain !== null
    || own.qcSub !== null || own.category !== null || own.product !== null || own.code !== null;
  const hasMetrics = own.total != null || own.auto != null || own.manualSheet != null;
  if (hasIdentity || hasMetrics) return false;
  const name = foldText(own.name);
  if (!name) return true;
  return /^(on production|trong \d+ thang|ghi chu|chu giai|legend)/.test(name);
}

function toNumber(value) {
  return parseVnNumber(value);
}

/**
 * Convert raw matrix rows (including title/header/milestone/footer) into
 * project records. Fills down merged identity columns, never metrics.
 */
export function parseMatrix(rawRows) {
  const headerIndex = rawRows.findIndex(detectHeader);
  if (headerIndex < 0) throw new Error('Không tìm thấy dòng tiêu đề tab Ma_tran_Automation');
  const columns = mapMatrixHeader(rawRows[headerIndex]);

  const ownRows = [];
  for (let index = headerIndex + 1; index < rawRows.length; index++) {
    const row = Array.isArray(rawRows[index]) ? rawRows[index] : [];
    if (!row.some(cell => cleanText(cell) !== null)) continue;
    if (isMilestoneRow(row)) continue;
    const own = {
      sourceRow: index + 1,
      stt: cleanText(row[columns.stt]),
      category: cleanText(row[columns.category]),
      product: cleanText(row[columns.product]),
      code: cleanText(row[columns.code]),
      name: cleanText(row[columns.name]),
      version: cleanText(row[columns.version]),
      qcMain: cleanText(row[columns.qcMain]),
      qcSub: cleanText(row[columns.qcSub]),
      priority: cleanText(row[columns.priority]),
      total: toNumber(row[columns.total]),
      auto: toNumber(row[columns.auto]),
      manualSheet: toNumber(row[columns.manual]),
      autoPercentSheet: parsePercent(row[columns.autoPercent]),
      manualPercentSheet: parsePercent(row[columns.manualPercent]),
      target: parseTarget(row[columns.target]),
      targetText: cleanText(row[columns.target]),
      gapSheet: toNumber(row[columns.gap]),
      coverage: {
        week1: parsePercent(row[columns.week1]),
        week2: parsePercent(row[columns.week2]),
        week3: parsePercent(row[columns.week3]),
        week4: parsePercent(row[columns.week4]),
      },
      assessmentSheet: cleanText(row[columns.assessment]),
      bugManual: toNumber(row[columns.bugManual]),
      bugAuto: toNumber(row[columns.bugAuto]),
      note: cleanText(row[columns.note]),
    };
    if (isLegendRow(own)) continue;
    ownRows.push(own);
  }

  if (!ownRows.length) throw new Error('Tab Ma_tran_Automation không có dòng dự án nào');

  // Merged cells: identity/QC columns are only present on the first row of a
  // product block. Metrics are intentionally not filled down.
  const identityColumns = ['category', 'product'];
  const childColumns = ['stt', 'qcMain', 'qcSub'];
  const last = {};
  const projects = ownRows.map(own => {
    const filled = {...own};
    // Category/product are often left blank on a row that continues the
    // product above it, even when that row has its own STT (e.g. BecaFace).
    for (const column of identityColumns) {
      if (own[column] !== null) last[column] = own[column];
      filled[column] = own[column] ?? last[column] ?? null;
    }
    // A blank code only continues the block above when the row is a child or
    // when its product is also blank (BecaFace/QUAN TRẮC). Twinhub has its own
    // product but no code: it must stay null, not borrow Datalogger's code.
    if (own.code !== null) last.code = own.code;
    filled.code = own.code ?? (own.stt === null || own.product === null ? last.code ?? null : null);
    // STT and QC are only inherited by true merged/child rows (blank STT).
    // A row with its own STT and an empty QC field means "not assigned".
    const isChild = own.stt === null;
    for (const column of childColumns) {
      if (own[column] !== null) last[column] = own[column];
      filled[column] = own[column] ?? (isChild ? last[column] ?? null : null);
    }
    filled.ownStt = own.stt;
    filled.ownProduct = own.product;
    filled.ownCode = own.code;
    return finalizeProject(filled);
  });

  return projects;
}

function finalizeProject(project) {
  const total = project.total;
  const auto = project.auto;
  const manual = total !== null && auto !== null && total >= auto ? total - auto : null;
  let autoPercent = null;
  if (total !== null && auto !== null && total > 0) autoPercent = round((auto * 100) / total, 2);
  else if (total === 0 && auto === 0) autoPercent = 0;
  const manualPercent = autoPercent === null ? null : round(100 - autoPercent, 2);

  const target = project.target ?? null;
  const min = target?.min ?? DEFAULT_TARGET.min;
  const gap = total !== null && auto !== null && total > 0
    ? Math.max(0, Math.ceil((min * total) / 100) - auto)
    : null;

  let assessment = {code: 'unknown', label: 'Chưa có dữ liệu'};
  if (autoPercent !== null) {
    assessment = autoPercent >= min
      ? {code: 'met', label: 'Đạt'}
      : {code: 'below', label: 'Chưa đạt'};
  }

  return {
    ...project,
    id: `p-${project.sourceRow}`,
    manual,
    autoPercent,
    manualPercent,
    gap,
    target: target ?? DEFAULT_TARGET,
    targetSource: project.targetText ?? null,
    assessment,
    hasData: total !== null && auto !== null,
    hasTotal: total !== null,
    hasAuto: auto !== null,
    qcSub: splitPeople(project.qcSub),
  };
}

/** Build a lookup from the Tong_hop_du_an tab (environment only, no secrets). */
export function parseSummary(rawRows) {
  const headerIndex = rawRows.findIndex(row => {
    const text = (row || []).map(foldText);
    return text.some(cell => cell === 'du an') && text.some(cell => cell.includes('qc phu trach'));
  });
  if (headerIndex < 0) return new Map();
  const header = rawRows[headerIndex];
  const nameIndex = findColumn(header, text => text === 'du an', 1);
  const qcIndex = findColumn(header, text => text.includes('qc phu trach'), 2);
  const environmentIndex = findColumn(header, text => text === 'moi truong', 3);
  const systemLinkIndex = findColumn(header, text => text === 'link he thong', -1);
  const testcaseIndex = findColumn(header, text => text === 'link testcase', -1);
  const psdIndex = findColumn(header, text => text === 'link psd', -1);
  const relatedDocsIndex = findColumn(header, text => text.includes('tai lieu lien quan'), -1);
  const swaggerIndex = findColumn(header, text => text.includes('swagger'), -1);
  const statusIndex = findColumn(header, text => text === 'muc uu tien' || text.includes('trang thai'), 12);
  const noteIndex = findColumn(header, text => text.includes('hanh dong') || text.includes('pham vi tiep theo'), -1);

  const map = new Map();
  for (const row of rawRows.slice(headerIndex + 1)) {
    if (!Array.isArray(row)) continue;
    const name = cleanText(row[nameIndex]);
    if (!name) continue;
    const key = nameKey(name);
    if (!key) continue;
    const entry = {
      name,
      qc: splitPeople(row[qcIndex]),
      environment: cleanText(row[environmentIndex]),
      systemLink: systemLinkIndex >= 0 ? cleanText(row[systemLinkIndex]) : null,
      testcaseLink: testcaseIndex >= 0 ? cleanText(row[testcaseIndex]) : null,
      psdLink: psdIndex >= 0 ? cleanText(row[psdIndex]) : null,
      relatedDocs: relatedDocsIndex >= 0 ? cleanText(row[relatedDocsIndex]) : null,
      swaggerLink: swaggerIndex >= 0 ? cleanText(row[swaggerIndex]) : null,
      status: cleanText(row[statusIndex]),
      note: noteIndex >= 0 ? cleanText(row[noteIndex]) : null,
    };
    if (!map.has(key)) map.set(key, entry);
  }
  return map;
}

export function groupProjects(projects) {
  const groups = [];
  const byKey = new Map();
  for (const project of projects) {
    const product = project.product ?? project.name;
    const key = nameKey(product) + '|' + foldText(project.category);
    let group = byKey.get(key);
    if (!group) {
      group = {
        id: `g-${groups.length + 1}`,
        key,
        product,
        category: project.category,
        projects: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    project.groupId = group.id;
    group.projects.push(project);
  }
  return groups;
}

/** Enrich matrix projects with the environment from Tong_hop_du_an. */
export function enrichProjects(projects, summaryMap) {
  const groupDefaults = new Map();
  for (const project of projects) {
    const key = nameKey(project.name);
    const productKey = nameKey(project.product ?? project.name);
    const summary = summaryMap.get(key) ?? summaryMap.get(productKey);
    project.environment = summary?.environment ?? null;
    project.systemLink = summary?.systemLink ?? null;
    project.testcaseLink = summary?.testcaseLink ?? null;
    project.psdLink = summary?.psdLink ?? null;
    project.relatedDocs = summary?.relatedDocs ?? null;
    project.swaggerLink = summary?.swaggerLink ?? null;
    project.summaryStatus = summary?.status ?? null;
    project.qcFromSummary = summary?.qc ?? [];
    if (!groupDefaults.has(project.groupId)) {
      groupDefaults.set(project.groupId, summary?.environment ?? null);
    }
  }
  for (const project of projects) {
    if (!project.environment) project.environment = groupDefaults.get(project.groupId) ?? null;
  }
  return projects;
}

function projectWarning(project, code, message) {
  project.warnings ??= [];
  project.warnings.push({code, message});
}

/** Recompute metrics, compare with the sheet, and attach warnings. */
export function auditProjects(projects) {
  const issues = [];
  const byMetrics = new Map();
  const byCode = new Map();

  for (const project of projects) {
    if (project.hasTotal && !project.hasAuto) {
      projectWarning(project, 'missing-auto', 'Có Tổng case (N) nhưng thiếu Case đã auto (A)');
    }
    if (!project.hasTotal && project.hasAuto) {
      projectWarning(project, 'missing-total', 'Có Case đã auto (A) nhưng thiếu Tổng case (N)');
    }
    if (!project.hasTotal && !project.hasAuto) {
      projectWarning(project, 'no-data', 'Chưa có Tổng case (N) và Case đã auto (A)');
    }
    if (project.manualSheet !== null && project.manual !== null && project.manualSheet !== project.manual) {
      projectWarning(project, 'manual-mismatch',
        `Cột Case còn manual ghi ${formatNumber(project.manualSheet)} nhưng N−A = ${formatNumber(project.manual)}`);
    }
    if (project.autoPercentSheet !== null && project.autoPercent !== null
      && Math.abs(project.autoPercentSheet - project.autoPercent) > 0.15) {
      projectWarning(project, 'percent-mismatch',
        `% Automation ghi ${formatNumber(project.autoPercentSheet)}% nhưng A/N = ${formatNumber(project.autoPercent)}%`);
    }
    if (project.gapSheet !== null && project.gap !== null && project.gapSheet !== project.gap) {
      projectWarning(project, 'gap-mismatch',
        `Case còn thiếu ghi ${formatNumber(project.gapSheet)} nhưng tính theo mốc 80% là ${formatNumber(project.gap)}`);
    }
    if (project.hasTotal && project.hasAuto) {
      const key = `${project.total}|${project.auto}`;
      if (!byMetrics.has(key)) byMetrics.set(key, []);
      byMetrics.get(key).push(project);
    }
    if (project.code) {
      if (!byCode.has(project.code)) byCode.set(project.code, []);
      byCode.get(project.code).push(project);
    }
  }

  // Identical N/A rows are suspicious (possible copy/paste), but never "fixed".
  for (const [key, list] of byMetrics) {
    const products = new Set(list.map(project => nameKey(project.product ?? project.name)));
    if (list.length < 2 || products.size < 2) continue;
    const [total, auto] = key.split('|');
    for (const project of list) {
      const others = list.filter(other => other !== project).map(other => other.name).join(', ');
      projectWarning(project, 'duplicate-metrics',
        `Số liệu ${formatNumber(Number(total))}/${formatNumber(Number(auto))} trùng với ${others} — kiểm tra copy nhầm`);
    }
  }

  for (const [code, list] of byCode) {
    const products = new Set(list.map(project => nameKey(project.product ?? project.name)));
    if (products.size < 2) continue;
    for (const project of list) {
      projectWarning(project, 'shared-code',
        `Mã dự án ${code} dùng chung cho ${products.size} dự án — không dùng làm khóa chính`);
    }
  }

  // STT gaps are a data-entry smell (8 -> 10 in the current sheet).
  const numbered = projects
    .filter(project => project.ownStt !== null && /^\d+$/.test(project.ownStt))
    .map(project => ({project, stt: Number(project.ownStt)}));
  for (let index = 1; index < numbered.length; index++) {
    const previous = numbered[index - 1];
    const current = numbered[index];
    if (current.stt - previous.stt > 1) {
      projectWarning(current.project, 'stt-gap',
        `STT nhảy từ ${previous.stt} sang ${current.stt} — có thể thiếu dòng`);
    }
  }

  for (const project of projects) {
    for (const warning of project.warnings ?? []) {
      issues.push({
        id: `${project.id}-${warning.code}`,
        code: warning.code,
        severity: warning.code === 'no-data' ? 'info' : 'warning',
        projectId: project.id,
        projectName: project.name,
        product: project.product,
        message: warning.message,
      });
    }
  }
  return issues;
}

export function computeStats(projects) {
  const measured = projects.filter(project => project.total > 0 && project.auto !== null && project.auto <= project.total);
  const totalCases = measured.reduce((sum, project) => sum + project.total, 0);
  const autoCases = measured.reduce((sum, project) => sum + project.auto, 0);
  return {
    projectCount: projects.length,
    measuredCount: measured.length,
    missingCount: projects.length - measured.length,
    totalCases,
    autoCases,
    weightedPercent: totalCases ? round((autoCases * 100) / totalCases, 2) : null,
  };
}

/** Main transform used by the server and by tests. */
export function buildSnapshot({matrixRows, summaryRows = [], syncedAt = null, date = null, source = null, seed = false}) {
  const projects = parseMatrix(matrixRows);
  const summaryMap = parseSummary(summaryRows);
  const groups = groupProjects(projects);
  enrichProjects(projects, summaryMap);
  for (const group of groups) {
    group.environment = group.projects.find(project => project.environment)?.environment ?? null;
    group.category = group.projects.find(project => project.category)?.category ?? group.category;
  }
  const dataIssues = auditProjects(projects);
  const stats = computeStats(projects);
  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    syncedAt,
    date,
    source,
    seed,
    projects,
    groups,
    dataIssues,
    stats,
  };
  return publicSnapshot(snapshot);
}

/** Whitelist exactly what the browser needs. Never expose links/accounts/roles. */
export function publicSnapshot(snapshot) {
  const projects = (snapshot.projects ?? []).map(project => ({
    id: project.id,
    sourceRow: project.sourceRow,
    stt: project.stt,
    category: project.category,
    product: project.product,
    code: project.code,
    name: project.name,
    version: project.version,
    qcMain: project.qcMain,
    qcSub: project.qcSub ?? [],
    priority: project.priority,
    total: project.total,
    auto: project.auto,
    manual: project.manual,
    autoPercent: project.autoPercent,
    manualPercent: project.manualPercent,
    target: project.target,
    targetSource: project.targetSource,
    gap: project.gap,
    coverage: project.coverage,
    assessment: project.assessment,
    bugManual: project.bugManual,
    bugAuto: project.bugAuto,
    note: project.note,
    environment: project.environment,
    systemLink: project.systemLink ?? null,
    testcaseLink: project.testcaseLink ?? null,
    psdLink: project.psdLink ?? null,
    relatedDocs: project.relatedDocs ?? null,
    swaggerLink: project.swaggerLink ?? null,
    groupId: project.groupId,
    hasData: project.hasData,
    hasTotal: project.hasTotal,
    hasAuto: project.hasAuto,
    warnings: project.warnings ?? [],
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    syncedAt: snapshot.syncedAt ?? null,
    date: snapshot.date ?? null,
    source: snapshot.source ?? null,
    seed: Boolean(snapshot.seed),
    projects,
    groups: (snapshot.groups ?? []).map(group => ({
      id: group.id,
      product: group.product,
      category: group.category,
      environment: group.environment ?? null,
      projectIds: group.projectIds ?? (group.projects ?? []).map(project => project.id),
    })),
    dataIssues: snapshot.dataIssues ?? [],
    stats: snapshot.stats ?? computeStats(projects),
  };
}

/** Accept only a cache/seed that matches the current schema and shape. */
export function isValidSnapshot(snapshot) {
  return Boolean(snapshot)
    && snapshot.schemaVersion === SCHEMA_VERSION
    && Array.isArray(snapshot.projects)
    && snapshot.projects.length > 0
    && Array.isArray(snapshot.groups)
    && Array.isArray(snapshot.dataIssues);
}
