import CallEndIcon from '@mui/icons-material/CallEnd';
import ChatIcon from '@mui/icons-material/Chat';
import MicIcon from '@mui/icons-material/Mic';
import VideocamIcon from '@mui/icons-material/Videocam';
import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../OttehrThemeProvider';
import { patientIcon, providerIcon, registrationLogo } from '../assets/icons';
import { ProviderFields, ZapEHRLogo } from '../components';
import { FormData } from '../store/types';

export const Register: FC = (): JSX.Element => {
  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<FormData>({
    defaultValues: {
      acceptTerms: false,
      email: '',
      firstName: '',
      lastName: '',
      notPatient: false,
      password: '',
      slug: '',
      title: '',
    },
  });
  const theme = useTheme();
  const { t } = useTranslation();

  // const updateField = (field: keyof FormData, value: string | boolean): void => {
  //   setFormData((prevData) => ({
  //     ...prevData,
  //     [field]: value,
  //   }));
  // };

  const onSubmit = (data: FormData): void => {
    console.log(data);
    // TODO: form submission logic
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: { md: 'row', xs: 'column' } }}>
      {/* left side */}
      <Box
        sx={{
          backgroundColor: otherColors.darkBackgroundPaper,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          justifyContent: 'center',
          [theme.breakpoints.down('md')]: {
            py: 2,
            width: '100%',
          },
          width: '55%',
        }}
      >
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box component="img" src={registrationLogo} />
        </Box>
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            py: 10,
            [theme.breakpoints.down('md')]: {
              flexDirection: 'row',
              gap: 2,
              py: 0,
            },
          }}
        >
          <Box
            sx={{
              alignItems: 'center',
              backgroundColor: 'background.default',
              border: '5px solid #fff',
              borderColor: otherColors.borderLightBlue,
              borderRadius: 5,
              display: 'flex',
              justifyContent: 'center',
              marginLeft: 36,
              mb: 46,
              overflow: 'hidden',
              position: 'absolute',
              pt: 2,
              px: 1,
              [theme.breakpoints.down('md')]: {
                mb: 0,
                ml: 0,
                position: 'static',
              },
              zIndex: '2',
            }}
          >
            <Box component="img" src={patientIcon} />
          </Box>
          <Box
            sx={{
              backgroundColor: 'background.default',
              border: '5px solid #fff',
              borderColor: otherColors.borderLightBlue,
              borderRadius: 5,
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
              overflow: 'hidden',
              pt: 4,
              px: 2,
              zIndex: '1',
              [theme.breakpoints.down('md')]: {
                maxHeight: '118px',
                maxWidth: '118px',
                mb: 0,
                pt: 1.5,
                px: 1,
              },
            }}
          >
            <Box component="img" src={providerIcon} sx={{ mb: -1 }} />
          </Box>
          <Box
            sx={{
              alignItems: 'center',
              backgroundColor: otherColors.callIconsBackground,
              borderRadius: 5,
              display: 'flex',
              gap: 2.5,
              px: 9,
              py: 1.75,
              [theme.breakpoints.down('md')]: {
                display: 'none',
              },
            }}
          >
            <VideocamIcon style={{ color: 'white' }} />
            <MicIcon style={{ color: 'white' }} />
            <ChatIcon style={{ color: 'white' }} />
            <CallEndIcon style={{ color: 'white' }} />
          </Box>
        </Box>
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            gap: 1,
            justifyContent: 'center',
          }}
        >
          <Typography color="primary.light" component="span" variant="subtitle2">
            {t('general.footer')}
          </Typography>
          <ZapEHRLogo width={100} />
        </Box>
      </Box>
      {/* right side */}
      <Box
        sx={{
          backgroundColor: 'primary.contrast',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          justifyContent: 'center',
          [theme.breakpoints.down('md')]: {
            height: '100%',
            width: '100%',
          },
          width: '45%',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mx: { md: 12.5, xs: 2 }, my: { md: 10, xs: 4 } }}>
          <Typography mb={-1} variant="h4">
            {t('register.welcome')}
          </Typography>
          <Typography color="primary.light" mb={2} variant="h3">
            {t('register.register')}
          </Typography>
          {/* TODO form labels translated without breaking react hook form/back end submission */}
          <ProviderFields
            buttonText={t('profile.update')}
            control={control}
            errors={errors}
            isRegister
            onSubmit={handleSubmit(onSubmit)}
          />
        </Box>
      </Box>
    </Box>
  );
};
