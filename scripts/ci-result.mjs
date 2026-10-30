// Writes a machine-readable result for one CI check: ci-results/result-<id>.json
// Usage (in a workflow step with `if: always()`):
//   CHECK_STATUS=${{ job.status }} node scripts/ci-result.mjs <lint|secrets|sast|deps>
// Reads the tool's report file (if present) and keeps only a SAFE summary:
// counts, rule ids and file paths - never secret values (gitleaks runs with --redact).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { readSarifDir } from './sarif.mjs';

const id = process.argv[2];
const status = process.env.CHECK_STATUS === 'success' ? 'passed' : 'failed';
const readJson = (f) => {
  try {
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
  } catch {
    return null;
  }
};

const CHECKS = {
  lint: {
    name: 'Lint & unit tests',
    tool: 'ESLint 9 (+ eslint-plugin-no-unsanitized) and Vitest',
    gate: 'Any ESLint error or failing unit test fails the job.',
    summarise() {
      const eslint = readJson('eslint.json') || [];
      const tests = readJson('test-results.json'); // Vitest JSON reporter (vitest.config.js)
      return {
        summary: {
          files_linted: eslint.length,
          eslint_errors: eslint.reduce((s, f) => s + f.errorCount, 0),
          eslint_warnings: eslint.reduce((s, f) => s + f.warningCount, 0),
          tests_passed: tests?.numPassedTests ?? null,
          tests_failed: tests?.numFailedTests ?? null,
        },
        findings: eslint.flatMap((f) => f.messages.map((m) => ({ rule: m.ruleId, file: f.filePath.replace(/^.*?\/(src|scripts|tests)\//, '$1/'), line: m.line, severity: m.severity === 2 ? 'error' : 'warning' }))).slice(0, 20),
      };
    },
  },
  secrets: {
    name: 'Secret detection',
    tool: `Gitleaks ${process.env.GITLEAKS_VERSION || ''} (full git history)`.trim(),
    gate: 'Any detected secret fails the job (gitleaks exit code 1).',
    summarise() {
      const report = readJson('gitleaks.json') || [];
      return {
        summary: { leaks_found: report.length },
        findings: report.slice(0, 20).map((l) => ({ rule: l.RuleID, file: l.File, line: l.StartLine, commit: (l.Commit || '').slice(0, 7) })),
      };
    },
  },
  sast: {
    name: 'Static analysis (SAST)',
    tool: `Semgrep ${process.env.SEMGREP_VERSION || ''}: p/javascript, p/secrets, p/github-actions + project rules`.trim(),
    gate: 'Any ERROR-severity finding fails the job; WARNING/INFO are reported only.',
    summarise() {
      const report = readJson('semgrep.json');
      const results = report?.results || [];
      const by = (sev) => results.filter((r) => r.extra?.severity === sev).length;
      return {
        summary: {
          files_scanned: report?.paths?.scanned?.length ?? null,
          error: by('ERROR'),
          warning: by('WARNING'),
          info: by('INFO'),
          scan_errors: report?.errors?.length ?? null,
        },
        findings: results.slice(0, 20).map((r) => ({ rule: r.check_id.split('.').pop(), severity: r.extra?.severity, file: r.path, line: r.start?.line })),
      };
    },
  },
  deps: {
    name: 'Dependency vulnerabilities',
    tool: 'npm audit (GitHub Advisory Database)',
    gate: 'Any CRITICAL vulnerability fails the job (npm audit --audit-level=critical).',
    summarise() {
      const report = readJson('audit.json');
      const v = report?.metadata?.vulnerabilities || {};
      return {
        summary: {
          dependencies: report?.metadata?.dependencies?.total ?? null,
          critical: v.critical ?? null,
          high: v.high ?? null,
          moderate: v.moderate ?? null,
          low: v.low ?? null,
        },
        findings: Object.values(report?.vulnerabilities || {}).slice(0, 20).map((x) => ({ package: x.name, severity: x.severity, range: x.range })),
      };
    },
  },
  codeql: {
    name: 'Code scanning (CodeQL)',
    tool: 'GitHub CodeQL: javascript-typescript, security-extended queries',
    gate: 'Any CRITICAL finding (security-severity >= 9.0) fails the job; all findings are uploaded to GitHub code scanning.',
    summarise() {
      const findings = readSarifDir('sarif-results');
      const by = (b) => (findings ? findings.filter((f) => f.severity === b).length : null);
      return {
        summary: { critical: by('critical'), high: by('high'), medium: by('medium'), low: by('low') },
        findings: (findings || []).slice(0, 20).map((f) => ({ rule: f.rule, severity: f.severity, file: f.file, line: f.line })),
      };
    },
  },
};

const check = CHECKS[id];
if (!check) {
  console.error(`Unknown check id: ${id}`);
  process.exit(2);
}
const result = { id, name: check.name, tool: check.tool, gate: check.gate, status, ...check.summarise(), finished_at: new Date().toISOString() };
mkdirSync('ci-results', { recursive: true });
writeFileSync(`ci-results/result-${id}.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
