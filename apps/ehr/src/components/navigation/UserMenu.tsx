import { otherColors } from '@ehrTheme/colors';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
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
import { CommandPaletteSearchButton } from 'src/components/CommandPaletteSearchButton';
import { UnsolicitedResultsIcon } from 'src/features/external-labs/components/unsolicited-results/UnsolicitedResultsIcon';
import { ProviderNotifications } from 'src/features/notifications/ProviderNotifications';
import {
  useCheckPractitionerEnrollment,
  useConnectPractitionerToERX,
  useEnrollPractitionerToERX,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { getPractitionerMissingFields } from 'src/shared/utils/practitioner.helper';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { safelyCaptureMessage } from 'utils/lib/frontend/sentry';
import { BRANDING_CONFIG } from 'utils/lib/ottehr-config/branding';
import { RoleType } from 'utils/lib/types/api/user.types';
import { dataTestIds } from '../../constants/data-test-ids';
import useEvolveUser from '../../hooks/useEvolveUser';
import { PendingErxEnrollmentDialog } from '../dialogs/PendingErxEnrollmentDialog';

export const UserMenu: FC = () => {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [pendingReviewOpen, setPendingReviewOpen] = useState<boolean>(false);
  const user = useEvolveUser();
  // eRX enrollment/notifications require an NPI (DoseSpot). The provider notifications bell is a
  // general, visit-linked inbox — not NPI-gated — so keep it on a role check.
  const userHasNPI = user?.hasNPI;
  const showProviderNotifications = user?.hasRole([RoleType.Provider, RoleType.Clinician]);

  const practitioner = user?.profileResource;

  const practitionerMissingFields = useMemo(() => {
    return practitioner ? getPractitionerMissingFields(practitioner) : [];
  }, [practitioner]);

  const {
    data: practitionerEnrollmentStatus,
    isFetched: isPractitionerEnrollmentChecked,
    refetch: refetchPractitionerEnrollmentStatus,
  } = useCheckPractitionerEnrollment({
    enabled: Boolean(practitioner),
  });

  const { mutateAsync: enrollPractitioner, isPending: isEnrollingPractitioner } = useEnrollPractitionerToERX({
    onError: () => {
      enqueueSnackbar('Enrolling practitioner to eRx failed', { variant: 'error' });
    },
  });

  const { isPending: isConnectingPractitionerForConfirmation, mutateAsync: connectPractitionerForConfirmation } =
    useConnectPractitionerToERX({});

  const handleConnectPractitioner = useCallback(async () => {
    try {
      await enrollPractitioner(practitioner!.id!);

      const { data } = await refetchPractitionerEnrollmentStatus();

      if (data?.registered && !data?.confirmed) {
        setPendingReviewOpen(true);

        safelyCaptureMessage('DoseSpot enrollment pending review', {
          level: 'warning',
          tags: {
            system: 'erx',
            providerEnrollment: 'pending-review',
          },
          extra: {
            source: 'user-menu',
            practitionerId: practitioner?.id,
            registered: data?.registered,
            confirmed: data?.confirmed,
            identityVerified: data?.identityVerified,
          },
        });

        return;
      }

      const ssoLink = await connectPractitionerForConfirmation();
      void Promise.resolve().then(() => window.open(ssoLink, '_blank'));
    } catch (error) {
      enqueueSnackbar('Something went wrong while trying to connect practitioner to eRx', { variant: 'error' });
      console.error('Error trying to connect practitioner to eRx: ', error);
    }
  }, [connectPractitionerForConfirmation, enrollPractitioner, practitioner, refetchPractitionerEnrollmentStatus]);

  const name =
    user?.profileResource &&
    (getFullestAvailableName(user.profileResource, true) ?? `${BRANDING_CONFIG.projectName} Team`);
  const suffix = user?.profileResource?.name?.[0]?.suffix?.[0];

  return (
    <>
      <CommandPaletteSearchButton sx={{ mr: 2 }} />
      <UnsolicitedResultsIcon />
      {showProviderNotifications && <ProviderNotifications />}
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
        {/* Identity block: whose account this is. Previously `${projectName} Admin`, which read
            correctly only on an instance whose users happen to be named after the project — every
            other deployment showed the project name above the signed-in user's own email. */}
        <MenuItem>
          <Box>
            <Typography variant="body1">{name ?? user?.name}</Typography>
            <Typography variant="caption">{user?.email}</Typography>
          </Box>
        </MenuItem>
        <Divider />
        {isPractitionerEnrollmentChecked && userHasNPI && !practitionerEnrollmentStatus?.identityVerified && (
          <>
            {practitionerMissingFields.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', maxWidth: 300, gap: 1, padding: '6px 16px' }}>
                <WarningIcon fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: 'warning.light' }} />
                <Typography variant="caption">
                  Please complete your profile to be able to enroll in eRX.
                  <br /> Missing fields: {practitionerMissingFields.join(', ')}
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
        <Link to="/profile" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => setAnchorElement(null)}>
          <MenuItem data-testid={dataTestIds.header.myProfileMenuItem}>
            <AccountCircleIcon fontSize="small" sx={{ mr: 1, color: otherColors.blackTransparent }} />
            <Typography variant="body1">My Profile</Typography>
          </MenuItem>
        </Link>
        <Divider sx={{ my: 1 }} />
        <Link to="/logout" style={{ textDecoration: 'none' }}>
          <MenuItem>
            <Typography variant="body1" color="primary" sx={{ fontWeight: 'bold' }}>
              Log out
            </Typography>
          </MenuItem>
        </Link>
      </Menu>
      <PendingErxEnrollmentDialog open={pendingReviewOpen} handleClose={() => setPendingReviewOpen(false)} />
    </>
  );
};
