// The real database migrations, bundled as text at build time (Vite `?raw`), so the
// SQL shown on the site IS the SQL that runs in Live mode - no hand-copied versions.
import coreSchema from '../../supabase/migrations/20261030120000_core_schema.sql?raw';
import reporting from '../../supabase/migrations/20261030120300_reporting.sql?raw';

/** Text between `-- @sql:<name>` and `-- @end` markers in a migration file. */
export function section(text, name) {
  const start = text.indexOf(`-- @sql:${name}\n`);
  const end = text.indexOf('-- @end', start);
  if (start < 0 || end < 0) throw new Error(`SQL section "${name}" not found`);
  return text.slice(start + `-- @sql:${name}\n`.length, end).trim();
}

/** CREATE TABLE statements for the reference data, requests and history tables. */
export function tableDefinitions(text = coreSchema) {
  return [...text.matchAll(/create table public\.[\s\S]*?\n\);/g)].map((m) => m[0]).join('\n\n');
}

export const SCHEMA_SQL = tableDefinitions();
export const VIEW_SQL = section(reporting, 'view');
export const KPI_FUNCTION_SQL = section(reporting, 'kpi_summary');
export const MIGRATION_FILES = [
  '20261030120000_core_schema.sql',
  '20261030120100_workflow_functions.sql',
  '20261030120200_rls_policies.sql',
  '20261030120300_reporting.sql',
];
