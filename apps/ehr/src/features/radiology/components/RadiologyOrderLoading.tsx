import { Box, CircularProgress } from '@mui/material';

export const RadiologyOrderLoading: React.FC = () => {
  return (
    <Box
      sx={{
        position: 'absolute',
        width: '40px',
        height: '40px',
        top: 'calc(50% + 60px)',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress sx={{ color: 'primary.main' }} size={40} thickness={4} />
    </Box>
  );
};
