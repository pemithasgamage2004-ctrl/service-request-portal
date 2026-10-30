// Sri Lanka public holidays used by the business-day SLA calculation.
// In Live mode the same rows live in the `public_holidays` table (editable by Admin);
// this list seeds that table and drives Demo mode.
//
// Source: Government of Sri Lanka holiday schedule for 2026 (Gazette Extraordinary
// No. 2438/22 of 27 May 2025) as reported by DailyNews, govt.sl and timeanddate.
// STATUS: to be verified against the gazette PDF. Moon-sighting dependent dates
// (Ramazan, Hadji, Milad-un-Nabi) may move. Dates that only fall on weekends do
// not affect business days. 2027 is NOT loaded yet: until it is added, only
// weekends are excluded for 2027 dates.
export const HOLIDAY_SOURCE = 'Gazette No. 2438/22 (27 May 2025), 2026 schedule - verify before production use';

export const PUBLIC_HOLIDAYS = [
  { date: '2026-01-03', name: 'Duruthu Full Moon Poya Day' },
  { date: '2026-01-15', name: 'Tamil Thai Pongal Day' },
  { date: '2026-02-01', name: 'Navam Full Moon Poya Day' },
  { date: '2026-02-04', name: 'Independence Day' },
  { date: '2026-02-15', name: 'Mahasivarathri Day' },
  { date: '2026-03-02', name: 'Medin Full Moon Poya Day' },
  { date: '2026-03-21', name: 'Id-Ul-Fitr (Ramazan Festival Day)' },
  { date: '2026-04-01', name: 'Bak Full Moon Poya Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-13', name: 'Day prior to Sinhala and Tamil New Year Day' },
  { date: '2026-04-14', name: 'Sinhala and Tamil New Year Day' },
  { date: '2026-05-01', name: 'May Day / Vesak Full Moon Poya Day' },
  { date: '2026-05-02', name: 'Day following Vesak Full Moon Poya Day' },
  { date: '2026-05-28', name: 'Id-Ul-Alha (Hadji Festival Day)' },
  { date: '2026-06-29', name: 'Poson Full Moon Poya Day' },
  { date: '2026-07-29', name: 'Esala Full Moon Poya Day' },
  { date: '2026-08-26', name: 'Milad-Un-Nabi (Holy Prophet\'s Birthday)' },
  { date: '2026-08-27', name: 'Nikini Full Moon Poya Day' },
  { date: '2026-09-26', name: 'Binara Full Moon Poya Day' },
  { date: '2026-10-25', name: 'Vap Full Moon Poya Day' },
  { date: '2026-11-08', name: 'Deepavali Festival Day' },
  { date: '2026-11-24', name: 'Il Full Moon Poya Day' },
  { date: '2026-12-23', name: 'Unduvap Full Moon Poya Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
];
