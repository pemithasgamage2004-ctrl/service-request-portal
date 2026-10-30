import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { band, readSarifDir } from '../scripts/sarif.mjs';

const sarif = (score) => ({
  runs: [{
    tool: { driver: { name: 'CodeQL', rules: [] }, extensions: [{ rules: [{ id: 'js/xss', properties: { 'security-severity': String(score) } }] }] },
    results: [{ ruleId: 'js/xss', locations: [{ physicalLocation: { artifactLocation: { uri: 'src/x.js' }, region: { startLine: 3 } } }] }],
  }],
});

test('GitHub severity bands', () => {
  expect([band(9.8), band(9), band(7.5), band(4), band(1), band(0)]).toEqual(['critical', 'critical', 'high', 'medium', 'low', 'note']);
});

test('reads rules from tool extensions (where CodeQL puts query packs)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sarif-'));
  writeFileSync(join(dir, 'js.sarif'), JSON.stringify(sarif(9.3)));
  expect(readSarifDir(dir)).toEqual([{ rule: 'js/xss', severity: 'critical', score: 9.3, file: 'src/x.js', line: 3 }]);
});

test('missing results directory returns null (gate fails closed)', () => {
  expect(readSarifDir(join(tmpdir(), 'does-not-exist-sarif'))).toBeNull();
});
