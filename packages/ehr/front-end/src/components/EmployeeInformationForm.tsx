import {
  Box,
  Button,
  // Chip,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Skeleton,
  Typography,
  useTheme,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
// import LocationMultiSelect from './LocationMultiSelect';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
// import { Location } from 'fhir/r4';
import { useEffect } from 'react';
import { updateUser } from '../api/api';
import { useZambdaClient } from '../hooks/useZambdaClient';
import { RoleType } from '../types/types';
import { User } from '@zapehr/sdk';
import { otherColors } from '../CustomThemeProvider';

interface EditEmployeeInformationProps {
  submitLabel: string;
  existingUser?: User;
  isActive?: boolean;
}

export default function EmployeeInformationForm({
  submitLabel,
  existingUser,
  isActive,
}: EditEmployeeInformationProps): JSX.Element {
  const navigate = useNavigate();
  const zambdaClient = useZambdaClient();
  const theme = useTheme();
  const [loading, setLoading] = useState<boolean>(false);
  const [role, setRole] = useState<RoleType>();
  const [errors, setErrors] = useState({ submit: false });
  // const [locations, setLocations] = useState<Location[]>([]);
  // const [selectedLocations, setSelectedLocations] = useState<
  //   { label: string | undefined; id: string | undefined; location: Location }[]
  // >([]);

  // Form should have its own user state so it doesn't override page title when title is user name
  const [user, setUser] = useState<User>({
    name: '',
    email: '',
    id: '',
    profile: '',
    accessPolicy: {},
  });

  useEffect(() => {
    // Set user and default radio button role
    if (existingUser) {
      setUser(existingUser);
      setRole((existingUser as any).roles[0]?.name || '');
    }
  }, [existingUser]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setLoading(true);

    if (!zambdaClient) {
      throw new Error('Zambda Client not found');
    }

    // Update the user
    let apiErr = false;
    try {
      await updateUser(zambdaClient, {
        userId: user.id,
        selectedRole: role,
        // locations: selectedLocations.map((locationObj) => locationObj.location),
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
      <form onSubmit={(e) => handleSubmit(e)}>
        {/* Employee Information */}
        {/* Location */}
        {/* <Typography variant="h4" color="primary">
        Location
      </Typography>
      <Typography variant="body1" marginTop={1} color="primary.dark">
        This user will have access to the selected location information and settings, including appointments, patients,
        working hours, etc.
      </Typography>
      <Box sx={{ marginTop: 3, width: '100%' }}>
        <LocationMultiSelect
          locations={locations}
          setLocations={setLocations}
          setSelectedLocations={setSelectedLocations}
          selectedLocations={selectedLocations}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, marginTop: 2 }}>
        {selectedLocations.map((location) => (
          <Chip
            key={location.id}
            size="small"
            label={location.label}
            onDelete={() => {
              setSelectedLocations((prevLocations) => prevLocations.filter((loc) => loc.id !== location.id));
            }}
            sx={{
              color: '#301367',
              background: '#4AC0F21F',
              borderRadius: '16px',
              fontSize: 12,
              margin: '2px',
              '& .MuiChip-deleteIcon': {
                color: '#301367',
              },
            }}
          />
        ))}
      </Box> */}
        {/* Roles Section */}
        <FormControl>
          <FormLabel
            sx={{ ...theme.typography.h4, color: theme.palette.primary.dark, mb: 1, fontWeight: '600 !important' }}
          >
            Role
          </FormLabel>
          <FormLabel required sx={{ fontWeight: 700, fontSize: '12px' }}>
            Select role
          </FormLabel>
          <RadioGroup
            name="roles-radio"
            value={role || ''}
            onChange={(e) => {
              setRole(e.target.value as RoleType);
            }}
          >
            <FormControlLabel
              value={RoleType.FrontDesk}
              control={<Radio />}
              disabled={!isActive}
              label="Administrator"
              required
              sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
            />
            <Box ml={4}>
              <Typography sx={{ color: otherColors.noteText }} variant="body2">
                Adjust/edit frequency/slots; all copy/message edits; invite users or inactivate users
              </Typography>
            </Box>

            <FormControlLabel
              value={RoleType.Manager}
              disabled={!isActive}
              control={<Radio />}
              label="Manager"
              required
              sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
            />
            <Box ml={4}>
              <Typography sx={{ color: otherColors.noteText }} variant="body2">
                Grant existing users site/queue access; adjust operating hours or special hours/schedule overrides;
                adjust # of providers (eventually provider level/type)
              </Typography>
            </Box>
            <FormControlLabel
              value={RoleType.Staff}
              disabled={!isActive}
              control={<Radio />}
              label="Staff"
              required
              sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
            />
            <Box ml={4}>
              <Typography sx={{ color: otherColors.noteText }} variant="body2">
                No settings changes; essentially read-only
              </Typography>
            </Box>
            <FormControlLabel
              value={RoleType.Provider}
              disabled={!isActive}
              control={<Radio />}
              label="Provider"
              required
              sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}
            />
            <Box ml={4}>
              <Typography sx={{ color: otherColors.noteText }} variant="body2">
                No settings changes; essentially read-only
              </Typography>
            </Box>
          </RadioGroup>
        </FormControl>

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
