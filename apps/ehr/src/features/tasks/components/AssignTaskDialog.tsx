import { Stack, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { EmployeeSelectInput } from 'src/components/input/EmployeeSelectInput';
import { formatDate, useAssignTask } from 'src/features/visits/in-person/hooks/useTasks';
import { Task } from 'utils/lib/types/data/tasks/types';
import { CategoryChip } from './CategoryChip';

interface Props {
  task: Task;
  handleClose: () => void;
  refetchData?: () => void;
}

export const AssignTaskDialog: React.FC<Props> = ({ task, handleClose, refetchData }) => {
  const methods = useForm();
  const assignee = methods.watch('assignee');
  const { mutateAsync: assignTask } = useAssignTask();
  const handleConfirm = async (): Promise<void> => {
    try {
      await assignTask({
        taskId: task.id,
        assignee: {
          id: assignee.id,
          name: assignee.name,
        },
      });
      if (refetchData) refetchData();
      handleClose();
    } catch {
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
    }
  };
  return (
    <AppDialog
      variant="form"
      size="s"
      open={true}
      onClose={handleClose}
      title="Assign Task"
      primary={{ label: 'Assign', onClick: handleConfirm, disabled: !assignee }}
    >
      <FormProvider {...methods}>
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CategoryChip category={task.category} />
            <Typography variant="body2" display="inline" style={{ color: '#00000099', display: 'block' }}>
              {formatDate(task.createdDate)}
            </Typography>
          </Stack>
          <Typography variant="body1" display="inline" fontWeight="500">
            {task.title}
          </Typography>
          <Typography variant="body2" display="inline">
            {task.subtitle}
          </Typography>
          <EmployeeSelectInput name="assignee" label="Assignee" />
        </Stack>
      </FormProvider>
    </AppDialog>
  );
};
