import CancelIcon from '@mui/icons-material/Cancel';
import CheckIcon from '@mui/icons-material/CheckCircle';
import {
  Box,
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Footer, Header, TopAppBar } from '../components';
import { createProviderName } from '../helpers';
import { getProvider, getTitles, isAvailable } from '../helpers/mockData';

export const Profile = (): JSX.Element => {
  const theme = useTheme();
  const { t } = useTranslation();

  const handleSubmit = (event: any): void => {
    event.preventDefault();
    // TODO: form submission structure
  };

  // TODO hard-coded data
  const provider = getProvider();
  const [slug, setSlug] = useState(provider.slug);
  const titles = getTitles();

  const isError = !isAvailable(slug);
  const helperText = isError ? t('error.slugUnavailable') : '';

  return (
    <Container
      disableGutters
      maxWidth={false}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '100vh',
      }}
    >
      <TopAppBar />
      <Header isProvider={true} subtitle={createProviderName(provider)} title={t('profile.myProfile')} />
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          flex: '1 1 auto',
          flexDirection: 'column',
          p: {
            md: 5,
            xs: 2,
          },
        }}
      >
        <Box maxWidth="md" width="100%">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'start',
              mx: {
                md: 12.5,
                xs: 2,
              },
              my: {
                md: 0,
                xs: 2,
              },
            }}
          >
            <form onSubmit={handleSubmit}>
              <Box sx={{ alignItems: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* TODO form labels translated without breaking react hook form/back end submission */}
                <FormControl variant="outlined">
                  <InputLabel>{t('profile.title')}</InputLabel>
                  <Select label="Title">
                    {titles.map((title) => (
                      <MenuItem key={title} value={title.toLowerCase()}>
                        {t(`profile.titleOption.${title.toLowerCase()}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField label="First Name" variant="outlined" />
                <TextField label="Last Name" variant="outlined" />
                <TextField
                  error={isError}
                  helperText={helperText}
                  label="Slug"
                  onChange={(e) => setSlug(e.target.value)}
                  value={slug}
                  variant="outlined"
                />
                <Box sx={{ alignItems: 'center', display: 'flex' }}>
                  <Box sx={{ mr: 1 }}>{isError ? <CancelIcon color="error" /> : <CheckIcon color="success" />}</Box>
                  <Typography variant="body2">{`https://zapehr.app/${slug}`}</Typography>
                </Box>
                <TextField label="Email Address" variant="outlined" />
                <Button
                  sx={{
                    backgroundColor: theme.palette.primary.main,
                    color: theme.palette.background.default,
                    py: 1.5,
                    textTransform: 'uppercase',
                  }}
                  type="submit"
                  variant="contained"
                >
                  {t('profile.update')}
                </Button>
              </Box>
            </form>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Container>
  );
};
