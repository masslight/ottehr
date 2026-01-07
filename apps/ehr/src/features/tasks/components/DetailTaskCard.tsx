import { otherColors } from '@ehrTheme/colors';
import { LoadingButton } from '@mui/lab';
import { Box, Paper, Typography } from '@mui/material';
import React, { ReactElement } from 'react';
import { useCompleteTask } from 'src/features/visits/in-person/hooks/useTasks';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { DetailPageTask } from 'utils';
import { MoreTaskActions } from './MoreTaskActions';

interface DetailTaskCardProps {
  task: DetailPageTask;
  fetchOrders: () => void;
}

export const DetailTaskCard: React.FC<DetailTaskCardProps> = ({ task, fetchOrders }) => {
  const { mutateAsync: completeTask, isPending } = useCompleteTask();
  const currentUser = useEvolveUser();
  const currentUserProviderId = currentUser?.profile?.split('/')[1];

  const renderCompleteButton = (task: DetailPageTask): ReactElement | null => {
    if (task.status !== 'completed' && task.completable && currentUserProviderId === task.assignee?.id) {
      return (
        <LoadingButton
          sx={{ borderRadius: '16px', textTransform: 'none', p: '6px 16px' }}
          variant="contained"
          onClick={async () => {
            await completeTask({ taskId: task.id });
            fetchOrders();
          }}
          loading={isPending}
        >
          Complete
        </LoadingButton>
      );
    }
    return null;
  };

  return (
    <>
      <Paper
        sx={{
          background: otherColors.infoAlert,
          padding: '8px 16px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="body1" style={{ fontWeight: '500' }}>
            {task.title}
          </Typography>
          <Typography variant="body2">{task.subtitle}</Typography>
        </Box>
        <Box display="flex" alignItems="center">
          <Box>{renderCompleteButton(task)}</Box>
          <MoreTaskActions task={task} currentUser={currentUser} refetchData={fetchOrders} />
        </Box>
      </Paper>
    </>
  );
};
