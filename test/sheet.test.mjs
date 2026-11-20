import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION,
  buildSnapshot,
  isPlaceholder,
  isValidSnapshot,
  parsePercent,
  parseTarget,
  parseVnNumber,
  splitPeople,
} from '../lib/sheet.mjs';

const HEADER = [
  'STT', 'Phân loại dự án', 'Sản phẩm', 'Mã dự án', 'Tên dự án đang triển khai', 'Version triển khai',
  'QC chính', 'QC phụ', 'Mức độ ưu tiên', 'Tổng case (N)', 'Case đã auto (A)', 'Case còn manual (N−A)',
  '% Automation', '% Manual', 'Mục tiêu', 'Case còn thiếu tới mục tiêu',
  'Coverage tuần 1', 'Coverage tuần 2', 'Coverage tuần 3', 'Coverage tuần 4',
  'Đánh giá mục tiêu', 'Bug Manual trên Production', 'Bug Automation trên Production', 'Ghi chú / Việc tiếp theo',
];
const EMPTY = Array(24).fill('');

function row(values) {
  const result = Array(24).fill('');
  for (const [index, value] of Object.entries(values)) result[Number(index)] = value;
  return result;
}

function matrix(dataRows) {
  return [
    row({0: 'MA TRẬN AUTOMATION', 1: 'Phân loại dự án', 4: 'Tên dự án đang triển khai', 9: 'Tỷ lệ Tổng case (N)'}),
    row({16: '≥20%', 17: '≥40%', 18: '≥60%', 19: '≥80%', 20: 'Mốc có thể chỉnh'}),
    [...HEADER],
    row({10: '--', 11: '–', 15: '–', 16: '≥20%', 17: '≥40%', 18: '≥60%', 19: '≥80%'}),
    ...dataRows,
    row({4: 'on production'}),
    row({4: 'Trong 3 tháng gần nhất có cập nhật'}),
  ];
}

const SAMPLE_ROWS = [
  row({0: 12, 1: 'Production', 2: 'BecaWork', 3: 332666, 4: 'Becawork', 5: 'v2.5.0', 6: 'Vũ Thị Ngọc Linh', 7: 'Loan, Ý', 8: 'Cao', 9: 5045, 10: 4847, 11: 198, 12: '96,1%', 13: '3,9%', 14: '80-90%', 15: '0'}),
  row({0: 13, 1: 'Production', 2: 'BecaFSM', 3: 1330607, 4: 'BecaFSM', 5: 'v4.5.0', 6: 'Phạm Hồng Ý', 7: 'Nguyễn Thị Minh Tâm', 8: 'Cao', 9: 2369, 10: 1555, 11: 814, 12: '65,6%', 13: '34,4%', 14: '80-90%', 15: '341'}),
  row({0: 3, 1: 'Core / Platform', 2: 'EnvironmentMonitoring', 3: 1337915, 4: 'Datalogger', 5: 'v0.12.0', 6: 'Ngô Thị Hoài Yên', 7: 'Hồng Cẩm Tú', 8: 'Trung bình', 9: '1.460', 10: '363', 11: '1.097', 12: '24,9%', 13: '75,1%', 14: '80-90%', 15: '–'}),
  row({0: 2, 1: 'Core / Platform', 2: 'BecaROS', 3: 1336160, 4: 'BecaROS-BecaFace', 5: 'v0.6.0', 6: 'Ngô Thị Hoài Yên', 7: '', 8: 'Trung bình', 9: '466', 10: '0', 11: '466', 12: '0,0%', 13: '100,0%', 14: '80-90%', 15: '0'}),
  row({0: 7, 1: 'Core / Platform', 2: 'BecaSCADA', 3: 1330657, 4: 'BecaSCADA cho 11 nhà máy', 5: 'v2.4.1', 6: 'Hồng Cẩm Tú', 7: '', 8: 'Trung bình', 9: '--', 10: '–', 11: '–', 12: '–', 13: '–', 14: '80-90%', 15: '–'}),
];

