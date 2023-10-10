import { Box, Card, Grid, Typography, useTheme } from '@mui/material';
import { FC } from 'react';

interface CardWithDescriptionProps {
  icon: string;
  iconAlt: string;
  iconHeight: string;
  mainText: string;
  descText: string;
  bgColor: string;
}

export const CardWithDescription: FC<CardWithDescriptionProps> = ({
  icon,
  iconAlt,
  iconHeight,
  mainText,
  descText,
  bgColor,
}) => {
  const theme = useTheme();
  return (
    <Card sx={{ mt: 2, borderRadius: 2, backgroundColor: bgColor, [theme.breakpoints.down('md')]: { mx: 2 } }}>
      <Box sx={{ m: 0, px: { xs: 3, md: 5 }, py: 2 }}>
        <Grid container direction="row" alignItems="center">
          <Grid item xs={12} md={2} textAlign={{ xs: 'center', md: 'start' }} sx={{ marginTop: '0 !important' }}>
            <img src={icon} alt={iconAlt} height={iconHeight} />
          </Grid>
          <Grid item xs={12} md={8} textAlign={{ xs: 'center', md: 'start' }} sx={{ marginTop: '0 !important' }}>
            <Typography sx={{ fontSize: '16px', fontWeight: '700' }} color={theme.palette.secondary.main}>
              {mainText}
            </Typography>
            <Typography sx={{ fontSize: '16px' }} color={theme.palette.secondary.main}>
              {descText}
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Card>
  );
};
