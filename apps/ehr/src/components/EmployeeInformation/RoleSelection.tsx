import { Box, Checkbox, FormControl, FormControlLabel, FormGroup, FormLabel, Typography } from '@mui/material';
import { AVAILABLE_EMPLOYEE_ROLES, RoleType } from 'utils';
import { dataTestIds } from '../../constants/data-test-ids';
import useEvolveUser from '../../hooks/useEvolveUser';
import { RoleSelectionProps } from './types';

export function RoleSelection({ errors, isActive, getValues, setValue }: RoleSelectionProps): JSX.Element {
  const currentUser = useEvolveUser();

  return (
    <FormControl sx={{ width: '100%' }} error={errors.roles} data-testid={dataTestIds.employeesPage.rolesSection}>
      <FormLabel sx={{ mb: 1, mt: 2, fontWeight: '600 !important' }}>Role</FormLabel>
      <FormLabel sx={{ fontWeight: 500, fontSize: '12px' }}>Select role *</FormLabel>
      <FormGroup>
        {AVAILABLE_EMPLOYEE_ROLES.map((roleEntry, index) => {
          const roles = getValues('roles') ?? [];
          const isChecked = roles.includes(roleEntry.value);
          return (
            <Box key={index}>
              <FormControlLabel
                value={roleEntry.value}
                name="roles"
                data-testid={dataTestIds.employeesPage.roleRow(roleEntry.value)}
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
