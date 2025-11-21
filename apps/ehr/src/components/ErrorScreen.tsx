import { Box, Button, Typography } from '@mui/material';
import { ReactElement } from 'react';
import img from '../../public/website.png';

const ErrorScreen = (): ReactElement => {
  const handleback = (): void => {
    window.history.back();
    setTimeout(() => window.location.reload(), 100);
  };

  return (
    <Box
      sx={{
        minHeight: '98vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        px: 2,
      }}
    >
      <Box
        component="img"
        src={img}
        alt="Error"
        sx={{
          width: {
            xs: '60%',
            sm: '40%',
            md: '30%',
            lg: '25%',
          },
          maxWidth: '200px',
          mb: 3,
        }}
      />

      <Typography
        variant="h4"
        sx={{
          fontSize: { xs: '1.6rem', sm: '2rem', md: '2.2rem' },
          fontWeight: 600,
          mb: 1,
          color: '#333',
        }}
      >
        Oops… Page not found.
      </Typography>

      <Typography
        variant="h6"
        sx={{
          fontSize: { xs: '1rem', sm: '1.2rem' },
          maxWidth: '600px',
          color: '#555',
          mb: 3,
          px: { xs: 1, sm: 0 },
        }}
      >
        This page doesn’t exist or might have been moved. Please return to the previous screen.
      </Typography>

      <Button
        variant="contained"
        onClick={handleback}
        sx={{
          textTransform: 'none',
          px: 4,
          py: 1,
          fontSize: { xs: '0.9rem', sm: '1rem' },
        }}
      >
        Go Back
      </Button>
    </Box>
  );
};

export default ErrorScreen;
