import EditEmployeePage from 'src/pages/EditEmployee';
import { defineStory } from '../../harness/story';
import { adminUserMock, zambdaOutput } from './_mocks';

export default defineStory({
  title: 'Delete user (never set up as employee)',
  source: 'apps/ehr/src/pages/EditEmployee.tsx',
  base: 'ConfirmationDialog',
  kind: 'destructive-confirm',
  where: 'Admin → Employees → a "needs review" user → Delete user card → Delete',
  route: '/employee/user-2',
  routePath: '/employee/:id',
  mocks: [
    adminUserMock,
    {
      url: '/get-user/',
      response: zambdaOutput({
        message: 'ok',
        // No Practitioner profile and no roles: the page treats this as a user who needs setup,
        // which is the only state that offers the delete confirmation.
        user: {
          id: 'user-2',
          name: 'jordan.rivera@example.com',
          email: 'jordan.rivera@example.com',
          phoneNumber: '',
          profile: 'Patient/patient-99',
          roles: [],
          licenses: [],
        },
        userScheduleId: undefined,
        seenPatientRecently: false,
      }),
    },
  ],
  render: () => <EditEmployeePage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByTestId('delete-user-button', {}, { timeout: 10000 }));
    await screen.findByText('Delete user?');
  },
  notes: 'get-user zambda mocked with a user that has no Practitioner profile (the "needs review" state).',
});
