import { FC } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { OPEN_DOSESPOT, VIEW_FAX } from 'src/features/visits/in-person/hooks/useTasks';
import { useApiClients } from 'src/hooks/useAppClients';
import { Task } from 'utils/lib/types/data/tasks/types';

const COMPLETED = 'completed';

export const TaskActionButton: FC<{ task: Task }> = ({ task }) => {
  const { oystehr } = useApiClients();

  // Completed tasks normally have no action, except read-only "View" actions (e.g. a completed
  // inbound fax, where the PDF can still be opened) which fall through to the generic button.
  if (task.status === COMPLETED && task.action?.name !== VIEW_FAX) {
    return null;
  }
  if (!task.action) {
    return null;
  }
  if (task.action.name === OPEN_DOSESPOT) {
    return (
      <RoundedButton
        variant="contained"
        onClick={async () => {
          if (!oystehr) {
            return;
          }
          const { ssoLink } = await oystehr.erx.connectPractitioner();
          window.open(ssoLink, '_blank');
        }}
      >
        {task.action.name}
      </RoundedButton>
    );
  }
  if (!task.action.link) {
    return null;
  }
  // Rendered as a link so the browser offers "Open in new tab/window" on right- and middle-click.
  return (
    <RoundedButton variant="contained" to={task.action.link} target="_blank">
      {task.action.name}
    </RoundedButton>
  );
};
