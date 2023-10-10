import { Box, Card, Grid, Link as MuiLink, Typography, useTheme } from '@mui/material';
import { FC } from 'react';

interface CardWithLinkProps {
  icon: string;
  iconAlt: string;
  iconHeight: string;
  mainText: string;
  linkText: string;
  link: string;
  bgColor: string;
}

export const CardWithLink: FC<CardWithLinkProps> = ({
  icon,
  iconAlt,
  iconHeight,
  mainText,
  linkText,
  link,
  bgColor,
}) => {
  const theme = useTheme();
  return (
    <Card sx={{ mt: 2, borderRadius: 2, backgroundColor: bgColor, [theme.breakpoints.down('md')]: { mx: 2 } }}>
      <Box sx={{ m: 0, px: { xs: 3, md: 5 }, py: 2 }}>
        <Grid container direction="row" spacing={{ xs: 0, md: 2 }} alignItems="center">
          <Grid item xs={12} md={3} textAlign={{ xs: 'center', md: 'start' }} sx={{ marginTop: '0 !important' }}>
            <img src={icon} alt={iconAlt} height={iconHeight} />
          </Grid>
          <Grid item xs={12} md={6} textAlign={{ xs: 'center', md: 'start' }} sx={{ marginTop: '0 !important' }}>
            <Typography sx={{ fontSize: '18px' }} color={theme.palette.secondary.main}>
              {mainText}
            </Typography>
          </Grid>
          <Grid item xs={12} md={3} textAlign={{ xs: 'center', md: 'end' }} sx={{ marginTop: '0 !important' }}>
            <MuiLink
              href={link}
              sx={{
                fontWeight: 700,
                fontSize: '16px',
                color: theme.palette.secondary.main,
              }}
            >
              {linkText}
            </MuiLink>
          </Grid>
        </Grid>
      </Box>
    </Card>
  );
};
