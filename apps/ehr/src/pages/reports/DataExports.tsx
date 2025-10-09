import { Box, Grid, Paper, Typography } from '@mui/material';
import React from 'react';
import { ReportsMenu } from 'src/components/ReportsMenu';
import PageContainer from '../../layout/PageContainer';

export default function DataExports(): React.ReactElement {
  return (
    <PageContainer>
      <Grid container spacing={4}>
        <Grid item xs={12}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom color="primary.dark" fontWeight={600}>
              Data Exports
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Export clinical and administrative data for analysis and reporting purposes
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" component="h2" gutterBottom fontWeight={600}>
                Available Reports
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select a report type to download data in JSON format. All reports include related resources and metadata
                for comprehensive analysis.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Unsigned Charts
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Export encounters that are still in-progress and require signature. Includes appointments from the
                  last 90 days up to yesterday.
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Appointments
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Export appointment data with related patient information, encounters, providers, locations, and
                  documentation. Covers the last 90 days up to yesterday.
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                  Encounters
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Export encounter data for analysis (feature coming soon).
                </Typography>
              </Box>

              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
                <ReportsMenu />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
