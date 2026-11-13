import type { FetchMock } from '../../harness/story';
import { adminUserMock, zambdaOutput } from './_mocks';

export const reportsMocks: FetchMock[] = [
  adminUserMock,
  {
    url: 'list-adhoc-reports',
    response: zambdaOutput({
      reports: [
        {
          id: 'report-1',
          name: 'Visits by location',
          description: 'Weekly count of completed visits for each location, split by visit type.',
          datasetId: 'encounters',
          criteria: { dateRange: 'last-month' },
          request: 'Show weekly completed visits per location split by visit type',
          code: 'return null;',
          title: 'Visits by location',
          runtimeVersion: 3,
          updatedAt: '2026-10-28T14:12:00.000Z',
        },
      ],
    }),
  },
];
