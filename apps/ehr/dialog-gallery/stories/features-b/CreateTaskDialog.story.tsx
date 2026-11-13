import { CreateTaskDialog } from 'src/features/tasks/components/CreateTaskDialog';
import { defineStory } from '../../harness/story';
import { userMocks } from './shared-mocks';

export default defineStory({
  title: 'New task',
  source: 'apps/ehr/src/features/tasks/components/CreateTaskDialog.tsx',
  base: 'InPersonModal',
  kind: 'form',
  where: 'Tasks board → "New Task" (also from the chart header and patient page)',
  notes:
    'Not in the original list (rendered through the InPersonModal wrapper around CustomDialog). Shown as opened from the Tasks board: empty form, no visit context, so "Create new task" is disabled.',
  route: '/tasks',
  mocks: userMocks,
  render: () => <CreateTaskDialog open handleClose={() => undefined} />,
});
