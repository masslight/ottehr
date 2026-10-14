import { describe, expect, it } from 'vitest';
import { bareTagHints } from './codeCheck';

describe('bareTagHints', () => {
  it('names the line of an unclosed lowercase <word>', () => {
    const code = [
      'function ReportRoot() {',
      '  return <div>registered by <email> on the form</div>;',
      '}',
      'return ReportRoot;',
    ].join('\n');
    expect(bareTagHints(code)).toEqual([
      "line 2: \"<email>\" looks like a bare <word> in JSX text — write {'<'}email{'>'} or use words",
    ]);
  });

  it('ignores closed elements and components', () => {
    const code = '<div><span>ok</span><Report.Note tone="info">x</Report.Note><MUI.Stack /></div>';
    expect(bareTagHints(code)).toEqual([]);
  });
});
