import SendStatementToPatientDialog from 'src/components/dialogs/SendStatementToPatientDialog';
import { defineStory } from '../../harness/story';
import { invoiceReport } from './_fixtures';
import { statementMocks } from './_statement';

export default defineStory({
  title: 'Confirm send statement by mail',
  source: 'apps/ehr/src/components/dialogs/SendStatementToPatientDialog.tsx',
  base: 'MUI Dialog',
  kind: 'confirm',
  where: 'Send Statement dialog → "Send by Mail"',
  mocks: statementMocks,
  notes:
    'Second Dialog in the file, stacked on top of the Send Statement dialog. Requires the mailingPaperStatementsEnabled feature flag (true in the default config).',
  render: () => (
    <SendStatementToPatientDialog
      modalOpen
      handleClose={() => undefined}
      onSubmit={() => undefined}
      report={invoiceReport}
    />
  ),
  play: async ({ user, screen }) => {
    await screen.findByTitle('Statement Preview', undefined, { timeout: 8000 });
    await user.click(screen.getByRole('button', { name: 'Send by Mail' }));
    await screen.findByText('Confirm Send by Mail');
  },
});
