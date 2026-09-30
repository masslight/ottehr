import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { evaluate, type EvaluateInput, readManagedKeys, readRemovals, readSeedKeys } from './check-ejection-coverage';

const run = (over: Partial<EvaluateInput>): ReturnType<typeof evaluate> =>
  evaluate({ baseManaged: [], headManaged: [], removed: [], seed: [], ...over });

describe('check-ejection-coverage · evaluate', () => {
  it('passes a clean ejection (managed→removed, non-destructive, seed-backed)', () => {
    const { failures, warnings } = run({
      baseManaged: ['A', 'B', 'C'],
      headManaged: ['A'],
      removed: [
        { key: 'B', destroy: false },
        { key: 'C', destroy: false },
      ],
      seed: ['B', 'C'],
    });
    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('FAILS when a resource leaves management with no removal block (would be destroyed)', () => {
    const { failures } = run({
      baseManaged: ['A', 'B', 'C'],
      headManaged: ['A'],
      removed: [{ key: 'B', destroy: false }],
      seed: ['B'],
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('NO removed{} block');
    expect(failures[0]).toContain('C');
    expect(failures[0]).not.toContain('B'); // B is correctly ejected
  });

  it('FAILS when a removal block is not destroy=false (true or missing)', () => {
    const trueCase = run({
      baseManaged: ['A', 'B'],
      headManaged: ['A'],
      removed: [{ key: 'B', destroy: true }],
      seed: ['B'],
    });
    expect(trueCase.failures.some((f) => f.includes('without destroy=false') && f.includes('B'))).toBe(true);

    const missingCase = run({
      baseManaged: ['A', 'B'],
      headManaged: ['A'],
      removed: [{ key: 'B', destroy: undefined }],
      seed: ['B'],
    });
    expect(missingCase.failures.some((f) => f.includes('without destroy=false'))).toBe(true);
  });

  it('FAILS when a removal is not backed by seed data (not re-seedable)', () => {
    const { failures } = run({
      baseManaged: ['A', 'B'],
      headManaged: ['A'],
      removed: [{ key: 'B', destroy: false }],
      seed: [], // B ejected but absent from seed
    });
    expect(failures.some((f) => f.includes('not backed by config/runtime-seed') && f.includes('B'))).toBe(true);
  });

  it('ignores resources newly added to management on the PR', () => {
    const { failures, warnings } = run({
      baseManaged: ['A'],
      headManaged: ['A', 'D'], // D is new — not an ejection
      removed: [],
      seed: [],
    });
    expect(failures).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('WARNS (does not fail) on a removal for something the base never managed', () => {
    const { failures, warnings } = run({
      baseManaged: ['A'],
      headManaged: ['A'],
      removed: [{ key: 'X', destroy: false }],
      seed: ['X'],
    });
    expect(failures).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('stale/no-op');
    expect(warnings[0]).toContain('X');
  });

  it('reports multiple independent failures together', () => {
    const { failures } = run({
      baseManaged: ['A', 'B', 'C'],
      headManaged: ['A'],
      removed: [{ key: 'B', destroy: true }], // B destructive; C silently dropped
      seed: [], // B also not seeded
    });
    expect(failures.length).toBeGreaterThanOrEqual(2);
    expect(failures.join('\n')).toContain('C'); // silent drop
    expect(failures.join('\n')).toContain('destroy=false'); // B destructive
  });
});

describe('check-ejection-coverage · readers', () => {
  let dir: string;
  const oystehr = (): string => path.join(dir, 'oystehr');
  const seed = (): string => path.join(dir, 'runtime-seed');

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ejection-cov-'));
    fs.mkdirSync(oystehr(), { recursive: true });
    fs.mkdirSync(seed(), { recursive: true });
    fs.writeFileSync(
      path.join(oystehr(), 'fhir-resources.tf.json'),
      JSON.stringify({ resource: { oystehr_fhir_resource: { KEY1: {}, KEY2: {} } } })
    );
    fs.writeFileSync(
      path.join(oystehr(), 'removed-locations.tf.json'),
      JSON.stringify({
        removed: [
          { from: 'oystehr_fhir_resource.KEY1', lifecycle: { destroy: false } },
          { from: 'oystehr_fhir_resource.KEY2', lifecycle: { destroy: true } },
        ],
      })
    );
    fs.writeFileSync(path.join(seed(), 'a.json'), JSON.stringify({ fhirResources: { KEYA: {}, KEYB: {} } }));
    fs.writeFileSync(path.join(seed(), 'b.json'), JSON.stringify({ fhirResources: { KEYC: {} } }));
  });

  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('reads managed oystehr_fhir_resource keys (object form)', () => {
    expect(readManagedKeys(oystehr()).sort()).toEqual(['KEY1', 'KEY2']);
  });

  it('reads managed keys from the HCL-JSON array form too', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ejection-cov-arr-'));
    fs.writeFileSync(
      path.join(d, 'fhir-resources.tf.json'),
      JSON.stringify({ resource: [{ oystehr_fhir_resource: { KEY3: {} } }] })
    );
    expect(readManagedKeys(d)).toEqual(['KEY3']);
    fs.rmSync(d, { recursive: true, force: true });
  });

  it('reads removal blocks with their key and destroy flag', () => {
    expect(readRemovals(oystehr())).toEqual([
      { key: 'KEY1', destroy: false },
      { key: 'KEY2', destroy: true },
    ]);
  });

  it('reads seed keys across all *.json files', () => {
    expect(readSeedKeys(seed()).sort()).toEqual(['KEYA', 'KEYB', 'KEYC']);
  });

  it('returns empty for missing files/dirs (base ref has no removals/seed)', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ejection-cov-empty-'));
    expect(readManagedKeys(empty)).toEqual([]);
    expect(readRemovals(empty)).toEqual([]);
    expect(readSeedKeys(path.join(empty, 'nope'))).toEqual([]);
    fs.rmSync(empty, { recursive: true, force: true });
  });
});
