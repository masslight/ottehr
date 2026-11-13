import type { FetchMock } from '../../harness/story';
import { mockLocation, userMocks } from './shared-mocks';

export const locationConfigMocks: FetchMock[] = [
  ...userMocks,
  { url: 'get-location', response: { status: 200, output: { location: mockLocation, schedules: [] } } },
];
