import { Box, CircularProgress } from '@mui/material';

export const LabOrderLoading: React.FC = () => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        zIndex: 10,
      }}
    >
      <CircularProgress sx={{ color: 'primary.main' }} size={40} thickness={4} />
    </Box>
  );
};
