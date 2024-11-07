import { LoadingButton } from '@mui/lab';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  Paper,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { FHIR_IDENTIFIER_NPI, PractitionerLicense, PractitionerQualificationCode, RoleType, User } from 'ehr-utils';
import { otherColors } from '../CustomThemeProvider';
import { updateUser } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import { AllStates } from '../types/types';
import { PractitionerQualificationCodesLabels } from 'ehr-utils';
import useOttehrUser from '../hooks/useOttehrUser';

const displaystates = AllStates.map((state) => state.value);

interface EditEmployeeInformationProps {
  submitLabel: string;
  existingUser?: User;
  isActive?: boolean;
  licenses: PractitionerLicense[];
}

interface EmployeeForm {
  firstName: string;
  middleName: string;
  lastName: string;
  nameSuffix: string;
  roles: string[];
}

const AVAILABLE_ROLES: {
  value: RoleType;
  label: string;
  hint: string;
}[] = [
  {
    value: RoleType.Administrator,
    label: 'Administrator',
    hint: `Adjust full settings for entire system`,
  },
  {
    value: RoleType.Manager,
    label: 'Manager',
    hint: `Adjust operating hours or schedule overrides; adjust pre-booked visits per hour`,
  },
  {
    value: RoleType.Staff,
    label: 'Staff',
    hint: `No settings changes; essentially read-only`,
  },
  {
    value: RoleType.Provider,
    label: 'Provider',
    hint: `No settings changes; essentially read-only`,
  },
];

if (import.meta.env.MODE === 'default' || import.meta.env.MODE === 'development') {
  AVAILABLE_ROLES.push(
    {
      value: RoleType.AssistantAdmin,
      label: 'Assitant admin',
      hint: 'Todo description',
    },
    {
      value: RoleType.RegionalTelemedLead,
      label: 'Regional Telemed lead',
      hint: 'Todo description',
    },
    {
      value: RoleType.CallCentre,
      label: 'Call Centre',
      hint: 'Todo description',
    },
    {
      value: RoleType.Billing,
      label: 'Billing',
      hint: 'Todo description',
    },
  );
}

