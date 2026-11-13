import SendStatementToPatientDialog from 'src/components/dialogs/SendStatementToPatientDialog';
import { defineStory } from '../../harness/story';
import { invoiceReport } from './_fixtures';
import { statementMocks } from './_statement';

export default defineStory({
  title: 'Send statement (preview + generate / mail)',
  source: 'apps/ehr/src/components/dialogs/SendStatementToPatientDialog.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Reports → Invoiceable patients → send statement',
  mocks: statementMocks,
  notes:
    'Preview iframe renders the real packages/zambdas statement-template.html and logo.png filled with mock statement details. Dialog is 92vh tall, so the crop is the full dialog at a 900px viewport; the preview scrolls inside it.',
  render: () => (
    <SendStatementToPatientDialog
      modalOpen
      handleClose={() => undefined}
      onSubmit={() => undefined}
      report={invoiceReport}
    />
  ),
  play: async ({ screen }) => {
    await screen.findByTitle('Statement Preview', undefined, { timeout: 8000 });
  },
});
