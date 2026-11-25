import { FormTemplateActionsBar } from 'src/features/form-templates/FormTemplateActionsBar';
import { FormTemplateItem } from 'utils/lib/types/api/form-template.types';
import { defineStory } from '../../harness/story';

const item: FormTemplateItem = {
  documentReferenceId: 'docref-form-1',
  identifier: 'work-excuse-note',
  title: 'Work excuse note',
  description: 'Signed by the provider at discharge.',
  published: false,
  pdfPresignedUrl: 'https://mock.invalid/work-excuse-note.pdf',
  fillable: true,
};

export default defineStory({
  title: 'Remove form template',
  source: 'apps/ehr/src/features/form-templates/FormTemplateActionsBar.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  where: 'Admin → Form Templates → a template → "Remove template"',
  render: () => <FormTemplateActionsBar item={item} />,
  play: async ({ user, screen, waitFor }) => {
    const button = await screen.findByRole('button', { name: 'Remove template' });
    // Disabled until the zambda client exists, which happens in an effect once the (mock) auth token resolves.
    await waitFor(() => {
      if ((button as HTMLButtonElement).disabled) throw new Error('Remove template is still disabled');
    });
    await user.click(button);
    await screen.findByText('Remove Template?');
  },
  notes:
    'New dialog: it replaces a native window.confirm, so there is no "before" screenshot. Opened through confirmDestructive() from the real actions bar.',
});
