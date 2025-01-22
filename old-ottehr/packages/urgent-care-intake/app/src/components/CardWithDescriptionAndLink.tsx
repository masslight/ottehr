import { FC } from 'react';
import { Box, Card, Grid, Typography, useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import { otherColors } from '../IntakeThemeProvider';

export interface CardWithDescriptionAndLinkProps {
  icon: string;
  iconAlt: string;
  iconHeight: string | number;
  mainText?: string;
  descText?: string;
  textColor?: string;
  linkText: string;
  link: string;
  largerLinkTextSpace?: boolean;
  bgColor: string;
}

const CardWithDescriptionAndLink: FC<CardWithDescriptionAndLinkProps> = ({
  icon,
  iconAlt,
  iconHeight,
  mainText,
  descText,
  textColor,
  linkText,
  link,
  largerLinkTextSpace,
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
      <Link to={link} style={{ textDecoration: 'none' }}>
        <Box sx={{ m: 0, px: { xs: 3, md: 3 }, py: 2 }}>
          <Grid container direction="row" spacing={{ xs: 0, md: 5 }} alignItems="center">
            <Grid item xs={12} md={2} textAlign={{ xs: 'center', md: 'start' }} sx={{ marginTop: '0 !important' }}>
              <img src={icon} alt={iconAlt} height={iconHeight} />
            </Grid>
            <Grid item xs={12} md={7} textAlign={{ xs: 'center', md: 'start' }} sx={{ marginTop: '0 !important' }}>
              <Typography
                sx={{ color: textColor ? textColor : otherColors.black, fontSize: '16px', fontWeight: '700' }}
                color={theme.palette.secondary.main}
              >
                {mainText}
              </Typography>
              {descText ? (
                <Typography
                  sx={{ color: textColor ? textColor : otherColors.black, fontSize: '16px' }}
                  color={theme.palette.secondary.main}
                >
                  {descText}
                </Typography>
              ) : null}
            </Grid>
            <Grid
              item
              xs={12}
              md={3}
              textAlign={{ xs: 'center', md: 'start' }}
              sx={{ marginTop: '0 !important', paddingLeft: largerLinkTextSpace ? '16px !important' : '' }}
            >
              <Typography
                style={{
                  fontWeight: 700,
                  fontSize: '16px',
                  color: textColor ? textColor : theme.palette.secondary.main,
                  textDecoration: 'underline',
                }}
              >
                {linkText}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Link>
    </Card>
  );
};

export default CardWithDescriptionAndLink;
