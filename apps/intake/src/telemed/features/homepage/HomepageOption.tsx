import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { otherColors } from '../../../IntakeThemeProvider';

interface HomepageOptionsProps {
  title: string;
  icon: React.ReactNode | string;
  handleClick: () => void;
  subtitle?: string;
  subSlot?: JSX.Element;
  dataTestId?: string;
}

const HomepageOption: FC<HomepageOptionsProps> = ({ title, icon, handleClick, subtitle, subSlot, dataTestId }) => {
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
        cursor: 'pointer',
        border: `1px solid ${otherColors.borderGray}`,
      }}
      data-testid={dataTestId}
      onClick={handleClick}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            backgroundColor: otherColors.lightBlue,
            borderRadius: '50%',
            color: theme.palette.secondary.main,
          }}
        >
          {typeof icon === 'string' ? <img src={icon} alt="icon" style={{ width: 20, height: 20 }} /> : icon}
        </Box>
        <Box
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 1 }}
        >
          <Typography variant="h3" color="primary.main" align="left">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="primary.main" align="left">
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
