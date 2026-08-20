import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  FormLabel,
  Typography,
  useTheme,
} from '@mui/material';
import { AVAILABLE_EMPLOYEE_ROLES, RoleType } from 'utils/lib/types/api/user.types';
import { dataTestIds } from '../../constants/data-test-ids';
import useEvolveUser from '../../hooks/useEvolveUser';
import { RoleSelectionProps } from './types';

export function RoleSelection({ errors, isActive, isOwnRecord, getValues, setValue }: RoleSelectionProps): JSX.Element {
  const theme = useTheme();
  const currentUser = useEvolveUser();
  const canEditRoles = currentUser?.hasRole([RoleType.Administrator, RoleType.CustomerSupport]) ?? false;

  return (
    <FormControl
      sx={{ width: '100%' }}
      error={errors.roles}
      data-testid={dataTestIds.employeesPage.rolesSection}
      required
    >
      <Typography sx={{ ...theme.typography.h4, color: theme.palette.primary.dark, mb: 2 }}>Role</Typography>
      <FormLabel component="legend" sx={{ fontWeight: 500, fontSize: '12px' }}>
        Select role
      </FormLabel>
      {/* Roles are shown to everyone but only an admin may change them, which is otherwise just a
          row of dead checkboxes. Deliberately not shown when the checkboxes are disabled for the
          other reason — a deactivated record — since the activation card already explains that. */}
      {!canEditRoles && isActive && (
        <FormHelperText data-testid={dataTestIds.employeesPage.roleEditPermissionHint} sx={{ ml: 0, mt: 0.5, mb: 1 }}>
          {isOwnRecord ? 'Only an administrator can update your role.' : 'Only an administrator can update roles.'}
        </FormHelperText>
      )}
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
                disabled={!isActive || !canEditRoles}
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
