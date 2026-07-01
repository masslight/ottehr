import { Claim } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  buildNoCoverageStub,
  claimHasRealCoverage,
  ensureClaimInsurance,
  isNoCoverageStub,
  NO_COVERAGE_DISPLAY,
  NO_COVERAGE_SYSTEM,
} from '../../../src/billing/shared';

type ClaimInsurance = NonNullable<Claim['insurance']>;

const realCoverage = (id: string, sequence: number, focal = sequence === 1): ClaimInsurance[number] => ({
  sequence,
  focal,
  coverage: { reference: `Coverage/${id}` },
});

describe('no-coverage stub helpers', () => {
  it('builds a stub that is FHIR-valid (sequence/focal) and carries no literal reference', () => {
    const stub = buildNoCoverageStub();
    expect(stub.sequence).toBe(1);
    expect(stub.focal).toBe(true);
    expect(stub.coverage?.reference).toBeUndefined();
    expect(stub.coverage?.identifier?.system).toBe(NO_COVERAGE_SYSTEM);
    expect(stub.coverage?.display).toBe(NO_COVERAGE_DISPLAY);
  });

  it('recognizes the stub via identifier.system, not real coverages', () => {
    expect(isNoCoverageStub(buildNoCoverageStub())).toBe(true);
    expect(isNoCoverageStub(realCoverage('abc', 1))).toBe(false);
    // a real coverage that happens to have a display but a real reference is not a stub
    expect(
      isNoCoverageStub({ sequence: 1, focal: true, coverage: { reference: 'Coverage/x', display: 'Aetna' } })
    ).toBe(false);
  });

  it('claimHasRealCoverage reflects presence of non-stub entries', () => {
    expect(claimHasRealCoverage(undefined)).toBe(false);
    expect(claimHasRealCoverage([])).toBe(false);
    expect(claimHasRealCoverage([buildNoCoverageStub()])).toBe(false);
    expect(claimHasRealCoverage([realCoverage('abc', 1)])).toBe(true);
    expect(claimHasRealCoverage([buildNoCoverageStub(), realCoverage('abc', 2)])).toBe(true);
  });
});

describe('ensureClaimInsurance', () => {
  it('inserts the stub when insurance is empty or undefined', () => {
    expect(ensureClaimInsurance(undefined)).toEqual([buildNoCoverageStub()]);
    expect(ensureClaimInsurance([])).toEqual([buildNoCoverageStub()]);
  });

  it('strips the stub when a real coverage is present', () => {
    const result = ensureClaimInsurance([buildNoCoverageStub(), realCoverage('abc', 2)]);
    expect(result).toHaveLength(1);
    expect(isNoCoverageStub(result[0])).toBe(false);
    expect(result[0].coverage?.reference).toBe('Coverage/abc');
  });

  it('re-adds the stub when all real coverages are removed', () => {
    // simulate a claim that previously had a coverage which was then filtered out
    const afterRemoval: ClaimInsurance = [];
    expect(ensureClaimInsurance(afterRemoval)).toEqual([buildNoCoverageStub()]);
  });

  it('re-sequences real coverages 1..n with the first marked focal', () => {
    const result = ensureClaimInsurance([realCoverage('second', 5, false), realCoverage('first', 2, true)]);
    expect(result.map((r) => r.sequence)).toEqual([1, 2]);
    expect(result[0].coverage?.reference).toBe('Coverage/first');
    expect(result[0].focal).toBe(true);
    expect(result[1].focal).toBe(false);
  });

  it('is idempotent on a stub-only claim', () => {
    expect(ensureClaimInsurance([buildNoCoverageStub()])).toEqual([buildNoCoverageStub()]);
  });
});
