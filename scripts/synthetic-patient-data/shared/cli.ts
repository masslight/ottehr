// Shared CLI-argument parsing for the synthetic-data dev scripts. Replaces the
// `arg`/`flag`/`getFlag`/`getFlagValue` helpers each script re-declared, and adds
// VALIDATED numeric/date parsing: a malformed `--count abc` used to parse to NaN
// and silently no-op (or misbehave) — now it errors and exits with a clear message.

/** Value of `--name <value>`. Returns `dflt` (or undefined) when the flag is absent. */
export function arg(name: string): string | undefined;
export function arg(name: string, dflt: string): string;
export function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 && i < process.argv.length - 1 ? process.argv[i + 1] : dflt;
}

/** Every value of a repeatable `--name <value>` flag, in order. */
export const argAll = (name: string): string[] => {
  const out: string[] = [];
  const argv = process.argv;
  for (let i = 0; i < argv.length - 1; i++) if (argv[i] === name && argv[i + 1]) out.push(argv[i + 1]);
  return out;
};

/** True when the bare flag `--name` is present. */
export const flag = (name: string): boolean => process.argv.includes(name);

const die = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

/**
 * Integer value of `--name <n>`, validated. Rejects non-integers (incl. NaN)
 * and values outside [min, max] with a clear error + exit(1) instead of the old
 * silent-NaN behavior. Returns `default` when the flag is absent.
 */
export const argInt = (name: string, opts: { default: number; min?: number; max?: number }): number => {
  const raw = arg(name);
  if (raw === undefined) return opts.default;
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    return die(`Invalid value for ${name}: "${raw}" is not an integer.`);
  }
  if (opts.min !== undefined && n < opts.min) {
    return die(`Invalid value for ${name}: ${n} is below the minimum of ${opts.min}.`);
  }
  if (opts.max !== undefined && n > opts.max) {
    return die(`Invalid value for ${name}: ${n} is above the maximum of ${opts.max}.`);
  }
  return n;
};

/**
 * `--name YYYY-MM-DD`, validated as a real calendar date. Errors + exits on a
 * malformed value (the old behavior passed it straight into FHIR tag searches,
 * which silently matched nothing). Returns `dflt` (or undefined) when absent.
 */
export function argDate(name: string): string | undefined;
export function argDate(name: string, dflt: string): string;
export function argDate(name: string, dflt?: string): string | undefined {
  const raw = arg(name);
  if (raw === undefined) return dflt;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(raw) && new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) === raw;
  if (!valid) return die(`Invalid value for ${name}: "${raw}" is not a valid YYYY-MM-DD date.`);
  return raw;
}
