import Oystehr from '@oystehr/sdk';
import { Medication } from 'fhir/r4b';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compareNdcProduct,
  fetchNdcProduct,
  ndcPackageCandidates,
  NdcProduct,
  OpenFdaNdcResult,
} from '../../src/ehr/configuration/in-house-medications/lookup-ndc/helpers';
import { performEffect } from '../../src/ehr/configuration/in-house-medications/lookup-ndc/index';

vi.mock('@sentry/node-core/light', () => ({ captureException: vi.fn() }));

const catalog: Medication = {
  resourceType: 'Medication',
  id: 'med-catalog',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ondansetron HCl Injection Solution 4 MG/2ML' },
  ],
  status: 'active',
  code: {
    coding: [
      { system: CODE_SYSTEM_NDC, code: '0409-1234-01' },
      { system: MEDICATION_DISPENSABLE_DRUG_ID, code: '12345' },
    ],
  },
};

const ondansetronResult: OpenFdaNdcResult = {
  product_ndc: '72572-160',
  generic_name: 'Ondansetron',
  brand_name: 'Ondansetron',
  labeler_name: 'Civica, Inc.',
  dosage_form: 'INJECTION, SOLUTION',
  active_ingredients: [{ name: 'ONDANSETRON HYDROCHLORIDE', strength: '4 mg/2mL' }],
  packaging: [{ package_ndc: '72572-160-25', description: '25 VIAL in 1 CARTON / 2 mL in 1 VIAL' }],
  openfda: { rxcui: ['312086'] },
};

const morphineResult: OpenFdaNdcResult = {
  product_ndc: '0409-1966',
  generic_name: 'Morphine sulfate',
  brand_name: 'Morphine sulfate',
  labeler_name: 'Hospira, Inc.',
  dosage_form: 'INJECTION, SOLUTION',
  active_ingredients: [{ name: 'MORPHINE SULFATE', strength: '4 mg/mL' }],
  packaging: [{ package_ndc: '0409-1966-25', description: '25 CARPUJECT in 1 CARTON' }],
  openfda: { rxcui: ['892602'] },
};

const fdaResponse = (results: OpenFdaNdcResult[]): Response =>
  ({ ok: true, status: 200, json: async () => ({ results }) }) as Response;
const fdaNotFound = (): Response =>
  ({ ok: false, status: 404, json: async () => ({ error: { code: 'NOT_FOUND' } }) }) as Response;

describe('ndcPackageCandidates', () => {
  it('keeps a hyphenated 10-digit package NDC as typed', () => {
    expect(ndcPackageCandidates(' 72572-160-25 ')).toEqual(['72572-160-25']);
    expect(ndcPackageCandidates('0409-1966-25')).toEqual(['0409-1966-25']);
    expect(ndcPackageCandidates('12345-1234-1')).toEqual(['12345-1234-1']);
  });

  it('tries every split of unhyphenated 10 digits', () => {
    expect(ndcPackageCandidates('7257216025')).toEqual(['7257-2160-25', '72572-160-25', '72572-1602-5']);
  });

  it('drops the padding zero every way it could sit in an 11-digit billing NDC', () => {
    expect(ndcPackageCandidates('72572016025')).toEqual(['72572-160-25']);
    expect(ndcPackageCandidates('72572-0160-25')).toEqual(['72572-160-25']);
    expect(ndcPackageCandidates('00409-1966-25')).toEqual(['0409-1966-25']);
    expect(ndcPackageCandidates('00000-0000-01')).toEqual(['0000-0000-01', '00000-000-01', '00000-0000-1']);
  });

  it('returns nothing for something that is not a package NDC', () => {
    expect(ndcPackageCandidates('')).toEqual([]);
    expect(ndcPackageCandidates('123')).toEqual([]);
    expect(ndcPackageCandidates('72572-160')).toEqual([]);
    expect(ndcPackageCandidates('1-2-3-4')).toEqual([]);
  });
});

describe('fetchNdcProduct', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('searches openFDA by every candidate and shapes the product', async () => {
    fetchMock.mockResolvedValue(fdaResponse([ondansetronResult]));
    const product = await fetchNdcProduct(['7257-2160-25', '72572-160-25', '72572-1602-5']);

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://api.fda.gov/drug/ndc.json');
    expect(url.searchParams.get('search')).toBe('package_ndc:("7257-2160-25" OR "72572-160-25" OR "72572-1602-5")');
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(product).toEqual({
      packageNdc: '72572-160-25',
      name: 'Ondansetron 4 mg/2mL injection, solution',
      genericName: 'Ondansetron',
      brandName: 'Ondansetron',
      manufacturer: 'Civica, Inc.',
      packageDescription: '25 VIAL in 1 CARTON / 2 mL in 1 VIAL',
      rxcuis: ['312086'],
    });
  });

  it('shows the brand name with the generic when they differ', async () => {
    fetchMock.mockResolvedValue(fdaResponse([{ ...ondansetronResult, brand_name: 'Zofran' }]));
    expect((await fetchNdcProduct(['72572-160-25']))?.name).toBe('Zofran (Ondansetron) 4 mg/2mL injection, solution');
  });

  it('returns undefined when the directory has no such package, and skips the call for no candidates', async () => {
    fetchMock.mockResolvedValue(fdaNotFound());
    expect(await fetchNdcProduct(['72572-160-99'])).toBeUndefined();
    expect(await fetchNdcProduct([])).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on other failures so the caller can report the lookup as unavailable', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(fetchNdcProduct(['72572-160-25'])).rejects.toThrow('503');
    fetchMock.mockRejectedValue(Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }));
    await expect(fetchNdcProduct(['72572-160-25'])).rejects.toThrow('aborted');
  });
});

