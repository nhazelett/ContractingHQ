'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const calendar = require('../scripts/seasonal-calendar.js');

test('every seasonal switch occurs at midnight Eastern, including the DST change date', () => {
  const switches = [
    ['2026-01-01T05:00:00Z', 'christmas', 'winter'],
    ['2026-02-01T05:00:00Z', 'winter', 'valentine'],
    ['2026-03-01T05:00:00Z', 'valentine', 'standard'],
    ['2026-07-01T04:00:00Z', 'standard', 'independence'],
    ['2026-08-01T04:00:00Z', 'independence', 'standard'],
    ['2026-09-01T04:00:00Z', 'standard', 'fiscal'],
    ['2026-10-01T04:00:00Z', 'fiscal', 'halloween'],
    ['2026-11-01T04:00:00Z', 'halloween', 'thanksgiving'],
    ['2026-11-27T05:00:00Z', 'thanksgiving', 'christmas'],
    ['2027-01-01T05:00:00Z', 'christmas', 'winter']
  ];
  for (const [instant, before, after] of switches) {
    const timestamp = Date.parse(instant);
    assert.equal(calendar.getSeason(new Date(timestamp - 1)), before, `before ${instant}`);
    assert.equal(calendar.getSeason(new Date(timestamp)), after, `at ${instant}`);
  }
});

test('standard months remain standard and each season covers its full interval', () => {
  const expected = ['winter', 'valentine', 'standard', 'standard', 'standard', 'standard',
    'independence', 'standard', 'fiscal', 'halloween', 'thanksgiving', 'christmas'];
  expected.forEach((season, index) => {
    assert.equal(calendar.getSeason(new Date(Date.UTC(2026, index, 15, 12))), season);
  });
  assert.equal(calendar.getSeason(new Date('2026-11-30T17:00:00Z')), 'christmas');
  assert.equal(calendar.getSeason(new Date('2026-12-31T23:59:59-05:00')), 'christmas');
});

test('Thanksgiving fixtures cover all seven possible weekdays for November 1', () => {
  const fixtures = [[2023, 23], [2024, 28], [2025, 27], [2026, 26], [2027, 25],
    [2028, 23], [2029, 22], [2030, 28], [2033, 24]];
  const novemberWeekdays = new Set();
  for (const [year, day] of fixtures) {
    novemberWeekdays.add(new Date(Date.UTC(year, 10, 1)).getUTCDay());
    assert.equal(calendar.thanksgivingDay(year), day, `Thanksgiving ${year}`);
    assert.equal(calendar.getSeason(new Date(`${year}-11-${day}T23:59:59-05:00`)), 'thanksgiving');
    assert.equal(calendar.getSeason(new Date(`${year}-11-${day + 1}T00:00:00-05:00`)), 'christmas');
  }
  assert.equal(novemberWeekdays.size, 7);
  for (const year of [0, -1, 10000, 2026.5, NaN, '2026', null]) {
    assert.equal(calendar.thanksgivingDay(year), null);
  }
});

test('February ends correctly in leap and non-leap years', () => {
  assert.equal(calendar.getSeason(new Date('2027-02-28T23:59:59-05:00')), 'valentine');
  assert.equal(calendar.getSeason(new Date('2027-03-01T00:00:00-05:00')), 'standard');
  assert.equal(calendar.getSeason(new Date('2028-02-29T23:59:59-05:00')), 'valentine');
  assert.equal(calendar.getSeason(new Date('2028-03-01T00:00:00-05:00')), 'standard');
});

test('Eastern date parts do not use the runtime or visitor timezone', () => {
  const instant = new Date('2026-11-27T04:59:59Z');
  assert.deepEqual(calendar.getEasternParts(instant), { year: 2026, month: 11, day: 26 });
  assert.equal(calendar.getSeason(instant), 'thanksgiving');
  const midnight = new Date('2026-11-27T05:00:00Z');
  assert.equal(calendar.getSeason(midnight), 'christmas');
  assert.equal(calendar.getSeason(midnight, 'Pacific/Honolulu'), 'thanksgiving');
  assert.equal(calendar.getSeason(midnight, 'invalid/timezone'), 'christmas');
  assert.equal(calendar.getSeason(midnight, {}), 'christmas');
});

test('preview theme, preview date, forced mode, and automatic mode have explicit precedence', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  assert.equal(calendar.resolveSeason({ now }), 'independence');
  assert.equal(calendar.resolveSeason({ now, mode: 'auto' }), 'independence');
  for (const theme of calendar.themes) {
    assert.equal(calendar.resolveSeason({ now, mode: theme }), theme);
    assert.equal(calendar.resolveSeason({ now, preview: theme, previewDate: '2026-10-31', mode: 'fiscal' }), theme);
  }
  assert.equal(calendar.resolveSeason({ now, mode: 'winter', previewDate: '2026-10-31' }), 'halloween');
  assert.equal(calendar.resolveSeason({ now, previewDate: '2026-11-26' }), 'thanksgiving');
  assert.equal(calendar.resolveSeason({ now, previewDate: '2026-11-27' }), 'christmas');
});

test('invalid theme and preview date inputs are ignored without calendar rollovers', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  const invalidThemes = ['auto', 'Christmas', '__proto__', 'constructor', 'toString', '', null, [], {}];
  for (const value of invalidThemes) {
    assert.equal(calendar.resolveSeason({ now, preview: value, mode: value }), 'independence');
  }
  const invalidDates = ['2026-02-29', '2028-02-30', '2100-02-29', '2026-11-31',
    '2026-13-01', '2026-00-01', '2026-01-00', '0000-01-01', '2026-1-01',
    '2026-12-01T00:00:00Z', '2026-12-01junk', ' 2026-12-01', '', null, [], {}];
  for (const previewDate of invalidDates) {
    assert.equal(calendar.resolveSeason({ now, previewDate }), 'independence', String(previewDate));
    assert.equal(calendar.resolveSeason({ now, previewDate, mode: 'fiscal' }), 'fiscal');
  }
  for (const previewDate of ['2028-02-29', '2000-02-29']) {
    assert.equal(calendar.resolveSeason({ now, previewDate }), 'valentine');
  }
});