const SUMMARY = [
  ['Thứ tự', 'Dự án', 'QC phụ trách', 'Môi trường', '', '', '', '', '', 'Account truy cập', 'Vai trò / quyền', 'Điều kiện truy cập', 'Mức ưu tiên'],
  [12, 'Becawork', 'Loan, Linh, Ý', 'Dev', '', '', '', '', '', 'secret', 'admin', '', 'Đang triển khai RD'],
  [13, 'BecaFSM', 'Hồng Ý, Minh Tâm', 'Dev', '', '', '', '', '', 'secret', 'admin', '', 'Đang chạy dự án'],
  [3, 'Datalogger', 'Ngô Thị Hoài Yên, Hồng Cẩm Tú', 'Dev', '', '', '', '', '', 'secret', 'admin', '', 'Đang triển khai RD'],
  [2, 'BecaROS-BecaFace', 'Ngô Thị Hoài Yên', 'Dev', '', '', '', '', '', 'secret', 'admin', '', 'Đang triển khai RD'],
  [7, 'BecaSCADA', 'Hồng Cẩm Tú', 'Dev', '', '', '', '', '', 'secret', 'admin', '', 'Đang triển khai RD'],
];

test('parseVnNumber understands Vietnamese thousands/decimal separators', () => {
  assert.equal(parseVnNumber('5.045'), 5045);
  assert.equal(parseVnNumber('1.460'), 1460);
  assert.equal(parseVnNumber('1.097'), 1097);
  assert.equal(parseVnNumber('97,5'), 97.5);
  assert.equal(parseVnNumber('97,5%'), 97.5);
  assert.equal(parseVnNumber('12.5'), 12.5);
  assert.equal(parseVnNumber('1.234.567'), 1234567);
  assert.equal(parseVnNumber('1,234.56'), 1234.56);
  assert.equal(parseVnNumber('(1.460)'), -1460);
  assert.equal(parseVnNumber(1460), 1460);
  assert.equal(parseVnNumber(0), 0);
});

test('empty and placeholder cells become null, never zero', () => {
  for (const value of ['', ' ', '--', '–', '—', '-', 'N/A', null, undefined, 'Chưa có dữ liệu']) {
    assert.equal(isPlaceholder(value), true, 'placeholder: ' + String(value));
    assert.equal(parseVnNumber(value), null, 'number: ' + String(value));
    assert.equal(parsePercent(value), null, 'percent: ' + String(value));
  }
  assert.equal(parseVnNumber('0'), 0);
  assert.equal(parsePercent('0,0%'), 0);
  assert.equal(parsePercent(0), 0);
});

test('parsePercent handles ratio values from UNFORMATTED_VALUE and percent text', () => {
  assert.equal(parsePercent(0.9607532210109019), 96.0753);
  assert.equal(parsePercent('96,1%'), 96.1);
  assert.equal(parsePercent('0,0%'), 0);
  assert.equal(parsePercent(0), 0);
  assert.equal(parsePercent('–'), null);
});

test('parseTarget reads "80-90%" and summary ratio 0.8', () => {
  assert.deepEqual(parseTarget('80-90%'), {min: 80, max: 90, label: '80–90%'});
  assert.deepEqual(parseTarget(0.8), {min: 80, max: 80, label: '80–80%'});
  assert.equal(parseTarget('–'), null);
});

test('splitPeople splits, trims and de-duplicates Vietnamese names', () => {
  assert.deepEqual(splitPeople('Loan, Ý'), ['Loan', 'Ý']);
  assert.deepEqual(splitPeople(' Nguyễn Thị Minh Tâm ,  Hoàng Hồng Vân '), ['Nguyễn Thị Minh Tâm', 'Hoàng Hồng Vân']);
  assert.deepEqual(splitPeople('Loan, loan, Loan'), ['Loan']);
  assert.deepEqual(splitPeople(''), []);
  assert.deepEqual(splitPeople(null), []);
  assert.deepEqual(splitPeople(['Loan', 'Ý']), ['Loan', 'Ý']);
});

