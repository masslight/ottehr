import { FC, ReactElement } from 'react';
import { Box, Card, Grid, Typography, useTheme } from '@mui/material';

export interface CardWithDescriptionProps {
  icon: string;
  iconAlt: string;
  iconHeight: string | number;
  mainText: string;
  descText: string | ReactElement;
  bgColor: string;
}

const CardWithDescription: FC<CardWithDescriptionProps> = ({
  icon,
  iconAlt,
  iconHeight,
  mainText,
  descText,
  bgColor,
}) => {
  const theme = useTheme();
  return (
    <Card
      sx={{
        mt: 2,
        borderRadius: 2,
        backgroundColor: bgColor,
        boxShadow: null,
        [theme.breakpoints.down('md')]: { mx: 2 },
      }}
    >
      <Box sx={{ m: 0, px: { xs: 3, md: 3 }, py: 2 }}>
        <Grid container direction="row" spacing={{ xs: 0, md: 2 }} alignItems="center">
          <Grid item xs={12} md={2} textAlign={{ xs: 'center', md: 'start' }} sx={{ marginTop: '0 !important' }}>
            <img src={icon} alt={iconAlt} height={iconHeight} />
          </Grid>
          <Grid item xs={12} md={10} textAlign={{ xs: 'center', md: 'start' }} sx={{ marginTop: '0 !important' }}>
            <Typography sx={{ fontSize: '16px', fontWeight: '700' }} color="primary.contrast">
              {mainText}
            </Typography>
            <Typography sx={{ fontSize: '16px' }} color="primary.contrast">
              {descText}
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Card>
  );
};

export default CardWithDescription;
