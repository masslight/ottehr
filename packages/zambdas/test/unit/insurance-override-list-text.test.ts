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

  it('drops a whitespace-only patient display name', () => {
    const { payerInfo } = validateInput(
      input({ listName: ListName.Patient, payerId: 'payer-1', payerNameOverride: '  ' })
    );
    expect(payerInfo).toEqual({ listName: ListName.Patient, payerId: 'payer-1', payerNameOverride: undefined });
  });

  it('keeps a non-blank EHR note', () => {
    const { payerInfo } = validateInput(input({ listName: ListName.EHR, payerId: 'payer-1', payerNote: 'Call ahead' }));
    expect(payerInfo).toEqual({ listName: ListName.EHR, payerId: 'payer-1', payerNote: 'Call ahead' });
  });
});

describe('editPayerInInsuranceOverrideList', () => {
  it('replaces the entry extension with an empty array when the display name is cleared', async () => {
    const patch = vi.fn(async () => overrideList);
    const oystehr = {
      rcm: { constructPayerUrl: ({ id }: { id: string }) => `payer/${id}` },
      fhir: { patch },
    } as unknown as Oystehr;

    await editPayerInInsuranceOverrideList(oystehr, {
      listName: ListName.Patient,
      payerId: 'payer-1',
      payerNameOverride: undefined,
    });

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [{ op: 'replace', path: '/entry/0/extension', value: [] }],
      }),
      expect.anything()
    );
  });
});
