import EmployerDialog from 'src/features/visits/telemed/components/admin/employers/EmployerDialog';
import { defineStory } from '../../harness/story';
import { chargeMaster, employers, feeSchedule, zambda } from './_mocks';

const employerContext = { code: { code: 'program' }, valueReference: { reference: 'Organization/emp-1' } };

export default defineStory({
  title: 'Employer details (edit, inactive employer)',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/employers/EmployerDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Employers → click an inactive employer row',
  notes:
    'Same dialog as the edit story for a deactivated employer: the status chip reads INACTIVE and the extra button is Activate instead of Deactivate.',
  mocks: [
    zambda('list-fee-schedules', [{ ...feeSchedule, useContext: [employerContext] }]),
    zambda('list-charge-masters', [{ ...chargeMaster, useContext: [employerContext] }]),
  ],
  render: () => <EmployerDialog open onClose={() => undefined} employer={{ ...employers[0], active: false }} />,
  play: async ({ screen }) => {
    await screen.findByDisplayValue('Acme Logistics');
  },
});
