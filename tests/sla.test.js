import { test, expect } from 'vitest';
import { localDate, isBusinessDay, addBusinessDays, slaDueAt } from '../src/lib/sla.js';

test('local date uses Asia/Colombo (UTC+05:30)', () => {
  expect(localDate(Date.parse('2026-10-29T18:29:00Z'))).toBe('2026-10-29'); // 23:59 Colombo
  expect(localDate(Date.parse('2026-10-29T18:30:00Z'))).toBe('2026-10-30'); // 00:00 Colombo next day
});

test('weekends and public holidays are not business days', () => {
  expect(isBusinessDay('2026-10-30')).toBe(true); // Friday
  expect(isBusinessDay('2026-10-31')).toBe(false); // Saturday
  expect(isBusinessDay('2026-11-01')).toBe(false); // Sunday
  expect(isBusinessDay('2026-11-24')).toBe(false); // Il Full Moon Poya (Tuesday)
  expect(isBusinessDay('2026-12-25')).toBe(false); // Christmas (Friday)
});

test('addBusinessDays skips weekends and holidays', () => {
  expect(addBusinessDays('2026-10-30', 1)).toBe('2026-11-02'); // Fri -> Mon
  expect(addBusinessDays('2026-11-23', 1)).toBe('2026-11-25'); // Mon -> Wed (Tue is Poya)
  expect(addBusinessDays('2026-12-22', 2)).toBe('2026-12-28'); // Tue -> skip 23 Poya, 25 Xmas, weekend
  expect(addBusinessDays('2026-10-31', 1)).toBe('2026-11-02'); // submitted Saturday
});

test('SLA due = 17:00 Colombo on the Nth business day after submission', () => {
  // Friday 10:00 Colombo, Critical (1 business day) -> Monday 17:00 Colombo = 11:30Z
  expect(slaDueAt('2026-10-30T04:30:00Z', 'Critical')).toBe('2026-11-02T11:30:00Z');
  // Monday, High (3) -> Thursday
  expect(slaDueAt('2026-11-02T03:00:00Z', 'High')).toBe('2026-11-05T11:30:00Z');
  // Late Thursday UTC that is already Friday in Colombo counts from Friday
  expect(slaDueAt('2026-10-29T19:00:00Z', 'Critical')).toBe('2026-11-02T11:30:00Z');
  // Low (10) across the Il Poya holiday on Tue 24 Nov
  expect(slaDueAt('2026-11-16T05:00:00Z', 'Low')).toBe('2026-12-01T11:30:00Z');
});

test('custom policy and holiday list (as stored in sla_policy / public_holidays)', () => {
  expect(slaDueAt('2026-10-30T04:30:00Z', 'Critical', { slaDays: { Critical: 2 }, holidays: new Set(['2026-11-02']) })).toBe('2026-11-04T11:30:00Z');
  expect(() => slaDueAt('2026-10-30T04:30:00Z', 'Urgent')).toThrow();
});
