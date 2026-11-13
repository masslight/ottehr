import { AssignTaskDialog } from 'src/features/tasks/components/AssignTaskDialog';
import { fhirTaskToTask } from 'src/features/visits/in-person/hooks/useTasks';
import { defineStory } from '../../harness/story';
import { mockFaxTask, userMocks } from './shared-mocks';

export default defineStory({
  title: 'Assign task',
  source: 'apps/ehr/src/features/tasks/components/AssignTaskDialog.tsx',
  base: 'InPersonModal',
  kind: 'form',
  where: 'Tasks board → ⋮ on a task row → "Assign to someone else"',
  notes:
    'Not in the original list (rendered through the InPersonModal wrapper around CustomDialog). Rendered directly with a mock inbound-fax task; no assignee picked yet, so "Assign" is disabled.',
  route: '/tasks',
  mocks: userMocks,
  render: () => <AssignTaskDialog task={fhirTaskToTask(mockFaxTask)} handleClose={() => undefined} />,
});