test('bad dates and unexpected option errors fail safely to the standard theme', () => {
  assert.equal(calendar.getEasternParts(new Date(NaN)), null);
  assert.equal(calendar.getSeason(new Date(NaN)), 'standard');
  assert.equal(calendar.getSeason(null), 'standard');
  assert.equal(calendar.getSeason(false), 'standard');
  assert.equal(calendar.resolveSeason({ now: new Date(NaN) }), 'standard');
  assert.equal(calendar.resolveSeason({ get preview() { throw new Error('broken config'); } }), 'standard');
  assert.ok(calendar.themes.includes(calendar.resolveSeason(null)));
});

test('the same module exposes a frozen browser API without needing a DOM or timers', () => {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/seasonal-calendar.js'), 'utf8');
  const context = { window: {}, Date, Intl };
  vm.runInNewContext(source, context);
  const api = context.window.KTHQSeasonCalendar;
  assert.equal(api.getSeason(new Date('2026-12-25T12:00:00Z')), 'christmas');
  assert.equal(api.defaultTimeZone, 'America/New_York');
  assert.ok(Object.isFrozen(api));
  assert.ok(Object.isFrozen(api.themes));
  const unavailableIntl = { window: {}, Date, Intl: undefined };
  vm.runInNewContext(source, unavailableIntl);
  assert.equal(unavailableIntl.window.KTHQSeasonCalendar.getSeason(new Date()), 'standard');
});

test('New Year artwork welcomes the upcoming January and keeps its year through January', () => {
  assert.equal(calendar.getNewYear(new Date('2026-11-18T23:00:00Z')), 2027);
  assert.equal(calendar.getNewYear(new Date('2027-01-01T04:59:59Z')), 2027);
  assert.equal(calendar.getNewYear(new Date('2027-01-01T05:00:00Z')), 2027);
  assert.equal(calendar.getNewYear(new Date('2027-02-01T04:59:59Z')), 2027);
  assert.equal(calendar.getNewYear(new Date('2027-02-01T05:00:00Z')), 2028);
  assert.equal(calendar.getNewYear(new Date('2027-02-01T05:00:00Z'), 'Pacific/Honolulu'), 2027);
  assert.equal(calendar.getNewYear(new Date('2027-01-01T05:00:00Z'), 'invalid/timezone'), 2027);
});

test('explicit New Year dates determine the numeral and malformed dates cannot replace it', () => {
  const now = new Date('2026-11-18T23:00:00Z');
  assert.equal(calendar.getNewYear(now, undefined, '2028-01-01'), 2028);
  assert.equal(calendar.getNewYear(now, undefined, '2031-01-31'), 2031);
  assert.equal(calendar.getNewYear(now, undefined, '2028-02-29'), 2028);
  assert.equal(calendar.getNewYear(now, undefined, '2027-02-29'), 2027);
  assert.equal(calendar.getNewYear(now, undefined, '<b>2028</b>'), 2027);
  assert.equal(calendar.getNewYear(new Date(NaN)), null);
  assert.equal(calendar.getNewYear(new Date(NaN), undefined, '2028-01-01'), 2028);
});

test('fiscal countdown and September boundaries use the visitor’s local midnight', () => {
  const { execFileSync } = require('node:child_process');
  for (const [zone, midnight] of [['America/Los_Angeles','2027-10-01T07:00:00Z'],
    ['Asia/Kathmandu','2027-09-30T18:15:00Z'], ['Pacific/Auckland','2027-09-30T11:00:00Z']]) {
    const script = `
      const assert = require('node:assert/strict');
      const api = require('./scripts/seasonal-calendar.js');
      const end = new Date(process.argv[1]);
      const before = new Date(+end - 1000);
      assert.deepEqual(api.fiscalCountdown(before, 2027), {days:0,hours:0,minutes:0,seconds:1,finalDay:true});
      assert.equal(api.fiscalCountdown(end, 2027).seconds, 0);
      assert.equal(api.resolveSeason({now:before,localFiscalMonth:true}), 'fiscal');
      assert.equal(api.resolveSeason({now:end,localFiscalMonth:true}), 'halloween');
      assert.equal(api.resolveSeason({now:new Date(2027,8,1),localFiscalMonth:true}), 'fiscal');
      assert.equal(api.resolveSeason({now:new Date(2027,8,1)-1,localFiscalMonth:true}), 'standard');
    `;
    execFileSync(process.execPath, ['-e', script, midnight], {env:{...process.env,TZ:zone},cwd:path.join(__dirname,'..')});
  }
});

test('world clock stations reach their October midnight at different instants', () => {
  for (const [zone, instant] of [
    ['UTC','2027-10-01T00:00:00Z'], ['America/Los_Angeles','2027-10-01T07:00:00Z'],
    ['Europe/Berlin','2027-09-30T22:00:00Z'], ['Asia/Kathmandu','2027-09-30T18:15:00Z'],
    ['Pacific/Auckland','2027-09-30T11:00:00Z'], ['Pacific/Honolulu','2027-10-01T10:00:00Z']
  ]) assert.equal(calendar.fiscalCloseInZone(2027, zone), Date.parse(instant));
});
