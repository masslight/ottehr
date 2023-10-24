import { Box, Card, Grid, Typography, useTheme } from '@mui/material';
import { FC } from 'react';

interface CardWithDescriptionProps {
  bgColor: string;
  descText: string;
  icon: string;
  iconAlt: string;
  iconHeight: string;
  mainText: string;
}

export const CardWithDescription: FC<CardWithDescriptionProps> = ({
  bgColor,
  descText,
  icon,
  iconAlt,
  iconHeight,
  mainText,
}) => {
  const theme = useTheme();
  return (
    <Card sx={{ backgroundColor: bgColor, borderRadius: 2, mt: 2, [theme.breakpoints.down('md')]: { mx: 2 } }}>
      <Box sx={{ m: 0, px: { md: 5, xs: 3 }, py: 2 }}>
        <Grid alignItems="center" container direction="row">
          <Grid item md={2} sx={{ mt: '0 !important' }} textAlign={{ md: 'start', xs: 'center' }} xs={12}>
            <img alt={iconAlt} height={iconHeight} src={icon} />
          </Grid>
          <Grid item md={8} sx={{ mt: '0 !important' }} textAlign={{ md: 'start', xs: 'center' }} xs={12}>
            <Typography color={theme.palette.secondary.main} sx={{ fontSize: '16px', fontWeight: '700' }}>
              {mainText}
            </Typography>
            <Typography color={theme.palette.secondary.main} sx={{ fontSize: '16px' }}>
              {descText}
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Card>
  );
};
