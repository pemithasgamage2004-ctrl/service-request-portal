import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { section, tableDefinitions, MIGRATION_FILES } from '../src/lib/migrations.js';

const read = (f) => readFileSync(`supabase/migrations/${f}`, 'utf8');

test('the site lists every migration file', () => {
  expect(MIGRATION_FILES).toEqual(readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort());
});

test('displayed SQL sections exist in the migrations', () => {
  const reporting = read('20261030120300_reporting.sql');
  expect(section(reporting, 'kpi_summary')).toMatch(/^create function public\.kpi_summary/);
  expect(section(reporting, 'view')).toMatch(/security_invoker = on/);
  const tables = tableDefinitions(read('20261030120000_core_schema.sql'));
  for (const t of ['requests', 'request_history', 'profiles', 'sla_policy']) expect(tables).toContain(`create table public.${t} (`);
});
