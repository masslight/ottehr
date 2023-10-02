import { Typography } from '@mui/material';
import { Box } from '@mui/system';

const Footer = (): JSX.Element => {
  return (
    <Box
      sx={{
        height: '2.5rem',
        backgroundColor: '#202A3E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography
          sx={{
            color: 'white',
            textAlign: 'left',
            fontWeight: 'bold',
            fontSize: '1.25rem',
            paddingLeft: '1.5rem',
            opacity: '0.2',
          }}
        >
          NEW LOGO
        </Typography>
      </Box>
      <Box sx={{ paddingRight: '1.25rem', display: 'flex', alignItems: 'center' }}>
        <Typography component="span" sx={{ color: '#4AC0F2', fontSize: '0.875rem' }}>
          Powered by _
        </Typography>
        <Typography component="span" sx={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>
          zapEHR
        </Typography>
      </Box>
    </Box>
  );
};

export default Footer;
