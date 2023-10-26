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
  OttehrPatientIcon,
  OttehrProviderIcon,
  OttehrRegistrationLogo,
} from '../assets/icons';
import { otherColors } from '../OttehrThemeProvider';
import { ZapEHRLogo } from '../components';

interface FormData {
  title: string;
  firstName: string;
  lastName: string;
  roomName: string;
  email: string;
  password: string;
  notPatient: boolean;
  acceptTerms: boolean;
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
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* left side */}
      <Box
        sx={{
          backgroundColor: otherColors.darkBackgroundPaper,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 2,
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
          <Box component="img" src={OttehrRegistrationLogo} />
        </Box>
        <Box>
          <Typography color="primary.light" variant="body1" sx={{ textAlign: 'center', py: 2 }}>
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
              py: 0,
              gap: 2,
            },
          }}
        >
          <Box
            component="img"
            src={backgroundEllipseDark}
            sx={{
              position: 'absolute',
              mb: 25,
              mr: 18,
              [theme.breakpoints.down('md')]: {
                maxWidth: '60%',
                maxHeight: '60%',
                mb: 0,
              },
            }}
          />
          <Box
            component="img"
            src={backgroundEllipseLight}
            sx={{
              position: 'absolute',
              ml: 25,
              [theme.breakpoints.down('md')]: {
                maxWidth: '60%',
                maxHeight: '60%',
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
                position: 'static',
                mb: 0,
                ml: 0,
              },
              zIndex: '2',
            }}
          >
            <Box component="img" src={OttehrPatientIcon} />
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
              mb: 2,
              px: 2,
              pt: 4,
              [theme.breakpoints.down('md')]: {
                maxWidth: '118px',
                maxHeight: '118px',
                pt: 1.5,
                px: 1,
              },
            }}
          >
            <Box component="img" src={OttehrProviderIcon} sx={{ mb: -1 }} />
          </Box>
          <Box
            sx={{
              alignItems: 'center',
              backgroundColor: otherColors.callIconsBackground,
              borderRadius: 5,
              display: 'flex',
              gap: 2.5,
              py: 1.75,
              px: 9,
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
            width: '100%',
            height: '100%',
          },
          width: '45%',
        }}
      >
        <Box sx={{ mx: { xs: 2, md: 12.5 }, my: { xs: 4, md: 10 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="h4">Welcome to Ottehr</Typography>
          <Typography color="primary.light" variant="h3" sx={{ pb: 1 }}>
            Provider registration
          </Typography>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box sx={{ alignItems: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Controller
                name="title"
                control={control}
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
                name="firstName"
                control={control}
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
                name="lastName"
                control={control}
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
                name="roomName"
                control={control}
                render={({ field }) => (
                  <>
                    <TextField
                      label="Room Name"
                      variant="outlined"
                      error={isError}
                      helperText={helperText}
                      onChange={(e) => {
                        setRoomName(e.target.value);
                        field.onChange(e);
                      }}
                    />
                    <Box sx={{ alignItems: 'center', display: 'flex' }}>
                      <Box sx={{ mr: 1 }}>{isError ? <CancelIcon color="error" /> : <CheckIcon color="success" />}</Box>
                      <Typography variant="body2">{`https://zapehr.app/${field.value}`}</Typography>
                    </Box>
                  </>
                )}
              />
              <Controller
                name="email"
                control={control}
                render={({ field }) => <TextField {...field} label="Email Address" variant="outlined" />}
              />
              <Controller
                name="password"
                control={control}
                render={({ field }) => <TextField {...field} label="Password" type="password" variant="outlined" />}
              />
              <Controller
                name="notPatient"
                control={control}
                defaultValue={false}
                render={({ field: { onChange, value } }) => (
                  <FormControlLabel
                    control={<Checkbox onChange={onChange} checked={value} />}
                    label="I am not a patient"
                  />
                )}
              />
              <Controller
                name="acceptTerms"
                control={control}
                defaultValue={false}
                render={({ field: { onChange, value } }) => (
                  <FormControlLabel
                    control={<Checkbox onChange={onChange} checked={value} />}
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
