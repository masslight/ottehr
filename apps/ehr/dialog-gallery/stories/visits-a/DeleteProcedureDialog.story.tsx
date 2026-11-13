import { Button } from '@mui/material';
import { ReactElement } from 'react';
import { useDeleteProcedureDialog } from 'src/features/visits/in-person/components/DeleteProcedureDialog';
import { defineStory } from '../../harness/story';

// The dialog only exists as the return value of this hook, so the story hosts the hook.
function Host(): ReactElement {
  const { showDeleteProcedureDialog, DeleteProcedureDialog } = useDeleteProcedureDialog({
    deleteProcedure: async () => true,
  });
  return (
    <>
      <Button onClick={() => showDeleteProcedureDialog({ procedureId: 'proc-1', procedureName: 'Laceration Repair' })}>
        open
      </Button>
      {DeleteProcedureDialog}
    </>
  );
}

export default defineStory({
  title: 'Delete procedure',
  source: 'apps/ehr/src/features/visits/in-person/components/DeleteProcedureDialog.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'In-person visit → Procedures → delete icon on a procedure row',
  render: () => <Host />,
  play: async ({ user, screen }) => {
    await user.click(screen.getByRole('button', { name: 'open' }));
  },
  notes: 'Rendered through the real useDeleteProcedureDialog hook from a minimal host; procedure name is mock data.',
});
