import { test } from 'vitest';
import assert from 'node:assert/strict';
import { csvCell, toCsv } from '../src/lib/csv.js';

test('quotes commas, quotes and newlines (RFC 4180)', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line1\nline2'), '"line1\nline2"');
});

test('neutralises spreadsheet formula injection', () => {
  assert.equal(csvCell('=HYPERLINK("http://evil","x")'), `"'=HYPERLINK(""http://evil"",""x"")"`);
  assert.equal(csvCell('+1+1'), "'+1+1");
  assert.equal(csvCell('-2'), "'-2");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
});

test('null/undefined become empty cells', () => {
  assert.equal(toCsv([{ a: null, b: undefined, c: 0 }], ['a', 'b', 'c']), 'a,b,c\r\n,,0\r\n');
});
