import { Box, Checkbox, FormControl, FormControlLabel, FormGroup, FormLabel, Typography } from '@mui/material';
import { RoleType } from 'utils';
import useEvolveUser from '../../hooks/useEvolveUser';
import { RoleSelectionProps } from './types';

export function RoleSelection({ errors, isActive, getValues, setValue }: RoleSelectionProps): JSX.Element {
  const currentUser = useEvolveUser();
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
      hint: `A clinician, such as a doctor, a PA or an NP`,
    },
    // {
    //   value: RoleType.Prescriber,
    //   label: 'Prescriber',
    //   hint: `A clinician that is allowed to prescribe`,
    // },
  ];

  return (
    <FormControl sx={{ width: '100%' }} error={errors.roles}>
      <FormLabel sx={{ mb: 1, mt: 2, fontWeight: '600 !important' }}>Role</FormLabel>
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
                    : currentRoles.filter((role: RoleType) => role !== roleEntry.value);
                  setValue('roles', newRoles);
                }}
                control={<Checkbox />}
                disabled={!isActive || !currentUser?.hasRole([RoleType.Administrator])}
                label={roleEntry.label}
                sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
              />
              <Box ml={4} sx={{ marginTop: '-10px', marginBottom: '5px' }}>
                <Typography sx={{ color: 'text.secondary' }} variant="body2">
                  {roleEntry.hint}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </FormGroup>
    </FormControl>
  );
}
