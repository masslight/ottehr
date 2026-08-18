import Oystehr from '@oystehr/sdk';
import { describe, expect, it, vi } from 'vitest';
import { getProcedureCodeTitle } from '../../../src/shared/statements/get-procedure-code-title';

interface TerminologyCode {
  code: string;
  display: string;
}

const terminologyStub = (
  cptCodes: TerminologyCode[] = [],
  hcpcsCodes: TerminologyCode[] = []
): {
  oystehr: Oystehr;
  searchCpt: ReturnType<typeof vi.fn>;
  searchHcpcs: ReturnType<typeof vi.fn>;
} => {
  const searchCpt = vi.fn().mockResolvedValue({ codes: cptCodes });
  const searchHcpcs = vi.fn().mockResolvedValue({ codes: hcpcsCodes });
  return {
    oystehr: {
      terminology: {
        searchCpt,
        searchHcpcs,
      },
    } as unknown as Oystehr,
    searchCpt,
    searchHcpcs,
  };
};

describe('getProcedureCodeTitle', () => {
  it('uses the display the caller already holds instead of asking the terminology service', async () => {
    const { oystehr, searchCpt, searchHcpcs } = terminologyStub();

    const title = await getProcedureCodeTitle({
      code: '99203',
      display: 'Office visit, new patient',
      oystehr,
    });

    expect(title).toBe('99203 - Office visit, new patient');
    expect(searchCpt).not.toHaveBeenCalled();
    expect(searchHcpcs).not.toHaveBeenCalled();
  });

  it('looks the code up when the caller has no display', async () => {
    const { oystehr } = terminologyStub([
      {
        code: '99203',
        display: 'Office o/p new low',
      },
    ]);

    expect(
      await getProcedureCodeTitle({
        code: '99203',
        oystehr,
      })
    ).toBe('99203 - Office o/p new low');
  });

  it('falls back to hcpcs, then to the bare code', async () => {
    const withHcpcs = terminologyStub(
      [],
      [
        {
          code: 'A4206',
          display: 'Syringe with needle, sterile, 1 cc or less',
        },
      ]
    );
    const withNothing = terminologyStub();

    expect(
      await getProcedureCodeTitle({
        code: 'A4206',
        oystehr: withHcpcs.oystehr,
      })
    ).toBe('A4206 - Syringe with needle, sterile, 1 cc or less');
    expect(
      await getProcedureCodeTitle({
        code: 'A4206',
        oystehr: withNothing.oystehr,
      })
    ).toBe('A4206');
  });

  it('returns nothing for a line carrying no procedure code', async () => {
    const { oystehr, searchCpt } = terminologyStub();

    expect(
      await getProcedureCodeTitle({
        code: '',
        oystehr,
      })
    ).toBe('');
    expect(searchCpt).not.toHaveBeenCalled();
  });
});
