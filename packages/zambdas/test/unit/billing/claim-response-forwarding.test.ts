import { ClaimResponse } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { ERA_ITEM_REMARK_CODE_EXTENSION, ERA_STATUS_CODE_EXTENSION } from '../../../src/billing/shared';
import { claimWasForwarded } from '../../../src/subscriptions/claim-response/sub-claim-response-adjust-status';
import { claimResponse } from './era-fixtures';

const withLineRemarks = (codes: string[]): ClaimResponse =>
  claimResponse({
    item: [
      {
        itemSequence: 1,
        adjudication: [],
        extension: codes.map((code) => ({ url: ERA_ITEM_REMARK_CODE_EXTENSION, valueString: code })),
      },
    ],
  });

describe('claimWasForwarded', () => {
  it.each(['19', '20', '21'])('trusts a CLP02 %s "processed and forwarded" status', (code) => {
    expect(
      claimWasForwarded(claimResponse({ extension: [{ url: ERA_STATUS_CODE_EXTENSION, valueString: code }] }))
    ).toBe(true);
  });

  it('reads crossover remarks on the claim or, for keyed remits, on a line', () => {
    expect(
      claimWasForwarded(
        claimResponse({
          extension: [{ url: 'https://extensions.fhir.oystehr.com/era-outpatient-remark-code-1', valueString: 'MA18' }],
        })
      )
    ).toBe(true);
    expect(claimWasForwarded(withLineRemarks(['N89']))).toBe(true);
    expect(claimWasForwarded(withLineRemarks(['MA18']))).toBe(true);
  });

  it('is false for a plain primary adjudication', () => {
    expect(
      claimWasForwarded(claimResponse({ extension: [{ url: ERA_STATUS_CODE_EXTENSION, valueString: '1' }] }))
    ).toBe(false);
    expect(claimWasForwarded(withLineRemarks(['N130']))).toBe(false);
  });
});
