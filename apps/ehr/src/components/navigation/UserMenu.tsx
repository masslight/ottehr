import WarningIcon from '@mui/icons-material/Warning';
import {
  Avatar,
  Box,
  Divider,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, MouseEvent, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPractitionerMissingFields } from 'src/shared/utils';
import { useCheckPractitionerEnrollment, useConnectPractitionerToERX, useEnrollPractitionerToERX } from 'src/telemed';
import { getFullestAvailableName, PROJECT_NAME, RoleType } from 'utils';
import { dataTestIds } from '../../constants/data-test-ids';
import { ProviderNotifications } from '../../features';
import useEvolveUser from '../../hooks/useEvolveUser';

export const UserMenu: FC = () => {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const user = useEvolveUser();
  const userIsProvider = user?.hasRole([RoleType.Provider]);

  const practitioner = user?.profileResource;

  const practitionerMissingFields = useMemo(() => {
    return practitioner ? getPractitionerMissingFields(practitioner) : [];
  }, [practitioner]);

  const { data: practitionerEnrollmentStatus, isFetched: isPractitionerEnrollmentChecked } =
    useCheckPractitionerEnrollment({
      enabled: Boolean(practitioner),
    });

  const { mutateAsync: enrollPractitioner, isLoading: isEnrollingPractitioner } = useEnrollPractitionerToERX({
    onError: () => {
      enqueueSnackbar('Enrolling practitioner to eRx failed', { variant: 'error' });
    },
  });

  const { isLoading: isConnectingPractitionerForConfirmation, mutateAsync: connectPractitionerForConfirmation } =
    useConnectPractitionerToERX({});

  const handleConnectPractitioner = useCallback(async () => {
    try {
      await enrollPractitioner(practitioner!.id!);
      const ssoLink = await connectPractitionerForConfirmation();
      void Promise.resolve().then(() => window.open(ssoLink, '_blank'));
    } catch (error) {
      enqueueSnackbar('Something went wrong while trying to connect practitioner to eRx', { variant: 'error' });
      console.error('Error trying to connect practitioner to eRx: ', error);
    }
  }, [connectPractitionerForConfirmation, enrollPractitioner, practitioner]);

  const name = user?.profileResource && (getFullestAvailableName(user.profileResource, true) ?? `${PROJECT_NAME} Team`);
  const suffix = user?.profileResource?.name?.[0]?.suffix?.[0];

  return (
    <>
      {userIsProvider && <ProviderNotifications />}
      <ListItem disablePadding sx={{ width: 'fit-content' }}>
        <ListItemButton onClick={(event: MouseEvent<HTMLElement>) => setAnchorElement(event.currentTarget)}>
          <ListItemAvatar sx={{ minWidth: 'auto', mr: { xs: '0', sm: 2 } }}>
            <Avatar sx={{ bgcolor: 'primary.main' }} alt={name} src={user?.profileResource?.photo?.[0]?.url} />
          </ListItemAvatar>
          <ListItemText
            data-testid={dataTestIds.header.userName}
            sx={{ display: { xs: 'none', sm: 'block' } }}
            primary={name}
            secondary={suffix}
          />
        </ListItemButton>
      </ListItem>
      <Menu
        id="user-menu"
        anchorEl={anchorElement}
        open={anchorElement !== null}
        onClose={() => setAnchorElement(null)}
      >
        <MenuItem>
          <Box>
            <Typography variant="body1">{PROJECT_NAME} Admin</Typography>
            <Typography variant="caption">{user?.email}</Typography>
          </Box>
        </MenuItem>
        <Divider />
        {isPractitionerEnrollmentChecked && userIsProvider && !practitionerEnrollmentStatus?.identityVerified && (
          <>
            {practitionerMissingFields.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: 300, gap: 1, padding: '6px 16px' }}>
                <WarningIcon fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: 'warning.light' }} />
                <Typography variant="caption">
                  Please complete your profile to be able to enroll in eRX or ask your administrator to complete it for
                  you. <br /> Missing fields: {practitionerMissingFields.join(', ')}
                </Typography>
              </Box>
            )}

            <MenuItem
              disabled={
                practitionerMissingFields.length > 0 ||
                isConnectingPractitionerForConfirmation ||
                isEnrollingPractitioner
              }
              onClick={handleConnectPractitioner}
            >
              <Typography variant="body1" color="primary" sx={{ fontWeight: 'bold' }}>
                Enroll in eRX
              </Typography>
            </MenuItem>

            <Divider />
          </>
        )}
        <Link to="/logout" style={{ textDecoration: 'none' }}>
          <MenuItem>
            <Typography variant="body1" color="primary" sx={{ fontWeight: 'bold' }}>
              Log out
            </Typography>
          </MenuItem>
        </Link>
      </Menu>
    </>
  );
};
