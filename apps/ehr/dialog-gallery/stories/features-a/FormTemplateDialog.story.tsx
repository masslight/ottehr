import { FormTemplateDialog } from 'src/features/form-templates/FormTemplateDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'New form template (upload PDF)',
  source: 'apps/ehr/src/features/form-templates/FormTemplateDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Form Templates → "New template"',
  render: () => <FormTemplateDialog open onClose={() => undefined} />,
  play: async ({ user, screen }) => {
    await user.type(await screen.findByLabelText(/Title/), 'Work excuse note');
    await user.type(screen.getByLabelText('Description'), 'Signed by the provider at discharge.');
  },
  notes: 'Title and description typed in; no PDF chosen (file input cannot be driven from the story).',
});
