import { useAuth0 } from '@auth0/auth0-react';
import { AppBar, Box, Button, Card, Container, Grid, Typography, useTheme } from '@mui/material';
import { FC, ReactElement } from 'react';
import { otherColors } from '../OttehrThemeProvider';
import { bg1 } from '../assets';
import { Footer } from './Footer';

interface ContainerProps {
  children: any;
  description?: string | string[] | ReactElement;
  img?: string;
  imgAlt?: string;
  imgWidth?: number;
  isFirstPage?: boolean;
  outsideCardComponent?: (type: string) => Element;
  subtitle?: string;
  title: string;
}

export const CustomContainer: FC<ContainerProps> = ({
  children,
  description,
  img,
  imgAlt,
  imgWidth,
  isFirstPage,
  outsideCardComponent,
  subtitle,
  title,
}) => {
  const theme = useTheme();
  const { isAuthenticated, logout } = useAuth0();
  const backgroundImage = bg1;

  const gridWidths = { image: 4, title: img ? 8 : 12 };
  return (
    <Container
      disableGutters
      maxWidth={false}
      sx={{
        backgroundAttachment: 'fixed',
        backgroundColor: otherColors.shamrock,
        backgroundImage: `url(${backgroundImage})`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '100vh',
      }}
    >
      <AppBar position="static" sx={{ backgroundColor: theme.palette.primary.contrastText }}>
        <Grid container justifyContent="space-between">
          <Grid item />
          <Grid
            item
            sx={{
              ml: isAuthenticated ? { md: '100px', xs: 'auto' } : 'auto',
              mr: isAuthenticated ? '0px' : 'auto',
            }}
          />
          <Grid
            item
            sx={{
              alignItems: 'center',
              display: isAuthenticated ? 'flex' : 'none',
              mx: { md: 2, xs: 'auto' },
            }}
          >
            {isAuthenticated && (
              <Button
                onClick={() => logout({ returnTo: window.location.origin })}
                sx={{ '&:hover': { backgroundColor: otherColors.transparent } }}
                variant="text"
              >
                Logout
              </Button>
            )}
          </Grid>
        </Grid>
      </AppBar>
      <Box
        alignItems="center"
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
        sx={{ flex: 1, mt: 5 }}
      >
        <Container maxWidth="md" sx={{ mb: 5 }}>
          <>
            <Card
              sx={{ borderRadius: 2, boxShadow: 1, mt: 0, pt: 0, [theme.breakpoints.down('md')]: { mx: 2 } }}
              variant="outlined"
            >
              <Box sx={{ m: 0, p: { md: 5, xs: 3 } }}>
                <Grid
                  container
                  justifyContent="center"
                  spacing={{ md: 2, xs: 0 }}
                  sx={{ justifyContent: 'space-between' }}
                >
                  <Grid item md={gridWidths.title} xs={12}>
                    <Typography
                      color="secondary.main"
                      sx={{ width: isFirstPage ? '350px' : '100%' }}
                      variant={isFirstPage ? 'h1' : 'h2'}
                    >
                      {title}
                    </Typography>
                    {subtitle && (
                      <Typography color="primary.main" mt={1} variant="h2">
                        {subtitle}
                      </Typography>
                    )}
                  </Grid>
                  {img && (
                    <Grid
                      alignItems="center"
                      display="flex"
                      item
                      justifyContent={{ md: 'flex-end', xs: 'flex-start' }}
                      md={gridWidths.image}
                      sx={{
                        // If screen is smaller than medium breakpoint
                        [theme.breakpoints.down('md')]: {
                          order: -1,
                        },
                      }}
                      xs={12}
                    >
                      <img alt={imgAlt} src={img} width={imgWidth} />
                    </Grid>
                  )}
                </Grid>
                {description && Array.isArray(description) ? (
                  description.map((paragraph, i) => (
                    <Typography key={i} color="text.primary" mb={2} mt={1} variant="body1">
                      {paragraph}
                    </Typography>
                  ))
                ) : (
                  <Typography color="text.primary" mb={2} mt={1} variant="body1">
                    {description}
                  </Typography>
                )}
                {children}
              </Box>
            </Card>
            {outsideCardComponent}
          </>
        </Container>
      </Box>
      <Footer />
    </Container>
  );
};
