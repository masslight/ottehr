import { Typography } from '@mui/material';
import WaitingRoomLogo from '../../assets/icons/waitingRoomLogo.png';
import { Box } from '@mui/system';

//To do: export types to another folder
interface TopSectionProps {
  roomName: string;
}

const TopSection: React.FC<TopSectionProps> = ({ roomName }) => {
  return (
    <Box
      sx={{
        height: '11.3rem',
        background: 'linear-gradient(89deg, rgba(40, 160, 198, 0.60) 5.05%, rgba(80, 96, 241, 0.17) 50.42%), #263954',
      }}
    >
      <Typography
        sx={{
          color: 'white',
          textAlign: 'left',
          fontWeight: 'bold',
          fontSize: '1.25rem',
          paddingTop: '0.7rem',
          paddingLeft: '1.37rem',
          position: 'absolute',
        }}
      >
        NEW LOGO
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', paddingX: '23.12rem', paddingY: '2.5rem' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            paddingX: '6.25rem',
          }}
        >
          <img src={WaitingRoomLogo} style={{ width: '6.25rem', height: '6.25rem' }} />
          <Box sx={{ marginLeft: '1.5rem' }}>
            <Typography sx={{ color: '#4AC0F2', fontSize: '1.5rem', width: '23.5rem' }}>{roomName}</Typography>
            <Typography sx={{ color: 'white', fontSize: '2.125rem' }}>Dr. Smith</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TopSection;
