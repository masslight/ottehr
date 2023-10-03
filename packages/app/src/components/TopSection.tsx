import { Typography } from '@mui/material';
import WaitingRoomLogo from '../assets/icons/waitingRoomLogo.png';
import { Box } from '@mui/system';

//To do: export types to another folder
interface TopSectionProps {
  roomName: string;
}

const TopSection: React.FC<TopSectionProps> = ({ roomName }) => {
  return (
    <Box
      sx={{
        background: 'linear-gradient(89deg, rgba(40, 160, 198, 0.60) 5.05%, rgba(80, 96, 241, 0.17) 50.42%), #263954',
      }}
    >
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
      <Box sx={{ display: 'flex', justifyContent: 'center', px: 46, py: 5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <img src={WaitingRoomLogo} style={{ width: '6.25rem', height: '6.25rem' }} />
          <Box sx={{ ml: 3 }}>
            <Typography sx={{ color: '#4AC0F2', fontSize: 24, width: 376 }}>{roomName}</Typography>
            <Typography sx={{ color: 'white', fontSize: '2.125rem' }}>Dr. Smith</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TopSection;
