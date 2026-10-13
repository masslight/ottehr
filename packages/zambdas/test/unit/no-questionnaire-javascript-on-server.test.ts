import { readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { describe, expect, test } from 'vitest';

/**
 * The javascript in a questionnaire's calculated expressions is only ever evaluated in a browser, never on the
 * server. The browser sends the values it computed and the server records them without being able to recompute them.
 * This pins the boundary: the module that evaluates expressions must not be imported by any zambda, and the
 * modules the server does use must not be able to compile or run an expression.
 */

const ZAMBDAS_SRC = resolve(__dirname, '../../src');
const PAPERWORK_UTILS = resolve(__dirname, '../../../utils/lib/helpers/paperwork');

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });

describe('questionnaire javascript stays in the browser', () => {
  test('no zambda imports the module that evaluates calculated expressions', () => {
    const offenders = sourceFiles(ZAMBDAS_SRC).filter((file) =>
      /from\s+['"][^'"]*\/calculated-expressions['"]/.test(readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  test.each(['calculated-answers.ts', 'calculated-expression-validation.ts'])(
    '%s, which the server uses, neither imports the evaluator nor compiles code',
    (fileName) => {
      const source = readFileSync(join(PAPERWORK_UTILS, fileName), 'utf8');
      expect(source).not.toMatch(/calculated-expressions['"]/);
      expect(source).not.toMatch(/new\s+Function\s*\(/);
      expect(source).not.toMatch(/\beval\s*\(/);
      expect(source).not.toMatch(/from\s+['"](node:)?vm['"]/);
    }
  );
});
