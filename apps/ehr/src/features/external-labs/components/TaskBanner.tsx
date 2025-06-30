import { otherColors } from '@ehrTheme/colors';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { LoadingButton } from '@mui/lab';
import { Box, IconButton, Paper, Stack, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useState } from 'react';

interface TaskBannerProps {
  orderName: string;
  orderingPhysician: string;
  orderedOnDate: DateTime | undefined;
  labName: string;
  taskStatus: string;
}

export const TaskBanner: React.FC<TaskBannerProps> = ({
  orderName,
  orderingPhysician,
  orderedOnDate,
  taskStatus,
  labName,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const theme = useTheme();
  const verb = taskStatus === 'pending' ? 'Collect sample' : 'Do Something';
  const localDate = orderedOnDate?.toLocal();

  console.log('This is theme', theme);
  // Note: Alert did not allow for easy justifying of content for nice spacing, so had to re-invent the wheel. Sad MUI
  return (
    <>
      <Paper
        elevation={3}
        sx={{
          padding: 2,
          backgroundColor: otherColors.infoAlert,
          borderRadius: 2,
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={4} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack>
            <Typography component="div">
              <Box fontWeight="bold" display="inline">
                {`${verb} "${orderName} / ${labName}"`}
              </Box>
            </Typography>
            <Typography variant="body1">{`Ordered by ${orderingPhysician} on ${
              localDate?.toFormat('MM/dd/yyyy') || 'Unknown date'
            } at ${localDate?.toFormat('hh:mm a') || 'Unknown date'}`}</Typography>
          </Stack>
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <LoadingButton
              loading={isLoading}
              variant="outlined"
              sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }}
              onClick={() => {
                console.log('Attempting assign');
                setIsLoading(true);
              }}
            >
              Assign Myself
            </LoadingButton>
            <IconButton color="info">
              <MoreVertIcon fontSize="medium" />
            </IconButton>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
};