describe('compareNdcProduct', () => {
  const product = (result: OpenFdaNdcResult): NdcProduct => ({
    packageNdc: result.packaging?.[0]?.package_ndc ?? '',
    name: result.generic_name ?? '',
    genericName: result.generic_name,
    brandName: result.brand_name,
    manufacturer: result.labeler_name,
    packageDescription: result.packaging?.[0]?.description,
    rxcuis: result.openfda?.rxcui ?? [],
  });

  it('compares by name when the catalog drug has no RxCUI', () => {
    expect(compareNdcProduct(product(ondansetronResult), catalog)).toEqual({ status: 'match', comparedBy: 'name' });
    expect(compareNdcProduct(product(morphineResult), catalog)).toEqual({ status: 'mismatch', comparedBy: 'name' });
  });

  it('matches a box whose product NDC equals the catalog drug NDC even when the names differ', () => {
    const zofran = product({
      ...morphineResult,
      product_ndc: '0409-1234',
      packaging: [{ package_ndc: '0409-1234-25' }],
    });
    expect(compareNdcProduct(zofran, catalog).status).toBe('match');
  });

  it('needs every ingredient of a combination to be in the catalog name', () => {
    const combo = product({ ...ondansetronResult, generic_name: 'Amoxicillin and Clavulanate Potassium' });
    expect(compareNdcProduct(combo, catalog).status).toBe('mismatch');
    const amoxClav: Medication = {
      ...catalog,
      identifier: [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Amoxicillin-Clavulanate 875-125 mg tablet' }],
    };
    expect(compareNdcProduct(combo, amoxClav).status).toBe('match');
  });

  it('compares by RxCUI when the catalog drug carries one', () => {
    const withRxcui: Medication = {
      ...catalog,
      code: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '312086' }] },
    };
    expect(compareNdcProduct(product(ondansetronResult), withRxcui)).toEqual({ status: 'match', comparedBy: 'rxcui' });
    expect(compareNdcProduct(product({ ...ondansetronResult, openfda: { rxcui: ['999'] } }), withRxcui)).toEqual({
      status: 'mismatch',
      comparedBy: 'rxcui',
    });
  });
});

describe('lookup-ndc - performEffect', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const oystehr = { fhir: { get: vi.fn().mockResolvedValue(catalog) } } as unknown as Oystehr;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns match with the product', async () => {
    fetchMock.mockResolvedValue(fdaResponse([ondansetronResult]));
    const result = await performEffect(oystehr, { ndc: '72572-0160-25', medicationId: 'med-catalog' });
    expect(result.status).toBe('match');
    expect(result.comparedBy).toBe('name');
    expect(result.product?.manufacturer).toBe('Civica, Inc.');
  });

  it('returns mismatch for a different drug', async () => {
    fetchMock.mockResolvedValue(fdaResponse([morphineResult]));
    const result = await performEffect(oystehr, { ndc: '0409-1966-25', medicationId: 'med-catalog' });
    expect(result.status).toBe('mismatch');
    expect(result.product?.name).toContain('Morphine');
  });

  it('returns not-found for an unknown or malformed NDC', async () => {
    fetchMock.mockResolvedValue(fdaNotFound());
    expect((await performEffect(oystehr, { ndc: '72572-160-99', medicationId: 'med-catalog' })).status).toBe(
      'not-found'
    );
    expect((await performEffect(oystehr, { ndc: 'abc', medicationId: 'med-catalog' })).status).toBe('not-found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns unavailable instead of failing when openFDA is down or slow', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    expect((await performEffect(oystehr, { ndc: '72572-160-25', medicationId: 'med-catalog' })).status).toBe(
      'unavailable'
    );
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    expect((await performEffect(oystehr, { ndc: '72572-160-25', medicationId: 'med-catalog' })).status).toBe(
      'unavailable'
    );
  });

  it('rejects a Medication that is not a catalog drug', async () => {
    const notCatalog = {
      fhir: { get: vi.fn().mockResolvedValue({ ...catalog, identifier: [] }) },
    } as unknown as Oystehr;
    await expect(performEffect(notCatalog, { ndc: '72572-160-25', medicationId: 'x' })).rejects.toMatchObject({
      code: expect.any(Number),
    });
  });
});
