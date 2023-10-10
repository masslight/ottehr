import { useAuth0 } from '@auth0/auth0-react';
import { AppBar, Box, Button, Card, Container, Grid, Typography, useTheme } from '@mui/material';
import { FC, ReactElement } from 'react';
import { bg1 } from '../assets';
import { Footer } from './Footer';

interface ContainerProps {
  title: string;
  subtitle?: string;
  isFirstPage?: boolean;
  img?: string;
  imgAlt?: string;
  imgWidth?: number;
  description?: string | string[] | ReactElement;
  outsideCardComponent?: (type: string) => Element;
  children: any;
}

export const CustomContainer: FC<ContainerProps> = ({
  title,
  subtitle,
  isFirstPage,
  img,
  imgAlt,
  imgWidth,
  description,
  outsideCardComponent,
  children,
}) => {
  const theme = useTheme();
  const { isAuthenticated, logout } = useAuth0();
  const backgroundImage = bg1;

  const gridWidths = { title: img ? 8 : 12, image: 4 };
  return (
    <Container
      maxWidth={false}
      disableGutters
      sx={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        backgroundColor: '#3ECCA2',
        backgroundAttachment: 'fixed',
        backgroundPosition: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <AppBar position="static" sx={{ backgroundColor: theme.palette.primary.contrastText }}>
        <Grid container justifyContent="space-between">
          <Grid item></Grid>
          <Grid
            item
            sx={{
              marginLeft: isAuthenticated ? { xs: 'auto', md: '100px' } : 'auto',
              marginRight: isAuthenticated ? '0px' : 'auto',
            }}
          ></Grid>
          <Grid
            item
            sx={{
              display: isAuthenticated ? 'flex' : 'none',
              alignItems: 'center',
              mx: { xs: 'auto', md: 2 },
            }}
          >
            {isAuthenticated && (
              <Button
                variant="text"
                onClick={() => logout({ returnTo: window.location.origin })}
                sx={{ '&:hover': { backgroundColor: 'transparent' } }}
              >
                Logout
              </Button>
            )}
          </Grid>
        </Grid>
      </AppBar>
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
        alignItems="center"
        sx={{ marginTop: 5, flex: 1 }}
      >
        <Container maxWidth="md" sx={{ mb: 5 }}>
          <>
            <Card
              variant="outlined"
              sx={{ boxShadow: 1, mt: 0, pt: 0, borderRadius: 2, [theme.breakpoints.down('md')]: { mx: 2 } }}
            >
              <Box sx={{ m: 0, p: { xs: 3, md: 5 } }}>
                <Grid
                  container
                  spacing={{ xs: 0, md: 2 }}
                  justifyContent="center"
                  sx={{ justifyContent: 'space-between' }}
                >
                  <Grid item xs={12} md={gridWidths.title}>
                    <Typography
                      sx={{ width: isFirstPage ? '350px' : '100%' }}
                      variant={isFirstPage ? 'h1' : 'h2'}
                      color="secondary.main"
                    >
                      {title}
                    </Typography>
                    {subtitle && (
                      <Typography variant="h2" color="primary.main" mt={1}>
                        {subtitle}
                      </Typography>
                    )}
                  </Grid>
                  {img && (
                    <Grid
                      item
                      display="flex"
                      alignItems="center"
                      justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                      xs={12}
                      md={gridWidths.image}
                      sx={{
                        // If screen is smaller than medium breakpoint
                        [theme.breakpoints.down('md')]: {
                          order: -1,
                        },
                      }}
                    >
                      <img alt={imgAlt} src={img} width={imgWidth} />
                    </Grid>
                  )}
                </Grid>
                {description && Array.isArray(description) ? (
                  description.map((paragraph, i) => (
                    <Typography key={i} variant="body1" color="text.primary" mt={1} mb={2}>
                      {paragraph}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body1" color="text.primary" mt={1} mb={2}>
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
