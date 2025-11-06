import { Stack, Typography } from '@mui/material';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { EmployeeSelectInput } from 'src/components/input/EmployeeSelectInput';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { formatDate, Task, useAssignTask } from 'src/features/visits/in-person/hooks/useTasks';
import { CategoryChip } from './CategoryChip';

interface Props {
  task: Task;
  handleClose: () => void;
}

export const AssignTaskDialog: React.FC<Props> = ({ task, handleClose }) => {
  const methods = useForm();
  const assignee = methods.watch('assignee');
  const { mutateAsync: assignTask } = useAssignTask();
  const handleConfirm = async (): Promise<void> => {
    await assignTask({
      taskId: task.id,
      assignee: {
        id: assignee.id,
        name: assignee.name,
      },
    });
  };
  return (
    <InPersonModal
      color="primary.main"
      icon={null}
      showEntityPreview={false}
      open={true}
      handleClose={handleClose}
      handleConfirm={handleConfirm}
      disabled={!assignee}
      description={''}
      title={'Assign Task'}
      confirmText={'Assign'}
      closeButtonText="Cancel"
      ContentComponent={
        <FormProvider {...methods}>
          <Stack minWidth="500px" spacing={1}>
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
      }
    />
  );
};
