import { otherColors } from '@ehrTheme/colors';
import { Box, Grid, Paper, Typography, useTheme } from '@mui/material';
import React from 'react';
import {
  AdditionalQuestionsPatientColumn,
  AdditionalQuestionsProviderColumn,
} from '../../../../telemed/features/appointment';
interface PatientInfoProps {
  appointmentID?: string;
}

export const Questions: React.FC<PatientInfoProps> = () => {
  const theme = useTheme();

  return (
    <Paper elevation={3} sx={{ pl: 1, pr: 3, pt: 3, pb: 1, mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }}>
      <Grid container>
        <Grid item xs={6} sx={{ borderRight: '1px solid rgba(0, 0, 0, 0.12)' }}>
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                color: theme.palette.primary.dark,
                marginLeft: '16px',
              }}
            >
              PATIENT PROVIDED DURING REGISTRATION
            </Typography>
            <Box p={2}>
              <AdditionalQuestionsPatientColumn />
            </Box>
          </Box>
        </Grid>
        <Grid item xs={6}>
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                color: otherColors.orange700,
                marginLeft: '16px',
              }}
            >
              CONFIRMED BY STAFF DURING VISIT
            </Typography>
            <Box p={2}>
              <AdditionalQuestionsProviderColumn />
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};
