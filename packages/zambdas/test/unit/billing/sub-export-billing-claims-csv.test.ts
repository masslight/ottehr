import { Claim, Resource, Task } from 'fhir/r4b';
import { EXPORT_CSV_OUTPUT_URL_CODE } from 'utils/lib/types/api/invoicing.types';
import {
  CLAIM_TAG_SYSTEM,
  EXPORT_CLAIMS_FILTERS_CODE,
  EXPORT_CLAIMS_INCOMPLETE_CODE,
  EXPORT_CLAIMS_MATCH_LIMIT,
} from 'utils/lib/types/data/billing/billing.constants';
import { ExportBillingClaimsInput } from 'utils/lib/types/data/billing/billing.schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAIM_SEARCH_TEXT_MATCH_LIMIT } from '../../../src/billing/claim-search';

const mockOystehrClient = {
  fhir: {
    search: vi.fn(),
    patch: vi.fn(),
  },
  rcm: {
    listPayers: vi.fn(),
    getPayerByUrl: vi.fn(),
  },
  z3: {
    uploadFile: vi.fn(),
  },
};

vi.mock('../../../src/shared/auth', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkOrCreateM2MClientToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../../src/billing/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createBillingClient: vi.fn(() => mockOystehrClient),
  };
});

type TaskHandler = (
  input: { task: Task; secrets: Record<string, string> },
  oystehr: unknown
) => Promise<{ taskStatus: string; statusReason?: string }>;

let capturedHandler!: TaskHandler;

vi.mock('../../../src/subscriptions/task/helpers', () => ({
  wrapTaskHandler: (_name: string, fn: TaskHandler) => {
    capturedHandler = fn;
    return fn;
  },
}));

const secrets = {
  PROJECT_ID: 'proj',
  PROJECT_API: 'https://project.api',
};

const bundleOf = (resources: Resource[], total = resources.length): any => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total,
  entry: resources.map((resource) => ({
    resource,
    search: {
      mode: resource.resourceType === 'Claim' ? 'match' : 'include',
    },
  })),
  unbundle: () => resources,
});

const makeClaim = (id: string, overrides?: Record<string, unknown>): Claim =>
  ({
    resourceType: 'Claim',
    id,
    status: 'active',
    created: '2026-01-15',
    type: {
      coding: [],
    },
    patient: {
      reference: 'Patient/pat-1',
    },
    insurance: [],
    total: {
      value: 250.5,
      currency: 'USD',
    },
    meta: {
      tag: [
        {
          system: CLAIM_TAG_SYSTEM,
          code: 'rebill',
        },
      ],
    },
    ...overrides,
  }) as unknown as Claim;

const servicedOn = (id: string, servicedDate: string): Claim =>
  makeClaim(id, {
    item: [
      {
        sequence: 1,
        servicedDate,
      },
    ],
  });

const patient = {
  resourceType: 'Patient',
  id: 'pat-1',
  birthDate: '1990-01-01',
  name: [
    {
      family: 'Doe',
      given: ['Jane'],
    },
  ],
} as Resource;

const makeTask = (filters: ExportBillingClaimsInput): Task =>
  ({
    resourceType: 'Task',
    id: 'task-1',
    status: 'requested',
    input: [
      {
        type: {
          coding: [
            {
              code: EXPORT_CLAIMS_FILTERS_CODE,
            },
          ],
        },
        valueString: JSON.stringify(filters),
      },
    ],
  }) as Task;

// Claim searches arrive in three shapes: the paged export search, the search-text clause searches
// (_elements) and the by-id hydration (_id).
const stubSearches = ({
  claimPages = [] as Resource[][],
  searchTextMatches = [] as Claim[],
  searchTextTotal,
  hydrated = [] as Resource[],
}: {
  claimPages?: Resource[][];
  searchTextMatches?: Claim[];
  searchTextTotal?: number;
  hydrated?: Resource[];
}): void => {
  const pages = [...claimPages];
  const claimTotal = claimPages.flat().filter((resource) => resource.resourceType === 'Claim').length;
  mockOystehrClient.fhir.search.mockImplementation(async ({ resourceType, params }: any) => {
    const named = (name: string): string | undefined => params?.find((param: any) => param.name === name)?.value;
    if (resourceType !== 'Claim') return bundleOf([]);
    if (named('_elements')) return bundleOf(searchTextMatches, searchTextTotal ?? searchTextMatches.length);
    if (named('_id')) {
      if (hydrated.length > 0) return bundleOf(hydrated);
      return bundleOf([
        ...named('_id')!
          .split(',')
          .map((id) => makeClaim(id)),
        patient,
      ]);
    }
    return pages.length > 0 ? bundleOf(pages.shift()!, claimTotal) : bundleOf([], 0);
  });
};

