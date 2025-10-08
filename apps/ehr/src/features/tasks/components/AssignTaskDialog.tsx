import { Stack, Typography } from '@mui/material';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { ProviderSelectInput } from 'src/components/input/ProviderSelectInput';
import { InPersonModal } from 'src/features/visits/in-person/components/InPersonModal';
import { Task } from 'src/features/visits/in-person/hooks/useTasks';
import { formatDate } from '../common';
import { CategoryChip } from './CategoryChip';

interface Props {
  task: Task;
  handleClose: () => void;
  handleConfirm: () => void;
}

export const AssignTaskDialog: React.FC<Props> = ({ task, handleClose, handleConfirm }) => {
  const methods = useForm();
  const assignee = methods.watch('assignee');
  console.log(assignee);
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
            <ProviderSelectInput name="assignee" label="Assignee" />
          </Stack>
        </FormProvider>
      }
    />
  );
};
