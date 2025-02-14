import { useAuth0 } from '@auth0/auth0-react';
import { AppBar, Box, Button, Card, Container, Grid, Typography, useTheme } from '@mui/material';
import { FC, ReactElement, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { dataTestIds } from '../../../../apps/intake/src/helpers/data-test-ids';
// import { LanguagePicker } from './LanguagePicker';

export interface ContainerProps {
  title: string;
  logo: string;
  alt: string;
  subtitle?: string;
  subtext?: string;
  isFirstPage?: boolean;
  img?: string;
  imgAlt?: string;
  imgWidth?: number;
  showLanguagePicker: boolean;
  description?: string | string[] | ReactElement;
  topOutsideCardComponent?: ReactElement;
  outsideCardComponent?: ReactElement;
  useEmptyBody?: boolean;
  children: any;
  footer?: JSX.Element;
  logoutHandler?: () => void;
  patientFullName?: string;
}

type WrappedContainerProps = Omit<ContainerProps, 'logo' | 'showLanguagePicker' | 'footer' | 'logoutHandler' | 'alt'>;

interface CustomContainerFactoryProps {
  logo: string;
  showLanguagePicker: boolean;
  alt: string;
  footer?: JSX.Element;
  logoutHandler?: () => void;
}
export const CustomContainerFactory = ({
  logo,
  showLanguagePicker,
  alt,
  footer,
  logoutHandler,
}: CustomContainerFactoryProps): FC<WrappedContainerProps> => {
  const CustomContainerWrapped: FC<WrappedContainerProps> = (props) => {
    const passThroughProps = {
      ...props, // factory args will overwrrite anything passed through
      logo,
      showLanguagePicker,
      alt,
      footer,
      logoutHandler,
    };
    return <CustomContainer {...passThroughProps} />;
  };
  return CustomContainerWrapped;
};

export const CustomContainer: FC<ContainerProps> = ({
  title,
  subtitle,
  subtext,
  isFirstPage,
  img,
  imgAlt,
  imgWidth,
  description,
  topOutsideCardComponent,
  outsideCardComponent,
  useEmptyBody,
  children,
  // showLanguagePicker,
  logo,
  alt,
  footer,
  logoutHandler,
  patientFullName,
}) => {
  const theme = useTheme();
  const { isAuthenticated, logout } = useAuth0();
  const { t } = useTranslation();

  const handleLogout = useCallback(() => {
    if (logoutHandler !== undefined) {
      logoutHandler();
    } else {
      void logout({ logoutParams: { localOnly: true } });
    }
  }, [logout, logoutHandler]);

  const gridWidths = { title: img ? 8 : 12, image: 4 };
  return (
    <Container
      maxWidth={false}
      disableGutters
      sx={{
        backgroundRepeat: 'no-repeat',
        backgroundColor: theme.palette.background.default,
        backgroundAttachment: 'fixed',
        backgroundPosition: 'top center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <AppBar position="static" sx={{ backgroundColor: theme.palette.primary.dark }}>
        <Grid container justifyContent="center" alignItems="center" sx={{ position: 'relative' }}>
          <Grid item>
            <Box
              component="img"
              sx={{ margin: 1, width: 200, alignSelf: 'center', minHeight: '39px' }}
              alt={alt}
              src={logo}
            />
          </Grid>
          {isAuthenticated && (
            <Grid
              item
              sx={{
                position: 'absolute',
                right: 0,
                display: 'flex',
                alignItems: 'center',
                mx: { xs: 'auto', md: 2 },
                maxWidth: { xs: '20%', md: 'unset' },
              }}
            >
              <Button
                variant="text"
                onClick={handleLogout}
                sx={{ color: theme.palette.primary.contrastText, '&:hover': { backgroundColor: 'transparent' } }}
              >
                {t('general.button.logout')}
              </Button>
            </Grid>
          )}
        </Grid>
      </AppBar>

      <Box
        display="flex"
        flexDirection="column"
        justifyContent="space-between"
        alignItems="center"
        sx={{ marginTop: 5, flex: 1 }}
      >
        {useEmptyBody ? (
          children
        ) : (
          <Container maxWidth="md" sx={{ mb: 5 }}>
            <>
              {/* {showLanguagePicker ? <LanguagePicker></LanguagePicker> : null} */}
              {topOutsideCardComponent}
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
                        sx={{
                          width: { xs: '100%', md: isFirstPage ? '350px' : '100%' },
                        }}
                        variant={isFirstPage ? 'h1' : 'h2'}
                        color="primary.main"
                        data-testid={isFirstPage ? dataTestIds.firstFlowPageTitle : dataTestIds.flowPageTitle}
                      >
                        {title}
                      </Typography>
                      {patientFullName && (
                        <Typography variant="body2" color={theme.palette.secondary.main} fontSize={'18px'}>
                          {patientFullName}
                        </Typography>
                      )}
                      {subtitle && (
                        <Typography variant="h2" color="primary.main" mt={1}>
                          {subtitle}
                        </Typography>
                      )}
                      {subtext && <Typography variant="body2">{subtext}</Typography>}
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
        )}
      </Box>
      {footer}
    </Container>
  );
};
