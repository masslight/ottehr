import { GenerateExcuseDialog } from 'src/features/visits/shared/components/plan-tab/components/GenerateExcuseDialog';
import { defineStory } from '../../harness/story';
import { visitMocks, visitRoute } from './_visit';
import { VisitReady } from './_VisitReady';

export default defineStory({
  title: 'Generate Work excuse (from template)',
  source: 'apps/ehr/src/features/visits/shared/components/plan-tab/components/GenerateExcuseDialogContainer.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Visit → Plan tab → School / Work Excuse card → generate',
  ...visitRoute,
  mocks: visitMocks(),
  notes:
    'Shell (title, dividers, Cancel / Generate note) is GenerateExcuseDialogContainer.tsx; the form body is its only caller, plan-tab/components/GenerateExcuseDialog.tsx (type="workTemplate"), rendered here for real against a mock visit (mounted once the visit has loaded, since the form reads patient/provider names at mount).',
  render: () => (
    <VisitReady>
      <GenerateExcuseDialog
        open
        onClose={() => undefined}
        type="workTemplate"
        generate={(() => undefined) as never}
        supportPhoneNumber="(212) 555-0100"
      />
    </VisitReady>
  ),
  play: async ({ screen }) => {
    await screen.findByRole('dialog', undefined, { timeout: 10000 });
  },
});
