import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { otherColors } from '../../IntakeThemeProvider';

interface HomepageOptionsProps {
  title: string;
  icon: string;
  handleClick: () => void;
  subtitle?: string;
  subSlot?: JSX.Element;
  className?: string;
}
const HomepageOption: FC<HomepageOptionsProps> = ({ title, icon, handleClick, subtitle, subSlot, className }) => {
  const theme = useTheme();
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
        backgroundColor: otherColors.lightBlue,
        cursor: 'pointer',
        '&:hover': { backgroundColor: otherColors.coachingVisit },
      }}
      onClick={handleClick}
      className={className}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ display: 'block', width: '70px' }}>
          <img src={icon} alt="" style={{ width: '70px', maxHeight: '70px' }} />
        </Box>
        <Box
          sx={{ display: 'flex', flexDirection: 'column ', alignItems: 'flex-start', justifyContent: 'center', gap: 1 }}
        >
          <Typography variant="h3" color="primary.main" sx={{ textAlign: 'left' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="primary.main" sx={{ textAlign: 'left' }}>
              {subtitle}
            </Typography>
          )}
          {subSlot}
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: theme.palette.primary.main,
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