const claimSearches = (): any[] =>
  mockOystehrClient.fhir.search.mock.calls.filter(([arg]) => arg.resourceType === 'Claim').map(([arg]) => arg);

const uploadedCsv = async (): Promise<string> => {
  const [{ file }] = mockOystehrClient.z3.uploadFile.mock.calls[0];
  return file.text();
};

const csvRows = async (): Promise<string[]> => (await uploadedCsv()).split('\n');

const taskOutputs = (): any[] => mockOystehrClient.fhir.patch.mock.calls[0][0].operations[0].value;

const outputValue = (code: string): string | undefined =>
  taskOutputs().find((output) => output.type.coding.some((coding: any) => coding.code === code))?.valueString;

describe('sub-export-billing-claims-csv', () => {
  let exportPageSize: number;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockOystehrClient.z3.uploadFile.mockResolvedValue(undefined);
    mockOystehrClient.fhir.patch.mockResolvedValue({});
    ({ EXPORT_PAGE_SIZE: exportPageSize } = await import(
      '../../../src/subscriptions/task/sub-export-billing-claims-csv/index'
    ));
  });

  const runExport = (task: Task): ReturnType<TaskHandler> =>
    capturedHandler(
      {
        task,
        secrets,
      },
      {}
    );

  it('writes one row per matched claim, in the shape a spreadsheet can work with', async () => {
    stubSearches({ claimPages: [[makeClaim('claim-1'), patient]] });

    const result = await runExport(makeTask({}));

    const [headers, row, ...rest] = await csvRows();
    expect(rest).toHaveLength(0);
    // The identifiers the claims list has no room for lead the export.
    expect(headers.startsWith('Claim ID,Patient Name,Patient DOB,Service Date,Payer Name,Payer ID,Member ID')).toBe(
      true
    );
    expect(headers).toContain('AR Stage');
    expect(row).toContain('claim-1');
    expect(row).toContain('1990-01-01');
    // A name carrying a comma has to survive as one field.
    expect(row).toContain('"Doe, Jane"');
    // Amounts are plain numbers, not display currency.
    expect(row).toContain('250.50');
    expect(row).not.toContain('$');
    expect(row).toContain('rebill');
    expect(result).toEqual({
      taskStatus: 'completed',
      statusReason: 'Exported 1 claim(s)',
    });
  });

  it('keeps paging until every matched claim is exported', async () => {
    const firstPage = Array.from({ length: exportPageSize }, (_, index) => makeClaim(`claim-${index}`));
    stubSearches({
      claimPages: [
        [...firstPage, patient],
        [makeClaim('claim-last'), patient],
      ],
    });

    await runExport(makeTask({}));

    const rows = await csvRows();
    expect(rows).toHaveLength(exportPageSize + 2);
    expect(rows[rows.length - 1]).toContain('claim-last');
    expect(claimSearches()).toHaveLength(2);
    expect(claimSearches()[1].params).toContainEqual({
      name: '_offset',
      value: String(exportPageSize),
    });
  });

  // A recency sort would reshuffle the pages every time a claim is edited mid-export.
  it('pages by a sort that cannot shift while the export runs', async () => {
    stubSearches({ claimPages: [[makeClaim('claim-1'), patient]] });

    await runExport(makeTask({}));

    expect(claimSearches()[0].params).toContainEqual({
      name: '_sort',
      value: '_id',
    });
  });

  // A clause that overflows the match limit should give up the same claims the list would.
  it('leaves search text clauses on the order the claims list uses', async () => {
    stubSearches({ searchTextMatches: [makeClaim('claim-1')] });

    await runExport(makeTask({ searchText: 'Smith' }));

    expect(claimSearches()[0].params).toContainEqual({
      name: '_sort',
      value: '-_lastUpdated',
    });
  });

  it('writes a claim once even if it comes back on two pages', async () => {
    stubSearches({
      claimPages: [
        [makeClaim('claim-1'), makeClaim('claim-2'), patient],
        [makeClaim('claim-2'), makeClaim('claim-3'), patient],
      ],
    });

    await runExport(makeTask({}));

    const rows = await csvRows();
    expect(rows).toHaveLength(4);
    expect(rows.filter((row) => row.includes('claim-2'))).toHaveLength(1);
  });

  // Paging on past the limit would run the lambda out of time and leave the Task stuck in-progress.
  it('stops at the row limit and flags the CSV as partial', async () => {
    const overLimit = Array.from({ length: EXPORT_CLAIMS_MATCH_LIMIT + 1 }, (_, index) => makeClaim(`claim-${index}`));
    stubSearches({ claimPages: [[...overLimit, patient]] });

    await runExport(makeTask({}));

    expect(await csvRows()).toHaveLength(EXPORT_CLAIMS_MATCH_LIMIT + 1);
    expect(outputValue(EXPORT_CLAIMS_INCOMPLETE_CODE)).toBe('true');
  });

  it('stops a search-text export at the row limit too', async () => {
    stubSearches({
      searchTextMatches: Array.from({ length: EXPORT_CLAIMS_MATCH_LIMIT + 1 }, (_, index) =>
        makeClaim(`claim-${index}`)
      ),
    });

    await runExport(makeTask({ searchText: 'Smith' }));

    expect(await csvRows()).toHaveLength(EXPORT_CLAIMS_MATCH_LIMIT + 1);
    expect(outputValue(EXPORT_CLAIMS_INCOMPLETE_CODE)).toBe('true');
  });

  it('uploads the CSV to the billing export bucket and records where it went', async () => {
    stubSearches({ claimPages: [[makeClaim('claim-1'), patient]] });

    await runExport(makeTask({}));

    expect(mockOystehrClient.z3.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        bucketName: 'proj-billing-claim-exports',
        'objectPath+': 'billing-claims-export-task-1.csv',
      })
    );
    expect(outputValue(EXPORT_CSV_OUTPUT_URL_CODE)).toBe(
      'https://project.api/z3/proj-billing-claim-exports/billing-claims-export-task-1.csv'
    );
    expect(outputValue(EXPORT_CLAIMS_INCOMPLETE_CODE)).toBe('false');
  });

  // Falling through to an unfiltered search here would hand the biller every claim in the project.
  it('exports nothing when the payer name matches no payer', async () => {
    stubSearches({ claimPages: [[makeClaim('claim-1'), patient]] });
    mockOystehrClient.rcm.listPayers.mockResolvedValue({ data: [] });

    await runExport(makeTask({ payerName: 'Nonexistent Health' }));

    expect(await csvRows()).toHaveLength(1);
    expect(claimSearches()).toHaveLength(0);
  });

  it('flags an export whose search could not see every match', async () => {
    stubSearches({
      searchTextMatches: [makeClaim('claim-1')],
      searchTextTotal: CLAIM_SEARCH_TEXT_MATCH_LIMIT + 1,
      hydrated: [makeClaim('claim-1'), patient],
    });

    await runExport(makeTask({ searchText: 'Smith' }));

    expect(await csvRows()).toHaveLength(2);
    expect(outputValue(EXPORT_CLAIMS_INCOMPLETE_CODE)).toBe('true');
  });

  it('drops claims outside the service date range', async () => {
    stubSearches({
      claimPages: [[servicedOn('in-range', '2026-01-15'), servicedOn('out-of-range', '2026-03-01'), patient]],
    });

    await runExport(
      makeTask({
        serviceDateFrom: '2026-01-01',
        serviceDateTo: '2026-01-31',
      })
    );

    const csv = await uploadedCsv();
    expect(csv).toContain('in-range');
    expect(csv).not.toContain('out-of-range');
  });

  it('refuses a Task carrying filters the claims list would not accept', async () => {
    stubSearches({ claimPages: [[makeClaim('claim-1'), patient]] });

    await expect(runExport(makeTask({ type: 'dental' } as unknown as ExportBillingClaimsInput))).rejects.toBeDefined();
    expect(mockOystehrClient.z3.uploadFile).not.toHaveBeenCalled();
  });
});
