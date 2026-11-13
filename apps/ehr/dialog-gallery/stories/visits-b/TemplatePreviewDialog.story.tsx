import { TemplatePreviewDialog } from 'src/features/visits/shared/components/templates/TemplatePreviewDialog';
import { defineStory } from '../../harness/story';
import { templateDetailMock } from './_templates';
import { visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'Apply template: preview and per-section merge options',
  source: 'apps/ehr/src/features/visits/shared/components/templates/TemplatePreviewDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Visit → template picker ("Select condition") → choose a template; also AutoChart template suggestion',
  ...visitRoute,
  mocks: visitMocks({ extra: [templateDetailMock] }),
  notes:
    'Mock template with HPI, ROS, exam, MDM, diagnosis, instructions, CPT and E&M sections; no lab / procedure / medication plans, so the external-lab payment controls are not shown. Section cards are in their default collapsed state.',
  render: () => (
    <TemplatePreviewDialog
      open
      templateId="tmpl-1"
      templateName="Strep Pharyngitis"
      isApplying={false}
      onCancel={() => undefined}
      onApply={() => undefined}
    />
  ),
  play: async ({ screen }) => {
    await screen.findByRole('button', { name: 'Apply Template' }, { timeout: 10000 });
    await screen.findAllByText(/J02\.0/, undefined, { timeout: 10000 });
  },
});
