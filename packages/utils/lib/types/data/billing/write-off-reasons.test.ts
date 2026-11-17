import { describe, expect, it } from 'vitest';
import { writeOffReasonLabel } from './write-off-reasons';

describe('writeOffReasonLabel', () => {
  it("uses the label of the write-off party's list when both lists know the code", () => {
    expect(writeOffReasonLabel('patient', 'out-of-network')).toBe('Out-of-Network Courtesy Adjustment');
    expect(writeOffReasonLabel('insurance', 'out-of-network')).toBe('Out-of-Network Write Off');
    expect(writeOffReasonLabel('nio', 'out-of-network')).toBe('Out-of-Network Write Off');
  });

  it("falls back to the other party's list, then to the code itself", () => {
    expect(writeOffReasonLabel('insurance', 'charity')).toBe('Charity or Financial Assistance');
    expect(writeOffReasonLabel('patient', 'not-a-reason')).toBe('not-a-reason');
  });

  it('returns a reason named like an Object member as is, not the inherited member', () => {
    for (const reason of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(writeOffReasonLabel('patient', reason)).toBe(reason);
      expect(writeOffReasonLabel('insurance', reason)).toBe(reason);
    }
  });
});
