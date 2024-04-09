import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, Button, Typography } from '@mui/material';
import { FC } from 'react';
import { otherColors } from '../../IntakeThemeProvider';

interface HomepageOptionsProps {
  title: string;
  icon: string;
  handleClick: () => void;
}
const HomepageOption: FC<HomepageOptionsProps> = ({ title, icon, handleClick }) => {
  return (
    <Button
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 2,
        px: 3,
        py: 3,
        mb: 3,
        backgroundColor: otherColors.coachingVisit,
        cursor: 'pointer',
        '&:hover': { backgroundColor: otherColors.coachingVisit },
      }}
      onClick={handleClick}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <img src={icon} alt="" style={{ minWidth: '90px' }} />
        <Typography variant="h3" color="primary.main" sx={{ py: 2 }}>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: otherColors.purple,
          color: 'white',
          borderRadius: '50%',
          p: 1,
        }}
      >
        <ArrowForwardIcon />
      </Box>
    </Button>
  );
};

export default HomepageOption;
