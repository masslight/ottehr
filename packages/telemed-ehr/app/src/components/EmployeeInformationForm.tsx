import ClearIcon from '@mui/icons-material/Clear';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Grid,
  InputLabel,
  MenuItem,
  MenuProps,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  Typography,
  useTheme,
} from '@mui/material';
import IconButton from '@mui/material/IconButton';
import { User } from '@zapehr/sdk';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { PractitionerLicense, PractitionerQualificationCode, PractitionerQualificationCodesDisplay } from 'ehr-utils';
import { otherColors } from '../CustomThemeProvider';
import { updateUser } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { AllStates, RoleType, State } from '../types/types';

interface EditEmployeeInformationProps {
  submitLabel: string;
  existingUser?: User;
  isActive?: boolean;
}

interface EmployeeFormLicense extends Omit<PractitionerLicense, 'code'> {
  code: PractitionerQualificationCode | '';
}

interface EmployeeForm {
  licenses: EmployeeFormLicense[];
  role: RoleType;
}

const SELECT_MENU_PROPS: Partial<MenuProps> = {
  PaperProps: {
    sx: {
      '& .MuiMenuItem-root:hover': {
        backgroundColor: otherColors.selectMenuHover,
      },
    },
  },
};

const AVAILABLE_ROLES: {
  value: RoleType;
  label: string;
  hint: string;
}[] = [
  {
    value: RoleType.Administrator,
    label: 'Administrator',
    hint: `Adjust/edit frequency/slots; all copy/message edits; invite users or inactivate users`,
  },
  {
    value: RoleType.Manager,
    label: 'Manager',
    hint: `Grant existing users site/queue access; adjust operating hours or special hours/schedule overrides;
           adjust # of providers (eventually provider level/type)`,
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

export default function EmployeeInformationForm({
  submitLabel,
  existingUser,
  isActive,
}: EditEmployeeInformationProps): JSX.Element {
  const navigate = useNavigate();
  const { zambdaClient } = useApiClients();
  const theme = useTheme();
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState({ submit: false });

  const { control, handleSubmit, setValue, getValues } = useForm<EmployeeForm>();
  const { fields, replace, append, remove } = useFieldArray({
    control,
    name: 'licenses',
  });
  const licenses = useWatch({ control, name: 'licenses' });

  const removeButtonEnabled = licenses?.length > 1 || licenses?.[0]?.code || licenses?.[0]?.state;

  // Form should have its own user state so it doesn't override page title when title is user name
  const [user, setUser] = useState<User>({
    name: '',
    email: '',
    id: '',
    profile: '',
    accessPolicy: {},
  });

  useEffect(() => {
    // Set user and form values
    if (existingUser) {
      setUser(existingUser);
      setValue('role', (existingUser as any).roles[0]?.name || '');

      replace([...((existingUser as any)?.licenses as PractitionerLicense[]), { code: '', state: '' }]);
    }
  }, [existingUser, replace, setValue]);

  const handleRemove = (index: number): void => {
    if (fields.length > 1) {
      remove(index);
    } else {
      setValue('licenses.0', { code: '', state: '' });
    }
  };

  const handleAddNewLicense = async (): Promise<void> => {
    append({ code: '', state: '' });
  };

  const updateUserRequest = async (data: EmployeeForm): Promise<void> => {
    setLoading(true);

    if (!zambdaClient) {
      throw new Error('Zambda Client not found');
    }

    // Update the user
    let apiErr = false;
    try {
      await updateUser(zambdaClient, {
        userId: user.id,
        selectedRole: data.role,
        licenses: (data.licenses as PractitionerLicense[]).filter((license) => license.code && license.state),
      });
    } catch (error) {
      console.log(`Failed to update user: ${error}`);
      setErrors((prev) => ({ ...prev, submit: true }));
      apiErr = true;
    } finally {
      setLoading(false);
      !apiErr && navigate('/employees');
    }
  };

  return isActive === undefined ? (
    <Skeleton height={300} sx={{ marginY: -5 }} />
  ) : (
    <Paper sx={{ padding: 3 }}>
      <form onSubmit={(event) => handleSubmit((data) => updateUserRequest(data))(event)}>
        <Controller
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <FormControl error={!!error} sx={{ width: '100%' }}>
              <FormLabel
                sx={{ ...theme.typography.h4, color: theme.palette.primary.dark, mb: 1, fontWeight: '600 !important' }}
              >
                Role
              </FormLabel>
              <FormLabel sx={{ fontWeight: 700, fontSize: '12px' }}>Select role</FormLabel>
              <RadioGroup name="roles-radio" value={value || ''} onChange={onChange}>
                {AVAILABLE_ROLES.map((roleEntry) => (
                  <>
                    <FormControlLabel
                      key={roleEntry.value}
                      value={roleEntry.value}
                      control={<Radio />}
                      disabled={!isActive}
                      label={roleEntry.label}
                      sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
                    />
                    <Box ml={4}>
                      <Typography sx={{ color: otherColors.noteText }} variant="body2">
                        {roleEntry.hint}
                      </Typography>
                    </Box>
                  </>
                ))}
              </RadioGroup>
              <FormHelperText>{error?.message}</FormHelperText>
            </FormControl>
          )}
          name={`role`}
          control={control}
          rules={{
            validate: (role) => {
              if (AVAILABLE_ROLES.findIndex((entry) => entry.value === role) >= 0) return undefined;
              else return 'Role is required';
            },
          }}
        />

        <Box mt={2}>
          <FormLabel
            sx={{
              ...theme.typography.h4,
              color: theme.palette.primary.dark,
              mb: 2,
              fontWeight: '600 !important',
              display: 'block',
            }}
          >
            Licenses
          </FormLabel>
          {fields.map((field, index) => (
            <Box key={field.id} style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
              <Controller
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <FormControl sx={{ width: '100%' }} error={!!error}>
                    <InputLabel id={`multiple-checkbox-label-${field.id}`}>State *</InputLabel>
                    <Select
                      label="State *"
                      labelId={`multiple-checkbox-label-${field.id}-state`}
                      id={`multiple-checkbox-${field.id}-state`}
                      value={value}
                      onChange={onChange}
                      sx={{
                        width: '100%',
                      }}
                      MenuProps={SELECT_MENU_PROPS}
                    >
                      {AllStates.map((state: State, idx: number) => (
                        <MenuItem key={idx} value={state.value}>
                          {state.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {error && (
                      <FormHelperText sx={{ color: otherColors.priorityHighText, width: '100%' }}>
                        {'Please select an option.'}
                      </FormHelperText>
                    )}
                  </FormControl>
                )}
                name={`licenses.${index}.state`}
                control={control}
                rules={{
                  validate: (field) => {
                    const code = getValues(`licenses.${index}.code`);
                    if (Boolean(code) && !field) {
                      return 'State is required';
                    }
                    return undefined;
                  },
                }}
              />
              <Controller
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                  <FormControl sx={{ width: '100%' }} error={!!error}>
                    <InputLabel id={`multiple-checkbox-label-${field.id}-code`}>Qualification *</InputLabel>
                    <Select
                      label="Qualification *"
                      labelId={`multiple-checkbox-label-${field.id}-code`}
                      id={`multiple-checkbox-${field.id}-code`}
                      value={value}
                      onChange={onChange}
                      sx={{ width: '100%' }}
                      MenuProps={SELECT_MENU_PROPS}
                    >
                      {PractitionerQualificationCodesDisplay.map((code) => (
                        <MenuItem key={code.value} value={code.value}>
                          {code.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {error && (
                      <FormHelperText sx={{ color: 'error', width: '100%' }}>
                        {'Please select an option.'}
                      </FormHelperText>
                    )}
                  </FormControl>
                )}
                name={`licenses.${index}.code`}
                control={control}
                rules={{
                  validate: (field) => {
                    const state = getValues(`licenses.${index}.state`);
                    if (Boolean(state) && !field) {
                      return 'Qualification is required';
                    }
                    return undefined;
                  },
                }}
              />
              {/* If it's not the last form field and it's not the new one */}
              {
                <Box mt={2}>
                  <IconButton
                    aria-label="delete"
                    size="small"
                    disabled={!removeButtonEnabled}
                    color={'error'}
                    onClick={() => handleRemove(index)}
                  >
                    <ClearIcon />
                  </IconButton>
                </Box>
              }
            </Box>
          ))}

          <Box mt={2}>
            <Button
              onClick={handleAddNewLicense}
              sx={{
                textTransform: 'none',
                fontWeight: 'bold',
                borderRadius: '100px',
              }}
              variant="outlined"
              color="primary"
            >
              Add license
            </Button>
          </Box>
        </Box>

        {/* Error on submit if request fails */}
        {errors.submit && (
          <Typography color="error" variant="body2" mt={1}>{`Failed to update user. Please try again.`}</Typography>
        )}

        {/* Update Employee and Cancel Buttons */}
        <Grid>
          <LoadingButton
            variant="contained"
            color="primary"
            sx={{
              textTransform: 'none',
              borderRadius: 28,
              marginTop: 3,
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
                marginTop: 3,
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
