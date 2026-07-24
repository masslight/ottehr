import { Box, CircularProgress, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { otherColors } from '../themes/ottehr/colors';

export const dataGridSx = {
  bgcolor: 'background.paper',
  border: `1px solid ${otherColors.lightDivider}`,
  borderRadius: 1,
  fontSize: 14,
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: '#FAFAFA',
    borderBottom: `1px solid ${otherColors.lightDivider}`,
  },
  '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 500, fontSize: 13, color: 'text.secondary' },
  '& .MuiDataGrid-cell': {
    borderBottom: `1px solid ${otherColors.lightDivider}`,
    fontSize: 14,
    color: 'text.primary',
  },
  '& .MuiDataGrid-row': { cursor: 'pointer' },
  '& .MuiDataGrid-row:hover': { bgcolor: otherColors.apptHover },
} as const;

function NoRowsOverlay(): ReactElement {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <Typography color="text.secondary">No results found.</Typography>
    </Box>
  );
}

function LoadingOverlay(): ReactElement {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <CircularProgress size={32} />
    </Box>
  );
}

export const dataGridSlots = { noRowsOverlay: NoRowsOverlay, loadingOverlay: LoadingOverlay };
