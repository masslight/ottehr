import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';

type Props = {
  name?: string;
  email?: string;
  phoneNumber?: string;
};

const ProviderRegistration = (props: Props): JSX.Element => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', height: '100vh' }}>
      <p>{props.name}</p>
      <p>{props.email}</p>
      <p>{props.phoneNumber}</p>
      {/* left side */}
      <Box sx={{ width: '55%', backgroundColor: '#263954' }}>
        <Box
          sx={{
            marginTop: '5rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Typography sx={{ color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: '1.5rem' }}>
            NEW LOGO
          </Typography>
        </Box>
        <Box sx={{ marginTop: '1rem' }}>
          <Typography sx={{ color: '#4AC0F2', textAlign: 'center', fontSize: '1rem' }}>
            Connect with patients virtually
          </Typography>
        </Box>
        <Box sx={{ height: '74%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {/* Content will go here */}
        </Box>
        <Box
          sx={{
            marginBottom: '4rem',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Typography component="span" sx={{ color: '#4AC0F2', fontSize: '0.875rem' }}>
            Powered by _
          </Typography>
          <Typography component="span" sx={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>
            zapEHR
          </Typography>
        </Box>
      </Box>

      {/* right side */}
      <Box sx={{ width: '45%', height: '100%', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ margin: '5rem 6.25rem', display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: '2.125rem' }}>Welcome to [app name]</Typography>
          <Typography sx={{ fontSize: '1.25rem', color: '#4AC0F2', paddingTop: '1%', paddingBottom: '1%' }}>
            Provider registration
          </Typography>
          <form>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'left', paddingY: '1.5rem' }}>
              {/* Title */}
              <FormControl variant="outlined" sx={{ width: '26.4rem', marginBottom: '1rem' }}>
                <InputLabel>Title</InputLabel>
                <Select label="Title">
                  <MenuItem value="dr">Dr.</MenuItem>
                  <MenuItem value="nurse">Nurse</MenuItem>
                  <MenuItem value="assistant">Assistant</MenuItem>
                </Select>
              </FormControl>
              {/* First Name */}
              <TextField variant="outlined" label="First Name" sx={{ width: '26.4rem', paddingBottom: '1rem' }} />
              {/* Last Name */}
              <TextField variant="outlined" label="Last Name" sx={{ width: '26.4rem', paddingBottom: '1rem' }} />
              {/* Room Name */}
              <TextField variant="outlined" label="Room Name" sx={{ width: '26.4rem', paddingBottom: '1rem' }} />
              {/* Email Address */}
              <TextField variant="outlined" label="Email Address" sx={{ width: '26.4rem', paddingBottom: '1rem' }} />
              {/* Password */}
              <TextField
                variant="outlined"
                label="Password"
                type="password"
                sx={{ width: '26.4rem', paddingBottom: '1rem' }}
              />
              {/* I am not a patient Checkbox */}
              <FormControlLabel control={<Checkbox />} label="I am not a patient" />

              {/* I accept the terms and conditions Checkbox */}
              <FormControlLabel control={<Checkbox />} label="I accept the terms and conditions" />
              {/* SIGN UP Button */}
              <Button
                type="submit"
                variant="contained"
                sx={{
                  width: '28rem',
                  backgroundColor: '#2896C6',
                  color: 'white',
                  marginTop: '1rem',
                  textTransform: 'uppercase',
                  borderRadius: '4px',
                }}
              >
                Sign Up
              </Button>
            </Box>
          </form>
        </Box>
      </Box>
    </Box>
  );
};

export default ProviderRegistration;
