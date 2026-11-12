import { createRequire } from 'node:module';
import { describe, it } from 'vitest';
import rule from '../rules/require-disable-reason';

// ESLint 8 ships no types, and its RuleTester is the one that runs the repo's lint.
const require = createRequire(import.meta.url);
const { RuleTester } = require('eslint');

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

const lines = (...code: string[]): string => code.join('\n');
// Core rules stand in for the repo's, so the cases need no other plugin loaded.
const options = [{ rules: ['no-console'] }];
const missingReason = (line: number): object => ({ messageId: 'missingReason', data: { rule: 'no-console' }, line });

ruleTester.run('require-disable-reason', rule, {
  valid: [
    {
      name: 'a reason on the line above',
      code: lines('// eslint-disable-next-line no-console -- reports the run to the operator', 'console.log(run);'),
      options,
    },
    {
      name: 'a reason on the same line',
      code: 'console.log(run); // eslint-disable-line no-console -- reports the run to the operator',
      options,
    },
    {
      name: 'a reason in a block comment',
      code: lines('/* eslint-disable no-console -- a CLI script that reports to stdout */', 'console.log(run);'),
      options,
    },
    {
      name: 'a reason after a longer dash run',
      code: lines('// eslint-disable-next-line no-console --- reports the run', 'console.log(run);'),
      options,
    },
    {
      name: 'a rule it was not given',
      code: lines('// eslint-disable-next-line no-debugger', 'debugger;'),
      options,
    },
    {
      name: 'switching a rule back on',
      code: lines(
        '/* eslint-disable no-console -- reports to stdout */',
        'console.log(run);',
        '/* eslint-enable no-console */'
      ),
      options,
    },
    {
      name: 'every rule, with a reason',
      code: lines('// eslint-disable-next-line -- generated code', 'console.log(run);'),
      options,
    },
    {
      name: 'comments that are not directives',
      code: lines(
        // ESLint ignores eslint-disable in a line comment; only the -line forms work there
        '// eslint-disable no-console',
        '// see eslint-disable-next-line in the docs',
        'console.log(run);'
      ),
      options,
    },
  ],
  invalid: [
    {
      name: 'no reason on the line above',
      code: lines('// eslint-disable-next-line no-console', 'console.log(run);'),
      options,
      errors: [missingReason(1)],
    },
    {
      name: 'a separator with nothing after it',
      code: lines('// eslint-disable-next-line no-console -- ', 'console.log(run);'),
      options,
      errors: [missingReason(1)],
    },
    {
      name: 'the rule among several',
      code: lines('// eslint-disable-next-line no-debugger, no-console', 'console.log(run);'),
      options,
      errors: [missingReason(1)],
    },
    {
      name: 'no reason on the same line, which switches off only the rule it names',
      code: lines('const run = 1;', 'console.log(run); // eslint-disable-line no-console'),
      options,
      errors: [missingReason(2)],
    },
    {
      name: 'no reason in a block comment',
      code: lines('/* eslint-disable no-console */', 'console.log(run);'),
      options,
      errors: [missingReason(1)],
    },
    {
      name: 'every rule, without a reason',
      code: lines('// eslint-disable-next-line', 'console.log(run);'),
      options,
      errors: [{ messageId: 'missingReasonAllRules', data: { rules: 'no-console' }, line: 1 }],
    },
  ],
});
