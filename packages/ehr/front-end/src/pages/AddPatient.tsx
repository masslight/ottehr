import {
  Autocomplete,
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../layout/PageContainer';
import LocationSelect from '../components/LocationSelect';
import { Location } from 'fhir/r4';
import DateSearch from '../components/DateSearch';
import { DateTime } from 'luxon';
import { useIntakeZambdaClient } from '../hooks/useIntakeZambdaClient';
import { createAppointment } from '../api/api';
import { CreateAppointmentParameters, PersonSex, VisitType } from '../types/types';
import { ReasonForVisitOptions, MAXIMUM_CHARACTER_LIMIT } from '../constants';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import { PatternFormat } from 'react-number-format';

export default function AddPatient(): ReactElement {
  // state variables
  const [locationSelected, setLocationSelected] = useState<Location | undefined>(undefined);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [birthDate, setBirthDate] = useState<DateTime | null>(null);
  const [sex, setSex] = useState<PersonSex | ''>('');
  const [mobilePhone, setMobilePhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [reasonForVisit, setReasonForVisit] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ submit?: boolean; phone?: boolean }>({
    submit: false,
    phone: false,
  });
  const [inputValue, setInputValue] = useState<string>('');
  const [validDate, setValidDate] = useState<boolean>(true);
  const [validReasonForVisit, setValidReasonForVisit] = useState<boolean>(true);

  // general variables
  const navigate = useNavigate();
  const zambdaClient = useIntakeZambdaClient();
  const reasonForVisitErrorMessage = `Input cannot be more than ${MAXIMUM_CHARACTER_LIMIT} characters`;
  const phoneNumberErrorMessage = 'Phone number must be 10 digits';

  const handleReasonsForVisitChange = (newValues: string[]): void => {
    setValidReasonForVisit(newValues.join(', ').length <= MAXIMUM_CHARACTER_LIMIT);
    setReasonForVisit(newValues);
  };

  // handle functions
  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (mobilePhone.length !== 10) {
      setErrors({ phone: true });
      return;
    } else {
      setErrors({});
    }

    if (validDate && validReasonForVisit) {
      setLoading(true);

      if (!zambdaClient) throw new Error('Zambda client not found');
      const zambdaParams: CreateAppointmentParameters = {
        patient: {
          id: undefined,
          newPatient: true,
          pointOfDiscovery: false,
          firstName: firstName,
          lastName: lastName,
          dateOfBirth: birthDate?.toISODate() || undefined,
          sex: sex || undefined,
          phoneNumber: mobilePhone,
          email: email,
          emailUser: 'Patient',
          reasonForVisit: reasonForVisit,
        },
        visitType: VisitType.WalkIn,
        location: locationSelected?.id,
      };

      let response;
      let apiErr = false;
      try {
        response = await createAppointment(zambdaClient, zambdaParams);
      } catch (error) {
        console.log(`Failed to add patient: ${error}`);
        apiErr = true;
      } finally {
        setLoading(false);
        if (response && !apiErr) {
          navigate('/appointments');
        } else {
          setErrors({ submit: true });
        }
      }
    }
  };

  return (
    <PageContainer>
      <Grid container direction="row">
        <Grid item xs={3.5} />
        <Grid item xs={5}>
          <CustomBreadcrumbs
            chain={[
              { link: '/appointments', children: 'Tracking Board' },
              { link: '#', children: 'Add Patient' },
            ]}
          />

          {/* page title */}

          <Typography variant="h3" marginTop={1} color={'primary.dark'}>
            Add Patient
          </Typography>

          {/* form content */}
          <Paper>
            <form onSubmit={(e) => handleFormSubmit(e)}>
              <Box padding={3} marginTop={2}>
                {/* Location Select */}
                <Typography variant="h4" color="primary.dark">
                  Office
                </Typography>

                {/* location search */}
                <Box sx={{ marginTop: 2 }}>
                  <LocationSelect location={locationSelected} setLocation={setLocationSelected} required />
                </Box>

                {/* Patient information */}
                <Box>
                  <Typography variant="h4" color="primary.dark" sx={{ marginTop: 4 }}>
                    Patient information
                  </Typography>
                  <Box marginTop={2}>
                    <Box>
                      <Grid container direction="row" justifyContent="space-between">
                        <Grid item xs={5.85}>
                          <TextField
                            label="First Name"
                            variant="outlined"
                            required
                            fullWidth
                            onChange={(event) => {
                              setFirstName(event.target.value);
                            }}
                          ></TextField>
                        </Grid>
                        <Grid item xs={5.85}>
                          <TextField
                            label="Last Name"
                            variant="outlined"
                            required
                            fullWidth
                            onChange={(event) => {
                              setLastName(event.target.value);
                            }}
                          ></TextField>
                        </Grid>
                      </Grid>
                    </Box>

                    <Box marginTop={3}>
                      <Grid container direction="row" justifyContent="space-between">
                        <Grid item xs={5.85}>
                          <DateSearch
                            date={birthDate}
                            setDate={setBirthDate}
                            defaultValue={null}
                            label="Date of birth"
                            required
                            ageRange={{ min: 0, max: 26 }}
                            setValidDate={setValidDate}
                          ></DateSearch>
                        </Grid>
                        <Grid item xs={5.85}>
                          <FormControl fullWidth>
                            <InputLabel id="sex-at-birth-label">Sex at birth *</InputLabel>
                            <Select
                              labelId="sex-at-birth-label"
                              id="sex-at-birth-select"
                              value={sex}
                              label="Sex at birth*"
                              required
                              onChange={(event) => {
                                setSex(event.target.value as PersonSex);
                              }}
                            >
                              <MenuItem value={PersonSex.Male}>Male</MenuItem>
                              <MenuItem value={PersonSex.Female}>Female</MenuItem>
                              <MenuItem value={PersonSex.Intersex}>Intersex</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Box>

                    <Box marginTop={2}>
                      <Grid container direction="row" justifyContent="space-between">
                        <Grid item xs={12}>
                          <PatternFormat
                            customInput={TextField}
                            value={mobilePhone}
                            format="(###) ###-####"
                            mask=" "
                            label="Mobile Phone"
                            variant="outlined"
                            placeholder="(XXX) XXX-XXXX"
                            fullWidth
                            required
                            error={errors.phone}
                            helperText={errors?.phone ? phoneNumberErrorMessage : ''}
                            onValueChange={(values, sourceInfo) => {
                              if (sourceInfo.source === 'event') {
                                setMobilePhone(values.value);
                              }
                            }}
                          />
                        </Grid>

                        <Grid item xs={12} marginTop={2}>
                          <TextField
                            label="Email"
                            variant="outlined"
                            fullWidth
                            onChange={(event) => {
                              setEmail(event.target.value);
                            }}
                            type="email"
                          ></TextField>
                        </Grid>
                      </Grid>
                    </Box>
                  </Box>
                </Box>

                {/* Visit Information */}
                <Box marginTop={4}>
                  <Typography variant="h4" color="primary.dark">
                    Visit information
                  </Typography>
                  <Box marginTop={2}>
                    <Autocomplete
                      multiple
                      autoComplete
                      disableClearable
                      forcePopupIcon
                      id="reason-for-visit-label"
                      options={ReasonForVisitOptions}
                      freeSolo
                      value={reasonForVisit}
                      inputValue={inputValue}
                      onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
                      onChange={(_, newValue) => handleReasonsForVisitChange(newValue)}
                      onBlur={() => {
                        if (inputValue.trim() !== '') {
                          handleReasonsForVisitChange([...reasonForVisit, inputValue.trim()]);
                        }
                        setInputValue('');
                      }}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip variant="outlined" label={option} {...getTagProps({ index })} sx={{ fontSize: 16 }} />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Reason for visit"
                          variant="outlined"
                          fullWidth
                          required={reasonForVisit.length === 0}
                          error={!validReasonForVisit}
                          helperText={validReasonForVisit ? '' : reasonForVisitErrorMessage}
                        />
                      )}
                      sx={{
                        width: '100%',
                        mt: 2,
                        '& .MuiFilledInput-root': {
                          fontSize: 16,
                          p: 0.5,
                          border: '1px solid',
                          borderRadius: 2,
                          '&::before, ::after, :hover:not(.Mui-disabled, .Mui-error)::before': {
                            borderBottom: 0,
                          },
                        },
                      }}
                    />
                  </Box>
                </Box>

                {/* form buttons */}
                <Box marginTop={4}>
                  {errors.submit && (
                    <Typography color="error" variant="body2" mb={2}>
                      Failed to add patient. Please try again.
                    </Typography>
                  )}
                  <LoadingButton
                    variant="contained"
                    type="submit"
                    loading={loading}
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                      marginRight: 1,
                    }}
                  >
                    Add walk-in
                  </LoadingButton>
                  <Button
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                    }}
                    onClick={() => {
                      navigate('/appointments');
                    }}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            </form>
          </Paper>
        </Grid>

        <Grid item xs={3.5} />
      </Grid>
    </PageContainer>
  );
}
