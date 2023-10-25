import CallEndIcon from '@mui/icons-material/CallEnd';
import CancelIcon from '@mui/icons-material/Cancel';
import ChatIcon from '@mui/icons-material/Chat';
import CheckIcon from '@mui/icons-material/CheckCircle';
import MicIcon from '@mui/icons-material/Mic';
import VideocamIcon from '@mui/icons-material/Videocam';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  backgroundEllipseDark,
  backgroundEllipseLight,
  ottEHRPatientIcon,
  ottEHRProviderIcon,
  ottEHRRegistrationLogo,
} from '../assets/icons';
import { otherColors } from '../OttEHRThemeProvider';
import { ZapEHRLogo } from '../components';

interface FormData {
  acceptTerms: boolean;
  email: string;
  firstName: string;
  lastName: string;
  notPatient: boolean;
  password: string;
  roomName: string;
  title: string;
}

export const ProviderRegistration: React.FC = (): JSX.Element => {
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      title: '',
      firstName: '',
      lastName: '',
      roomName: '',
      email: '',
      password: '',
      notPatient: false,
      acceptTerms: false,
    },
  });

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

  const [roomName, setRoomName] = useState<string>('');
  const mockData = ['aykhanahmadli', 'samiromarov'];
  const isError = mockData.includes(roomName);
  const helperText = isError ? 'This name is already taken, please use another one' : '';

  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: { md: 'row', xs: 'column' } }}>
      {/* left side */}
      <Box
        sx={{
          backgroundColor: otherColors.darkBackgroundPaper,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
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
          <Box component="img" src={ottEHRRegistrationLogo} />
        </Box>
        <Box>
          <Typography color="primary.light" sx={{ py: 2, textAlign: 'center' }} variant="body1">
            Connect with patients virtually
          </Typography>
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
            component="img"
            src={backgroundEllipseDark}
            sx={{
              mb: 25,
              mr: 18,
              position: 'absolute',
              [theme.breakpoints.down('md')]: {
                maxHeight: '60%',
                maxWidth: '60%',
                mb: 0,
              },
            }}
          />
          <Box
            component="img"
            src={backgroundEllipseLight}
            sx={{
              ml: 25,
              position: 'absolute',
              [theme.breakpoints.down('md')]: {
                maxHeight: '60%',
                maxWidth: '60%',
                ml: 18,
              },
            }}
          />
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              justifyContent: 'center',
              marginLeft: 36,
              mb: 46,
              overflow: 'hidden',
              position: 'absolute',
              [theme.breakpoints.down('md')]: {
                mb: 0,
                ml: 0,
                position: 'static',
              },
              zIndex: '2',
            }}
          >
            <Box component="img" src={ottEHRPatientIcon} />
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              overflow: 'hidden',
              zIndex: '1',
              backgroundColor: otherColors.providerIconBackground,
              border: '5px solid #fff',
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
                pt: 1.5,
                px: 1,
              },
            }}
          >
            <Box component="img" src={ottEHRProviderIcon} sx={{ mb: -1 }} />
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
            Powered by
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
          <Typography variant="h4">Welcome to OttEHR</Typography>
          <Typography color="primary.light" sx={{ pb: 1 }} variant="h3">
            Provider registration
          </Typography>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box sx={{ alignItems: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Controller
                control={control}
                name="title"
                render={({ field }) => (
                  <FormControl variant="outlined">
                    <InputLabel>Title</InputLabel>
                    <Select label="Title" {...field}>
                      <MenuItem value="dr">Dr.</MenuItem>
                      <MenuItem value="nurse">Nurse</MenuItem>
                      <MenuItem value="assistant">Assistant</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
              <Controller
                control={control}
                name="firstName"
                render={({ field }) => (
                  <TextField
                    {...field}
                    helperText={errors.firstName ? String(errors.firstName.message) : null}
                    label="First Name"
                    variant="outlined"
                  />
                )}
              />
              <Controller
                control={control}
                name="lastName"
                render={({ field }) => (
                  <TextField
                    {...field}
                    helperText={errors.lastName ? String(errors.lastName.message) : null}
                    label="Last Name"
                    variant="outlined"
                  />
                )}
              />
              <Controller
                control={control}
                name="roomName"
                render={({ field }) => (
                  <>
                    <TextField
                      error={isError}
                      helperText={helperText}
                      label="Room Name"
                      onChange={(e) => {
                        setRoomName(e.target.value);
                        field.onChange(e);
                      }}
                      variant="outlined"
                    />
                    <Box sx={{ alignItems: 'center', display: 'flex' }}>
                      <Box sx={{ mr: 1 }}>{isError ? <CancelIcon color="error" /> : <CheckIcon color="success" />}</Box>
                      <Typography variant="body2">{`https://zapehr.app/${field.value}`}</Typography>
                    </Box>
                  </>
                )}
              />
              <Controller
                control={control}
                name="email"
                render={({ field }) => <TextField {...field} label="Email Address" variant="outlined" />}
              />
              <Controller
                control={control}
                name="password"
                render={({ field }) => <TextField {...field} label="Password" type="password" variant="outlined" />}
              />
              <Controller
                control={control}
                defaultValue={false}
                name="notPatient"
                render={({ field: { onChange, value } }) => (
                  <FormControlLabel
                    control={<Checkbox checked={value} onChange={onChange} />}
                    label="I am not a patient"
                  />
                )}
              />
              <Controller
                control={control}
                defaultValue={false}
                name="acceptTerms"
                render={({ field: { onChange, value } }) => (
                  <FormControlLabel
                    control={<Checkbox checked={value} onChange={onChange} />}
                    label="I accept the terms and conditions"
                  />
                )}
              />
              <Button type="submit" variant="contained">
                Sign Up
              </Button>
            </Box>
          </form>
        </Box>
      </Box>
    </Box>
  );
};
