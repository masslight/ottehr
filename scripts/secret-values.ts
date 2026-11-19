import * as fs from 'fs';
import * as path from 'path';

const SECRET_KEY_PATTERN = /SECRET|PASSWORD|TOKEN|KEY|DSN|PRIVATE/i;
const MIN_SECRET_LENGTH = 8;

function readEntries(filePath: string): [string, unknown][] {
  const content = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json')) {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? Object.entries(parsed) : [];
  }
  return content.split(/\r?\n/).flatMap((line): [string, string][] => {
    const separator = line.indexOf('=');
    if (separator <= 0) return [];
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    return [[line.slice(0, separator).trim(), value]];
  });
}

function filesIn(dir: string, matches: (name: string) => boolean): string[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
  return fs
    .readdirSync(dir)
    .filter(matches)
    .map((name) => path.join(dir, name));
}

function secretFilePaths(repoRoot: string): string[] {
  const isJson = (name: string): boolean => name.endsWith('.json');
  return [
    ...filesIn(path.join(repoRoot, 'config', '.env'), isJson),
    ...filesIn(path.join(repoRoot, 'packages', 'zambdas', '.env'), isJson),
    ...filesIn(path.join(repoRoot, 'packages', 'zambdas'), (name) => name === '.env.sentry-build-plugin'),
    ...filesIn(path.join(repoRoot, 'deploy'), (name) => name.endsWith('.tfvars')),
    ...['ehr', 'intake'].flatMap((app) =>
      filesIn(
        path.join(repoRoot, 'apps', app, 'env'),
        (name) => (name.startsWith('tests.') && isJson(name)) || name.startsWith('.env.')
      )
    ),
  ];
}

/** Values of secret-looking keys in the env and config files present in the checkout, longest first. */
export function readSecretValues(repoRoot = process.cwd()): { values: string[]; fileCount: number } {
  const files = secretFilePaths(repoRoot);
  const values = new Set(
    files
      .flatMap(readEntries)
      .filter(([key, value]) => SECRET_KEY_PATTERN.test(key) && typeof value === 'string')
      .flatMap(([, value]) => (value as string).split(/\r?\n/))
      .map((value) => value.trim())
      .filter((value) => value.length >= MIN_SECRET_LENGTH)
  );
  return { values: [...values].sort((a, b) => b.length - a.length), fileCount: files.length };
}