export default function EmployeeInformationForm({
  submitLabel,
  existingUser,
  isActive,
  licenses,
}: EditEmployeeInformationProps): JSX.Element {
  const { zambdaClient } = useApiClients();
  const theme = useTheme();
  const currentUser = useOttehrUser();
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState({
    submit: false,
    roles: false,
    qualification: false,
    state: false,
    duplicateLicense: false,
  });

  const [newLicenseState, setNewLicenseState] = useState<string | undefined>(undefined);
  const [newLicenseCode, setNewLicenseCode] = useState<string | undefined>(undefined);
  const [newLicenses, setNewLicenses] = useState<PractitionerLicense[]>(licenses);

  // Form should have its own user state so it doesn't override page title when title is user name
  const [user, setUser] = useState<User>({
    name: '',
    email: '',
    id: '',
    profile: '',
    accessPolicy: {},
    roles: [],
    phoneNumber: '',
    profileResource: undefined,
  });

  console.log('existingUser', existingUser);

  let npiText = 'n/a';
  if (existingUser?.profileResource?.identifier) {
    const npi = existingUser.profileResource.identifier.find((identifier) => identifier.system === FHIR_IDENTIFIER_NPI);
    if (npi && npi.value) {
      npiText = npi.value;
    }
  }

  let phoneText = '';
  if (existingUser?.profileResource?.telecom) {
    const phone = existingUser.profileResource.telecom.find((tel) => tel.system === 'sms')?.value;
    if (phone) {
      phoneText = phone;
    }
  }

  let photoSrc = '';
  if (existingUser?.profileResource?.photo) {
    const photo = existingUser.profileResource.photo[0];
    if (photo.url) {
      photoSrc = photo.url;
    } else if (photo.data) {
      photoSrc = `data:${photo.contentType};base64,${photo.data}`;
    }
  }

  const { control, handleSubmit, setValue, getValues } = useForm<EmployeeForm>();

  useWatch({ control, name: 'roles' });

  useEffect(() => {
    // Set user and form values
    if (existingUser) {
      setUser(existingUser);
      setValue('roles', (existingUser as User).roles?.map((role) => role.name) || '');

      let firstName = '';
      let middleName = '';
      let lastName = '';
      let nameSuffix = '';
      if (existingUser.profileResource?.name && existingUser.profileResource?.name.length > 0) {
        const name = existingUser.profileResource?.name[0];
        firstName = name.given?.[0] ?? '';
        middleName = name.given?.length && name.given.length > 1 ? name.given.slice(1).join(' ') : '';
        lastName = name.family ?? '';
        nameSuffix = name.suffix?.join(' ') ?? '';
      }
      setValue('firstName', firstName);
      setValue('middleName', middleName);
      setValue('lastName', lastName);
      setValue('nameSuffix', nameSuffix);
    }
  }, [existingUser, setValue]);

  const isProviderRoleSelected = getValues('roles')?.includes(RoleType.Provider) ?? false;

  const updateUserRequest = async (data: EmployeeForm): Promise<void> => {
    if (!zambdaClient) {
      throw new Error('Zambda Client not found');
    }

    if (data.roles.length < 1) {
      setErrors((prev) => ({ ...prev, submit: false, roles: true }));
      return;
    } else {
      setErrors((prev) => ({ ...prev, ...{ roles: false } }));
    }

    setLoading(true);

    try {
      await updateUser(zambdaClient, {
        userId: user.id,
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        nameSuffix: data.nameSuffix,
        selectedRoles: data.roles,
        licenses: newLicenses,
      });
    } catch (error) {
      console.log(`Failed to update user: ${error}`);
      setErrors((prev) => ({ ...prev, submit: true }));
    } finally {
      setLoading(false);
    }
  };

  const handleAddLicense = async (): Promise<void> => {
    setErrors((prev) => ({ ...prev, state: false, qualification: false, duplicateLicense: false }));

    if (newLicenses.find((license) => license.state === newLicenseState && license.code === newLicenseCode)) {
      setErrors((prev) => ({ ...prev, duplicateLicense: true }));
      return;
    }
    if (!newLicenseCode || !newLicenseState) {
      setErrors((prev) => ({
        ...prev,
        qualification: !newLicenseCode,
        state: !newLicenseState,
      }));
      return;
    }
    const updatedLicenses = [...newLicenses];
    updatedLicenses.push({
      state: newLicenseState,
      code: newLicenseCode as PractitionerQualificationCode,
      active: true,
    });
    setNewLicenses(updatedLicenses);
    setNewLicenseState(undefined);
    setNewLicenseCode(undefined);
  };

  return isActive === undefined ? (
    <Skeleton height={300} sx={{ marginY: -5 }} />
  ) : (
    <Paper sx={{ padding: 3 }}>
      <form onSubmit={(event) => handleSubmit((data) => updateUserRequest(data))(event)}>
        <FormLabel
          sx={{
            ...theme.typography.h4,
            color: theme.palette.primary.dark,
            mb: 1,
            fontWeight: '600 !important',
          }}
        >
          Employee information
        </FormLabel>
        <Controller
          name="firstName"
          control={control}
          render={({ field: { onChange, value } }) => (
            <TextField
              id="outlined-read-only-input"
              label="First name"
              required={true}
              value={value || ''}
              onChange={onChange}
              sx={{ marginTop: 2, marginBottom: 1, width: '100%' }}
              margin="dense"
            />
          )}
        />
        <Controller
          name="middleName"
          control={control}
          render={({ field: { onChange, value } }) => (
            <TextField
              id="outlined-read-only-input"
              label="Middle name"
              value={value || ''}
              onChange={onChange}
              sx={{ marginTop: 2, marginBottom: 1, width: '100%' }}
              margin="dense"
            />
          )}
        />
        <Controller
          name="lastName"
          control={control}
          render={({ field: { onChange, value } }) => (
            <TextField
              id="outlined-read-only-input"
              label="Last name"
              required={true}
              value={value || ''}
              onChange={onChange}
              sx={{ marginBottom: 2, width: '100%' }}
              margin="dense"
            />
          )}
        />
        <TextField
          id="outlined-read-only-input"
          label="Email"
          value={existingUser?.email ?? ''}
          sx={{ marginBottom: 2, width: '100%' }}
          margin="dense"
          InputProps={{
            readOnly: true,
            disabled: true,
          }}
        />
        <TextField
          id="outlined-read-only-input"
          label="Phone"
          value={phoneText}
          sx={{ marginBottom: 2, width: '100%' }}
          margin="dense"
          InputProps={{
            readOnly: true,
            disabled: true,
          }}
        />

        <FormControl sx={{ width: '100%' }} error={errors.roles}>
          <FormLabel
            sx={{
              ...theme.typography.h4,
              color: theme.palette.primary.dark,
              mb: 1,
              mt: 2,
              fontWeight: '600 !important',
            }}
          >
            Role
          </FormLabel>
          <FormLabel sx={{ fontWeight: 700, fontSize: '12px' }}>Select role *</FormLabel>
          <FormGroup>
            {AVAILABLE_ROLES.map((roleEntry, index) => {
              const roles = getValues('roles') ?? [];
              const isChecked = roles.includes(roleEntry.value);
              return (
                <Box key={index}>
                  <FormControlLabel
                    value={roleEntry.value}
                    name="roles"
                    checked={isChecked}
                    onChange={(e, checked) => {
                      const currentRoles = getValues('roles');
                      const newRoles = checked
                        ? [...currentRoles, roleEntry.value]
                        : currentRoles.filter((role) => role !== roleEntry.value);
                      setValue('roles', newRoles);
                    }}
                    control={<Checkbox />}
                    disabled={!isActive || !currentUser?.hasRole([RoleType.Administrator])}
                    label={roleEntry.label}
                    sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
                  />
                  <Box ml={4} sx={{ marginTop: '-10px', marginBottom: '5px' }}>
                    <Typography sx={{ color: otherColors.noteText }} variant="body2">
                      {roleEntry.hint}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </FormGroup>
        </FormControl>

        {isProviderRoleSelected && (
          <>
            <FormControl sx={{ width: '100%' }}>
              <FormLabel
                sx={{
                  ...theme.typography.h4,
                  color: theme.palette.primary.dark,
                  mt: 3,
                  fontWeight: '600 !important',
                }}
              >
                Provider details
              </FormLabel>
              {photoSrc && <img src={photoSrc} width="110" height="110" style={{ borderRadius: '50%' }} />}
              <Controller
                name="nameSuffix"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <TextField
                    id="outlined-read-only-input"
                    label="Credentials"
                    value={value || ''}
                    onChange={onChange}
                    sx={{ marginTop: 3, width: '100%' }}
                    margin="dense"
                  />
                )}
              />
              <label style={{ margin: '15px 0' }}>NPI: {npiText}</label>
            </FormControl>
            {isProviderRoleSelected && (
              <>
                <FormControl sx={{ width: '100%' }}>
                  <FormLabel
                    sx={{
                      ...theme.typography.h4,
                      color: theme.palette.primary.dark,
                      mt: 3,
                      fontWeight: '600 !important',
                    }}
                  >
                    Provider Qualifications
                  </FormLabel>
                  <Box mt={1}>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>State</TableCell>
                            <TableCell align="left">Qualification</TableCell>
                            <TableCell align="left">Operate in state</TableCell>
                            <TableCell align="left">Delete License</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {newLicenses.map((license, index) => (
                            <TableRow key={index}>
                              <TableCell>{license.state}</TableCell>
                              <TableCell align="left">{license.code}</TableCell>
                              <TableCell align="center">
                                <Switch
                                  checked={license.active}
                                  onChange={async () => {
                                    const updatedLicenses = [...newLicenses];
                                    updatedLicenses[index].active = !updatedLicenses[index].active;

                                    setNewLicenses(updatedLicenses);
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  sx={{
                                    color: theme.palette.error.dark,
                                    ':hover': {
                                      backgroundColor: theme.palette.error.light,
                                      color: theme.palette.error.contrastText,
                                    },
                                  }}
                                  onClick={async () => {
                                    const updatedLicenses = [...newLicenses];
                                    updatedLicenses.splice(index, 1);

                                    setNewLicenses(updatedLicenses);
                                  }}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Accordion>
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          marginTop: '20px',
                          fontWeight: 'bold',
                          color: theme.palette.primary.main,
                          cursor: 'pointer',
                        }}
                      >
                        Add New State Qualification
                      </AccordionSummary>
                      <AccordionDetails>
                        <form>
                          <Grid container direction={'row'} spacing={1}>
                            <Grid item xs={4}>
                              <Autocomplete
                                options={displaystates}
                                getOptionLabel={(option: string) => option}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    label="State"
                                    error={errors.state}
                                    required
                                    helperText={errors.state ? 'Please select a state' : null}
                                  />
                                )}
                                value={newLicenseState || null}
                                onChange={(event, value) => setNewLicenseState(value || undefined)}
                              />
                            </Grid>
                            <Grid item xs={4}>
                              <Autocomplete
                                options={Object.keys(PractitionerQualificationCodesLabels)}
                                getOptionLabel={(option: string) => option}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    label="Qualification"
                                    error={errors.qualification}
                                    required
                                    helperText={errors.qualification ? 'Please select a qualification' : null}
                                  />
                                )}
                                value={newLicenseCode || null}
                                onChange={(event, value) => setNewLicenseCode(value || undefined)}
                              />
                            </Grid>
                            <Grid item xs={4} alignContent={'center'}>
                              <Button
                                variant="contained"
                                endIcon={<AddIcon />}
                                sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: 28 }}
                                fullWidth
                                onClick={handleAddLicense}
                              >
                                Add
                              </Button>
                            </Grid>
                            {errors.duplicateLicense && (
                              <Typography
                                color="error"
                                variant="body2"
                                mt={1}
                                mx={1}
                              >{`License already exists.`}</Typography>
                            )}
                          </Grid>
                        </form>
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                </FormControl>
              </>
            )}
          </>
        )}

        {/* Error on submit if request fails */}
        {errors.submit && (
          <Typography color="error" variant="body2" mt={1}>{`Failed to update user. Please try again.`}</Typography>
        )}

        {/* Update Employee and Cancel Buttons */}
        <Grid sx={{ marginTop: 4, marginBottom: 2 }}>
          <LoadingButton
            variant="contained"
            color="primary"
            sx={{
              textTransform: 'none',
              borderRadius: 28,
              fontWeight: 'bold',
              marginRight: 1,
            }}
            type="submit"
            loading={loading}
            disabled={!isActive}
          >
            {submitLabel}
          </LoadingButton>

          <Link to="/employees">
            <Button
              variant="text"
              color="primary"
              sx={{
                textTransform: 'none',
                borderRadius: 28,
                fontWeight: 'bold',
              }}
            >
              Cancel
            </Button>
          </Link>
        </Grid>
      </form>
    </Paper>
  );
}
