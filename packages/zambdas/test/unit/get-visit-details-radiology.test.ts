import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { encodeRadiologyReport } from 'utils/lib/fhir/radiology';
import { GetRadiologyOrderListZambdaOrder, RadiologyOrderStatus } from 'utils/lib/types/api/radiology';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRadiologyOrders = vi.fn();
const mockSearchRadiologyResultDocRefs = vi.fn();
const mockGetPresignedURL = vi.fn();

vi.mock('../../src/ehr/radiology/order-list', () => ({
  getRadiologyOrders: (...args: unknown[]) => mockGetRadiologyOrders(...args),
}));
vi.mock('../../src/ehr/radiology/shared/result-doc-refs', () => ({
  searchRadiologyResultDocRefs: (...args: unknown[]) => mockSearchRadiologyResultDocRefs(...args),
}));
vi.mock('utils/lib/helpers/presigned-file-url/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/lib/helpers/presigned-file-url/helpers')>()),
  getPresignedURL: (...args: unknown[]) => mockGetPresignedURL(...args),
}));

import { getReviewedRadiologyResults } from '../../src/patient/appointment/get-visit-details/helpers';

const oystehr = {} as Oystehr;
const secrets = { PROJECT_ID: 'project-1', PROJECT_API: 'https://project.api' };
const ENCOUNTER_ID = 'encounter-1';

const order = (overrides: Partial<GetRadiologyOrderListZambdaOrder>): GetRadiologyOrderListZambdaOrder =>
  ({
    serviceRequestId: 'sr-1',
    studyType: '73600 — Ankle, left, 2 views',
    status: RadiologyOrderStatus.reviewed,
    ...overrides,
  }) as GetRadiologyOrderListZambdaOrder;

describe('getReviewedRadiologyResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the final read of reviewed in-house orders as plain text and skips the rest', async () => {
    mockGetRadiologyOrders.mockResolvedValue({
      orders: [
        order({ finalReport: encodeRadiologyReport('No acute fracture.\nSoft tissues normal.') }),
        order({ serviceRequestId: 'sr-2', status: RadiologyOrderStatus.final, finalReport: 'unreviewed' }),
        order({ serviceRequestId: 'sr-3', status: RadiologyOrderStatus.pending }),
      ],
    });

    const results = await getReviewedRadiologyResults(oystehr, 'token', secrets, ENCOUNTER_ID);

    expect(mockGetRadiologyOrders).toHaveBeenCalledWith(oystehr, { encounterIds: [ENCOUNTER_ID] });
    expect(mockSearchRadiologyResultDocRefs).not.toHaveBeenCalled();
    expect(results).toEqual([
      { studyType: '73600 — Ankle, left, 2 views', report: 'No acute fracture.\nSoft tissues normal.', files: [] },
    ]);
  });

  it('returns presigned result files for reviewed external orders', async () => {
    const z3Url = 'https://project.api/z3/project-1-radiology/patient-1/result.pdf';
    const docRef: DocumentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      content: [{ attachment: { url: z3Url, title: 'MRI result.pdf' } }],
    };
    mockGetRadiologyOrders.mockResolvedValue({ orders: [order({ external: true })] });
    mockSearchRadiologyResultDocRefs.mockResolvedValue([docRef]);
    mockGetPresignedURL.mockResolvedValue('https://presigned.example/result.pdf');

    const results = await getReviewedRadiologyResults(oystehr, 'token', secrets, ENCOUNTER_ID);

    expect(mockSearchRadiologyResultDocRefs).toHaveBeenCalledWith('sr-1', oystehr);
    expect(mockGetPresignedURL).toHaveBeenCalledWith(z3Url, 'token');
    expect(results).toEqual([
      {
        studyType: '73600 — Ankle, left, 2 views',
        report: '',
        files: [{ presignedUrl: 'https://presigned.example/result.pdf', description: 'MRI result.pdf' }],
      },
    ]);
  });
});