test('buildSnapshot keeps the five acceptance rows correct', () => {
  const snapshot = buildSnapshot({matrixRows: matrix(SAMPLE_ROWS), summaryRows: SUMMARY});
  assert.equal(snapshot.schemaVersion, SCHEMA_VERSION);
  const byName = new Map(snapshot.projects.map(project => [project.name, project]));

  const becaWork = byName.get('Becawork');
  assert.equal(becaWork.total, 5045);
  assert.equal(becaWork.auto, 4847);
  assert.equal(becaWork.manual, 198);
  assert.equal(becaWork.autoPercent, 96.08);
  assert.equal(becaWork.gap, 0);
  assert.equal(becaWork.assessment.code, 'met');
  assert.deepEqual(becaWork.qcSub, ['Loan', 'Ý']);
  assert.equal(becaWork.environment, 'Dev');

  const becaFsm = byName.get('BecaFSM');
  assert.equal(becaFsm.total, 2369);
  assert.equal(becaFsm.auto, 1555);
  assert.equal(becaFsm.manual, 814);
  assert.equal(becaFsm.autoPercent, 65.64);
  assert.equal(becaFsm.gap, 341);

  const datalogger = byName.get('Datalogger');
  assert.equal(datalogger.total, 1460);
  assert.equal(datalogger.auto, 363);
  assert.equal(datalogger.manual, 1097);
  assert.equal(datalogger.autoPercent, 24.86);

  const becaFace = byName.get('BecaROS-BecaFace');
  assert.equal(becaFace.total, 466);
  assert.equal(becaFace.auto, 0);
  assert.equal(becaFace.manual, 466);
  assert.equal(becaFace.autoPercent, 0);
  assert.equal(becaFace.hasData, true, '0 auto is real data, not missing data');

  const scada = byName.get('BecaSCADA cho 11 nhà máy');
  assert.equal(scada.total, null);
  assert.equal(scada.auto, null);
  assert.equal(scada.autoPercent, null);
  assert.equal(scada.hasData, false);
  assert.equal(scada.assessment.code, 'unknown');
});

test('merged child rows inherit product/code/QC but never inherit N or A', () => {
  const rows = [
    row({0: 22, 1: 'Production', 2: 'Smart Factory (EMS-PCCC-Camera)', 3: '1330745', 4: 'ORION-SmartFactory-BN-GĐ1', 5: 'v1.3.1', 6: 'Hoàng Hồng Vân', 8: '', 9: 1236, 10: '--', 14: '80-90%', 15: '–'}),
    row({0: '', 4: 'ORION-SmartFactory-MP-GĐ2', 5: 'v2.5.3', 14: '80-90%'}),
    row({0: 25, 1: 'Production', 2: 'Becamex-Smart Building', 3: '1330797', 4: 'Smart Building', 5: '1.17.9', 6: 'Hồng Cẩm Tú', 7: 'Hoàng Hồng Vân', 9: '--', 10: '–', 14: '80-90%'}),
    row({0: '', 4: 'Smart Security Building', 5: '1.15.1', 14: '80-90%'}),
    row({0: '', 4: 'Smart Parking', 5: '1.14.1', 14: '80-90%'}),
  ];
  const snapshot = buildSnapshot({matrixRows: matrix(rows)});
  const byName = new Map(snapshot.projects.map(project => [project.name, project]));
  const orion = byName.get('ORION-SmartFactory-MP-GĐ2');
  assert.equal(orion.product, 'Smart Factory (EMS-PCCC-Camera)');
  assert.equal(orion.code, '1330745');
  assert.equal(orion.qcMain, 'Hoàng Hồng Vân');
  assert.equal(orion.total, null, 'child must not inherit parent N');
  assert.equal(orion.auto, null, 'child must not inherit parent A');
  assert.equal(orion.stt, '22');

  const parking = byName.get('Smart Parking');
  assert.equal(parking.product, 'Becamex-Smart Building');
  assert.deepEqual(parking.qcSub, ['Hoàng Hồng Vân']);
  assert.equal(parking.total, null);

  const group = snapshot.groups.find(item => item.product === 'Smart Factory (EMS-PCCC-Camera)');
  assert.equal(group.projectIds.length, 2);
  const building = snapshot.groups.find(item => item.product === 'Becamex-Smart Building');
  assert.equal(building.projectIds.length, 3);
});

test('child rows stay in the parent product group even when their own STT exists', () => {
  const rows = [
    row({0: 1, 1: 'Core / Platform', 2: 'BecaROS', 3: 1336160, 4: 'BecaRos', 5: 'v0.11.0', 6: 'Hoàng Hồng Vân', 9: 562, 10: 548, 14: '80-90%'}),
    row({0: 2, 4: 'BecaROS-BecaFace', 5: 'v0.6.0', 6: 'Ngô Thị Hoài Yên', 9: 466, 10: 0, 14: '80-90%'}),
  ];
  const snapshot = buildSnapshot({matrixRows: matrix(rows)});
  assert.equal(byName(snapshot, 'BecaROS-BecaFace').product, 'BecaROS');
  assert.equal(snapshot.groups.length, 1);
  assert.equal(snapshot.groups[0].projectIds.length, 2);
});

