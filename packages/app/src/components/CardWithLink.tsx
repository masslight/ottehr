import { Box, Card, Grid, Link as MuiLink, Typography, useTheme } from '@mui/material';
import { FC } from 'react';

interface CardWithLinkProps {
  bgColor: string;
  icon: string;
  iconAlt: string;
  iconHeight: string;
  link: string;
  linkText: string;
  mainText: string;
}

export const CardWithLink: FC<CardWithLinkProps> = ({
  bgColor,
  icon,
  iconAlt,
  iconHeight,
  link,
  linkText,
  mainText,
}) => {
  const theme = useTheme();
  return (
    <Card sx={{ backgroundColor: bgColor, borderRadius: 2, mt: 2, [theme.breakpoints.down('md')]: { mx: 2 } }}>
      <Box sx={{ m: 0, px: { md: 5, xs: 3 }, py: 2 }}>
        <Grid alignItems="center" container direction="row" spacing={{ md: 2, xs: 0 }}>
          <Grid item md={3} sx={{ marginTop: '0 !important' }} textAlign={{ md: 'start', xs: 'center' }} xs={12}>
            <img alt={iconAlt} height={iconHeight} src={icon} />
          </Grid>
          <Grid item md={6} sx={{ marginTop: '0 !important' }} textAlign={{ md: 'start', xs: 'center' }} xs={12}>
            <Typography color={theme.palette.secondary.main} sx={{ fontSize: '18px' }}>
              {mainText}
            </Typography>
          </Grid>
          <Grid item md={3} sx={{ marginTop: '0 !important' }} textAlign={{ md: 'end', xs: 'center' }} xs={12}>
            <MuiLink
              href={link}
              sx={{
                color: theme.palette.secondary.main,
                fontSize: '16px',
                fontWeight: 700,
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
