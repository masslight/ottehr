import { Box, Paper, Stack, Typography } from '@mui/material';
import React from 'react';

export const TaskRow: React.FC = () => {
  return (
    <Stack direction="row">
      <Paper style={{ display: 'flex', height: '62px', alignItems: 'center', width: '100%', padding: '16px' }}>
        <Box style={{ width: '150px' }}>
          <Box
            style={{
              background: '#2169F51F',
              borderRadius: '16px',
              height: '24px',
              padding: '0 12px 0 12px',
            }}
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
          >
            <Typography variant="body2" display="inline" style={{ color: '#2169F5', fontSize: '13px' }}>
              Category
            </Typography>
          </Box>
          <Typography variant="body2" display="inline" style={{ color: '#00000099', display: 'block' }}>
            Today, 12:30 PM
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="body1"
            display="inline"
            style={{ color: '#000000DE', display: 'block', fontWeight: 500 }}
          >
            [Task name] for [Patient Name]
          </Typography>
          <Typography variant="body2" display="inline" style={{ color: '#00000099' }}>
            Ordered by [Provider Name] on [Order date and time]
          </Typography>
        </Box>
      </Paper>
    </Stack>
  );
};
