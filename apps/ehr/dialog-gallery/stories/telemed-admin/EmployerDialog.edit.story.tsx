import EmployerDialog from 'src/features/visits/telemed/components/admin/employers/EmployerDialog';
import { defineStory } from '../../harness/story';
import { chargeMaster, employers, feeSchedule, zambda } from './_mocks';

const employerContext = { code: { code: 'program' }, valueReference: { reference: 'Organization/emp-1' } };

export default defineStory({
  title: 'Employer details (edit)',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/employers/EmployerDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Employers → click an employer row',
  notes:
    'Address and contact sections auto-expand because the mock employer has that data; the Associations accordion is left collapsed (its default).',
  mocks: [
    zambda('list-fee-schedules', [{ ...feeSchedule, useContext: [employerContext] }]),
    zambda('list-charge-masters', [{ ...chargeMaster, useContext: [employerContext] }]),
  ],
  render: () => <EmployerDialog open onClose={() => undefined} employer={employers[0]} />,
  play: async ({ screen }) => {
    await screen.findByDisplayValue('Acme Logistics');
  },
});