function byName(snapshot, name) {
  return snapshot.projects.find(project => project.name === name);
}

test('IDs are unique even when Mã dự án is shared', () => {
  const rows = [
    row({0: 19, 1: 'Production', 2: 'BECAMEX-SmartIndustrialPark', 3: '1330061', 4: 'BECAMEX-SmartIndustrialPark', 5: 'v2.3.1', 9: '--', 10: '–', 14: '80-90%'}),
    row({0: 24, 1: 'Production', 2: 'Becamex-SmartSecurity', 3: '1330061', 4: 'Smart Security', 5: 'v1.8.0', 9: '--', 10: '–', 14: '80-90%'}),
    row({0: 26, 1: 'Production', 2: 'Becamex-Smart EMS', 3: '1330061', 4: 'Smart EMS', 5: 'v1.8.1', 9: '--', 10: '–', 14: '80-90%'}),
  ];
  const snapshot = buildSnapshot({matrixRows: matrix(rows)});
  const ids = new Set(snapshot.projects.map(project => project.id));
  assert.equal(ids.size, 3);
  assert.ok(snapshot.projects.every(project => project.code === '1330061'));
  assert.ok(snapshot.dataIssues.some(issue => issue.code === 'shared-code'));
});

test('audit flags duplicate metrics, missing A and STT gaps without fixing them', () => {
  const rows = [
    row({0: 8, 1: 'Core / Platform', 2: 'BecaData', 3: 1330587, 4: 'BecaData', 5: 'v1.2.0', 9: '', 10: '--', 14: '80-90%'}),
    row({0: 10, 1: 'Core / Platform', 2: 'Smart Factory & Print-On-Demand', 3: 1599941, 4: 'Smart Factory & Print-On-Demand', 5: 'v0.0.1', 9: '', 10: '--', 14: '80-90%'}),
    row({0: 16, 1: 'Production', 2: 'SHE', 3: 579727, 4: 'SHE', 5: 'v4.0.5', 9: 949, 10: '--', 14: '80-90%'}),
    row({0: 17, 1: 'Production', 2: 'SmartCityForGovernment', 3: 1568797, 4: 'SmartCityForGovernment', 5: 'v1.0.0', 9: 1039, 10: 994, 11: 45, 14: '80-90%'}),
    row({0: 18, 1: 'Production', 2: 'UDT-ConDaoThongMinh', 3: 1330557, 4: 'UDT-ConDaoThongMinh', 5: 'v1.10.0', 9: 1039, 10: 994, 11: 45, 14: '80-90%'}),
  ];
  const snapshot = buildSnapshot({matrixRows: matrix(rows)});
  const codesFor = name => byName(snapshot, name).warnings.map(warning => warning.code);
  assert.ok(codesFor('SHE').includes('missing-auto'));
  assert.ok(codesFor('SmartCityForGovernment').includes('duplicate-metrics'));
  assert.ok(codesFor('UDT-ConDaoThongMinh').includes('duplicate-metrics'));
  assert.ok(codesFor('Smart Factory & Print-On-Demand').includes('stt-gap'));
  assert.equal(byName(snapshot, 'SHE').total, 949);
  assert.equal(byName(snapshot, 'SHE').auto, null);
});

test('publicSnapshot exposes metrics but no account/link/role fields', () => {
  const snapshot = buildSnapshot({
    matrixRows: matrix(SAMPLE_ROWS),
    summaryRows: SUMMARY,
    syncedAt: '2026-11-20T00:00:00.000Z',
    date: '20/11/26',
    source: {sheetId: 'x'},
  });
  assert.ok(isValidSnapshot(snapshot));
  assert.equal(snapshot.projects.length, 5);
  for (const project of snapshot.projects) {
    assert.ok(!('links' in project));
    assert.ok(!('account' in project));
    assert.ok(!('role' in project));
  }
  assert.equal(snapshot.projects.find(project => project.name === 'Becawork').qcSub[0], 'Loan');
});

test('rejects an invalid or old-schema snapshot', () => {
  assert.equal(isValidSnapshot(null), false);
  assert.equal(isValidSnapshot({schemaVersion: 1, projects: [{}], groups: [], dataIssues: []}), false);
  assert.equal(isValidSnapshot({schemaVersion: 2, projects: [], groups: [], dataIssues: []}), false);
});
