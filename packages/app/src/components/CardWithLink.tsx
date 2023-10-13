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
      <Box sx={{ m: 0, px: { xs: 3, md: 5 }, py: 2 }}>
        <Grid alignItems="center" container direction="row" spacing={{ xs: 0, md: 2 }}>
          <Grid item textAlign={{ xs: 'center', md: 'start' }} xs={12} md={3} sx={{ marginTop: '0 !important' }}>
            <img alt={iconAlt} height={iconHeight} src={icon} />
          </Grid>
          <Grid item textAlign={{ xs: 'center', md: 'start' }} xs={12} md={6} sx={{ marginTop: '0 !important' }}>
            <Typography color={theme.palette.secondary.main} sx={{ fontSize: '18px' }}>
              {mainText}
            </Typography>
          </Grid>
          <Grid item textAlign={{ xs: 'center', md: 'end' }} xs={12} md={3} sx={{ marginTop: '0 !important' }}>
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
