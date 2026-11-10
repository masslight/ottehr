import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { validateInput as validateAddInput } from '../../src/rcm/add-payer-to-insurance-override-list';
import {
  editPayerInInsuranceOverrideList,
  validateInput as validateEditInput,
} from '../../src/rcm/edit-payer-in-insurance-override-list';
import { ListName } from '../../src/rcm/get-insurance-override-list/handler';

const overrideList: List = {
  resourceType: 'List',
  id: 'list-1',
  status: 'current',
  mode: 'working',
  meta: { versionId: '1' },
  entry: [
    {
      item: { reference: 'payer/payer-1' },
      extension: [{ url: 'insurance-override-name', valueString: 'Old name' }],
    },
  ],
};

vi.mock('../../src/rcm/get-insurance-override-list/handler', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getInsuranceOverrideList: vi.fn(async () => structuredClone(overrideList)),
}));

const input = (body: unknown): Parameters<typeof validateAddInput>[0] => ({
  body: JSON.stringify(body),
  headers: {},
  secrets: { FHIR_API: 'https://fhir.api' },
});

describe.each([
  ['add-payer-to-insurance-override-list', validateAddInput],
  ['edit-payer-in-insurance-override-list', validateEditInput],
])('%s validateInput', (_name, validateInput) => {
  it.each(['', '   ', '\n'])('rejects the blank EHR note %j', (payerNote) => {
    expect(() => validateInput(input({ listName: ListName.EHR, payerId: 'payer-1', payerNote }))).toThrow();
  });

  it('keeps a non-blank EHR note', () => {
    const { payerInfo } = validateInput(input({ listName: ListName.EHR, payerId: 'payer-1', payerNote: 'Call ahead' }));
    expect(payerInfo).toEqual({ listName: ListName.EHR, payerId: 'payer-1', payerNote: 'Call ahead' });
  });
});

describe('add-payer-to-insurance-override-list validateInput', () => {
  it('drops a whitespace-only patient display name', () => {
    const { payerInfo } = validateAddInput(
      input({ listName: ListName.Patient, payerId: 'payer-1', payerNameOverride: '  ' })
    );
    expect(payerInfo).toEqual({ listName: ListName.Patient, payerId: 'payer-1', payerNameOverride: undefined });
  });
});

describe('edit-payer-in-insurance-override-list validateInput', () => {
  it.each(['', '  ', undefined])(
    'rejects a blank patient display name %j, since a listed payer is shown by its name',
    (payerNameOverride) => {
      expect(() =>
        validateEditInput(input({ listName: ListName.Patient, payerId: 'payer-1', payerNameOverride }))
      ).toThrow();
    }
  );
});

describe('editPayerInInsuranceOverrideList', () => {
  it('adds the name extension even when the stored entry has none, which replace cannot do', async () => {
    const { getInsuranceOverrideList } = await import('../../src/rcm/get-insurance-override-list/handler');
    vi.mocked(getInsuranceOverrideList).mockResolvedValueOnce({
      ...structuredClone(overrideList),
      id: 'list-1',
      entry: [{ item: { reference: 'payer/payer-1' } }],
    });
    const patch = vi.fn(async () => overrideList);
    const oystehr = {
      rcm: { constructPayerUrl: ({ id }: { id: string }) => `payer/${id}` },
      fhir: { patch },
    } as unknown as Oystehr;

    await editPayerInInsuranceOverrideList(oystehr, {
      listName: ListName.Patient,
      payerId: 'payer-1',
      payerNameOverride: 'New name',
    });

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            op: 'add',
            path: '/entry/0/extension',
            value: [{ url: expect.stringContaining('insurance-override-name'), valueString: 'New name' }],
          },
        ],
      }),
      expect.anything()
    );
  });
});
