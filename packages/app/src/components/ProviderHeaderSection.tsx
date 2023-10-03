import { Typography, Box } from '@mui/material';
import defaultProvider from '../assets/icons/defaultProvider.png';

//To do: export types to another folder
interface ProviderHeaderSectionProps {
  providerName: string;
  title: string;
}

const ProviderHeaderSection: React.FC<ProviderHeaderSectionProps> = ({ providerName, title }) => {
  return (
    <Box
      sx={{
        background: 'linear-gradient(89deg, rgba(40, 160, 198, 0.60) 5.05%, rgba(80, 96, 241, 0.17) 50.42%), #263954',
      }}
    >
      {/* // placeholder for logo */}
      <Typography
        sx={{
          color: 'white',
          textAlign: 'left',
          fontWeight: 'bold',
          fontSize: '1.25rem',
          pt: 1.4,
          pl: 2.74,
          position: 'absolute',
        }}
      >
        NEW LOGO
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5, alignItems: 'center' }}>
        <Box maxWidth="md" width="100%">
          <Box sx={{ display: 'flex', justifyContent: 'start', alignItems: 'center', mx: 12.5 }}>
            <img src={defaultProvider} style={{ width: '6.25rem', height: '6.25rem' }} />
            <Box sx={{ ml: 3 }}>
              <Typography variant="h5" color="primary.light">
                {title}
              </Typography>
              <Typography variant="h4" color="primary.contrast">
                {providerName}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ProviderHeaderSection;
