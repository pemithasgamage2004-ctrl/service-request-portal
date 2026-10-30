// Combines ci-results/result-*.json (downloaded from the check jobs) into
// public/security-results.json, which is deployed with the site and rendered
// on the Security & Pipeline page. Runs automatically before `npm run build`.
// Outside GitHub Actions it writes a clearly-labelled local placeholder.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const env = process.env;
const inCi = env.GITHUB_ACTIONS === 'true';
const ORDER = ['lint', 'secrets', 'sast', 'deps'];

const checks = existsSync('ci-results')
  ? readdirSync('ci-results')
    .filter((f) => /^result-[a-z]+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(`ci-results/${f}`, 'utf8')))
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
  : [];

const server = env.GITHUB_SERVER_URL || 'https://github.com';
const summary = {
  schema_version: 1,
  source: inCi ? 'github-actions' : 'local-build',
  generated_at: new Date().toISOString(),
  repository: env.GITHUB_REPOSITORY || null,
  repository_url: env.GITHUB_REPOSITORY ? `${server}/${env.GITHUB_REPOSITORY}` : null,
  workflow: env.GITHUB_WORKFLOW || null,
  event: env.GITHUB_EVENT_NAME || null,
  branch: env.GITHUB_REF_NAME || null,
  commit_sha: env.GITHUB_SHA || null,
  commit_url: env.GITHUB_SHA && env.GITHUB_REPOSITORY ? `${server}/${env.GITHUB_REPOSITORY}/commit/${env.GITHUB_SHA}` : null,
  run_id: env.GITHUB_RUN_ID || null,
  run_number: env.GITHUB_RUN_NUMBER || null,
  run_attempt: env.GITHUB_RUN_ATTEMPT || null,
  run_url: env.GITHUB_RUN_ID && env.GITHUB_REPOSITORY ? `${server}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : null,
  overall: checks.length === ORDER.length && checks.every((c) => c.status === 'passed') ? 'passed' : checks.length ? 'failed' : 'unknown',
  checks,
};

if (inCi && checks.length !== ORDER.length) {
  console.error(`Expected ${ORDER.length} check results, found ${checks.length}. Refusing to publish an incomplete summary.`);
  process.exit(1);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/security-results.json', JSON.stringify(summary, null, 2) + '\n');
console.log(`Wrote public/security-results.json (${summary.source}, overall: ${summary.overall}, ${checks.length} checks)`);
