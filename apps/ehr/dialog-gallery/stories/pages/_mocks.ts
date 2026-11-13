import type { FetchMock } from '../../harness/story';

/** Answers `oystehr.user.me()` so `useEvolveUser()` resolves to a signed-in administrator. */
export const adminUserMock: FetchMock = {
  url: '/user/me',
  response: {
    id: 'user-admin-1',
    email: 'gallery.user@example.com',
    name: 'Gallery User',
    phoneNumber: '+12025550100',
    profile: 'Practitioner/practitioner-1',
    roles: [{ id: 'role-admin', name: 'Administrator' }],
  },
};

export const zambdaOutput = (output: unknown): { status: number; output: unknown } => ({ status: 200, output });
