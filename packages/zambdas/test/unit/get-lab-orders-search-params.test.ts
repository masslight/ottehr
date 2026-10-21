import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Resource } from 'fhir/r4b';
import { describe, expect, test, vi } from 'vitest';
import {
  createLabServiceRequestFilterParams,
  createLabServiceRequestIncludeParams,
  fetchLabOrderResources,
} from '../../src/ehr/lab/external/get-lab-orders/helpers';
import { GetZambdaLabOrdersParams } from '../../src/ehr/lab/external/get-lab-orders/validateRequestParameters';

const isInclude = (param: SearchParam): boolean =>
  param.name.startsWith('_include') || param.name.startsWith('_revinclude');

const makeParams = (searchBy: GetZambdaLabOrdersParams['searchBy']): GetZambdaLabOrdersParams => ({
  searchBy,
  itemsPerPage: 100,
  pageIndex: 0,
  secrets: {},
});

const fakeBundle = (resources: Resource[]): { unbundle: () => Resource[]; total: number; link: [] } => ({
  unbundle: () => resources,
  total: resources.length,
  link: [],
});

describe('get-lab-orders search params', () => {
  test('filter params carry no includes', () => {
    const params = createLabServiceRequestFilterParams(makeParams({ field: 'encounterId', value: 'enc-1' }));
    expect(params.some(isInclude)).toBe(false);
    expect(params).toContainEqual({ name: 'encounter', value: 'Encounter/enc-1' });
  });

  test('include params no longer pull in result Observations', () => {
    const params = createLabServiceRequestIncludeParams({ field: 'patientId', value: 'pat-1' });
    expect(params.every(isInclude)).toBe(true);
    expect(params.map((p) => p.value)).not.toContain('DiagnosticReport:result');
  });

  test('page-specific includes are kept', () => {
    const encounterIncludes = createLabServiceRequestIncludeParams({ field: 'encounterId', value: 'enc-1' });
    expect(encounterIncludes).toContainEqual({ name: '_revinclude', value: 'Communication:based-on' });

    const detailIncludes = createLabServiceRequestIncludeParams({ field: 'serviceRequestId', value: 'sr-1' });
    expect(detailIncludes).toContainEqual({ name: '_include', value: 'ServiceRequest:performer' });
    expect(detailIncludes).toContainEqual({ name: '_revinclude', value: 'QuestionnaireResponse:based-on' });
  });
});

describe('fetchLabOrderResources', () => {
  test('fetches a list page as ids, then its includes in chunks, without repeating shared resources', async () => {
    const srIds = Array.from({ length: 25 }, (_, i) => `sr-${i}`);
    const search = vi.fn(async ({ params }: { params: SearchParam[] }) => {
      if (params.some((p) => p.name === '_elements')) {
        return fakeBundle(srIds.map((id) => ({ resourceType: 'ServiceRequest', id })));
      }
      const chunkIds = String(params.find((p) => p.name === '_id')?.value).split(',');
      return fakeBundle([
        ...chunkIds.map((id) => ({ resourceType: 'ServiceRequest', id }) as Resource),
        { resourceType: 'Patient', id: 'pat-1' },
      ]);
    });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    const { resources } = await fetchLabOrderResources(oystehr, makeParams({ field: 'patientId', value: 'pat-1' }));

    // 1 id-only page query + 3 chunks of at most 10
    expect(search).toHaveBeenCalledTimes(4);
    expect(search.mock.calls[0][0].params.some(isInclude)).toBe(false);
    expect(resources.filter((r) => r.resourceType === 'ServiceRequest').map((r) => r.id)).toEqual(srIds);
    expect(resources.filter((r) => r.resourceType === 'Patient')).toHaveLength(1);
  });

  test('fetches the detail page in a single search', async () => {
    const search = vi.fn(async () => fakeBundle([{ resourceType: 'ServiceRequest', id: 'sr-1' }]));
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    await fetchLabOrderResources(oystehr, makeParams({ field: 'serviceRequestId', value: 'sr-1' }));

    expect(search).toHaveBeenCalledTimes(1);
    expect((search.mock.calls[0] as any)[0].params.some(isInclude)).toBe(true);
  });
});
