// Minimal SARIF reader for the CodeQL gate and the published results summary.
// GitHub's severity bands for security-severity scores: critical >= 9.0, high >= 7.0,
// medium >= 4.0, low > 0 (https://docs.github.com/code-security/code-scanning).
import { existsSync, readdirSync, readFileSync } from 'node:fs';

export function band(score) {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0) return 'low';
  return 'note';
}

/** All results from every .sarif file in `dir`, each with its rule's security severity band. */
export function readSarifDir(dir) {
  if (!existsSync(dir)) return null;
  const findings = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sarif'))) {
    const sarif = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
    for (const run of sarif.runs || []) {
      const rules = new Map();
      for (const comp of [run.tool?.driver, ...(run.tool?.extensions || [])]) {
        for (const r of comp?.rules || []) rules.set(r.id, r);
      }
      for (const res of run.results || []) {
        const rule = rules.get(res.ruleId) || {};
        const score = Number(rule.properties?.['security-severity'] ?? 0);
        const loc = res.locations?.[0]?.physicalLocation;
        findings.push({ rule: res.ruleId, severity: band(score), score, file: loc?.artifactLocation?.uri, line: loc?.region?.startLine });
      }
    }
  }
  return findings;
}

// CLI gate: node scripts/sarif.mjs <dir>  -> exit 1 if any critical finding
if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = readSarifDir(process.argv[2] || 'sarif-results');
  if (!findings) {
    console.error('No SARIF results found - failing closed.');
    process.exit(1);
  }
  for (const f of findings) console.log(`${f.severity}\t${f.score}\t${f.rule}\t${f.file}:${f.line}`);
  const critical = findings.filter((f) => f.severity === 'critical').length;
  console.log(`CodeQL findings: ${findings.length} total, ${critical} critical`);
  process.exit(critical ? 1 : 0);
}
