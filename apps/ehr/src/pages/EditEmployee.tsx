import { otherColors } from '@ehrTheme/colors';
import { LoadingButton } from '@mui/lab';
import { Box, Chip, Grid, Paper, Skeleton, Typography } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGetEmployeeDetails } from 'src/features/admin/employees.queries';
import { allLicensesForPractitioner } from 'utils/lib/fhir/helpers';
import { getProviderNotificationPreferencesV2 } from 'utils/lib/fhir/patient';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import { PractitionerLicense } from 'utils/lib/types/api/practitioner.types';
import { getAllNotificationRows } from 'utils/lib/types/api/provider-notifications';
import { hasPractitionerProfile } from 'utils/lib/types/api/user.types';
import { UserActivationMode } from 'utils/lib/types/api/user-activation.types';
import { deleteUser, userActivation } from '../api/api';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import CustomBreadcrumbs from '../components/CustomBreadcrumbs';
import EmployeeInformationForm from '../components/EmployeeInformation';
import PractitionerRoleList from '../components/schedule/PractitionerRoleList';
import { dataTestIds } from '../constants/data-test-ids';
import { checkUserIsActive } from '../helpers/checkUserIsActive';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

/**
 * The admin view of one employee's record. A user editing their own record does it on My Profile,
 * which reuses {@link EmployeeInformationForm} directly — this page adds the surfaces only an admin
 * gets: breadcrumbs, schedule assignment, and activation or deletion.
 */
export default function EditEmployeePage(): JSX.Element {
  const { oystehrZambda } = useApiClients();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // get the user id from the url
  const { id } = useParams();
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState({ submit: '' });

  // React Query owns the fetched record; everything the page shows is derived from it, so there is
  // nothing that can drift out of sync with what the server returned.
  const { data: userDetails, refetch } = useGetEmployeeDetails(id);

  const user = userDetails?.user;
  const isActive = user ? checkUserIsActive(user) : undefined;
  const seenPatientRecently = userDetails?.seenPatientRecently ?? false;
  // The same condition the list reports as "needs review".
  const needsSetup = user ? !hasPractitionerProfile(user.profile) : false;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!oystehrZambda) throw new Error('Zambda Client not found');
      if (!id) throw new Error('User ID is undefined');
      return deleteUser(oystehrZambda, { userId: id });
    },
    onSuccess: async () => {
      enqueueSnackbar('User deleted.', { variant: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['get-employees'] });
      navigate('/admin/employees');
    },
  });

  const handleDeleteUser = async (): Promise<void> => {
    setErrors({ submit: '' });
    try {
      await deleteMutation.mutateAsync();
    } catch (error) {
      const message = getApiError({ error, defaultError: 'Failed to delete user.' });
      setErrors({ submit: message });
      enqueueSnackbar(message, { variant: 'error' });
    }
  };

  // The same derivation `get-employees` performs for its own alerts flag, done here off the
  // Practitioner we already hold rather than by adding another field to the response.
  const gettingAlerts = useMemo(() => {
    const preferences = getProviderNotificationPreferencesV2(user?.profileResource);
    return preferences ? getAllNotificationRows(preferences).some((row) => row.enabled) : false;
  }, [user?.profileResource]);

  // When linked here from the Schedules list with `#schedule`, jump past the
  // employee form to the scheduling card. The card only mounts after the user
  // loads, so we use a callback ref to scroll exactly once when the element
  // first appears (with a one-frame defer so layout has settled).
  const scheduleAnchorRef = useCallback(
    (node: HTMLElement | null) => {
      if (!node || location.hash !== '#schedule') return;
      window.requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    },
    [location.hash]
  );

  const userLicenses: PractitionerLicense[] = useMemo(() => {
    if (user?.profileResource?.qualification) {
      return allLicensesForPractitioner(user.profileResource);
    }
    return [];
  }, [user]);

  const getUserAndUpdatePage = useCallback(async (): Promise<void> => {
    await refetch();
  }, [refetch]);

  const handleUserActivation = async (userActivationMode: UserActivationMode): Promise<void> => {
    setLoading(true);
    if (!oystehrZambda) {
      throw new Error('Zambda Client not found');
    }
    setErrors({ submit: '' });

    if (!user?.id) {
      throw new Error('User ID is undefined');
    }

    try {
      const { erxUnenrollment } = await userActivation(oystehrZambda, { userId: user.id, userActivationMode });
      await getUserAndUpdatePage();
      if (erxUnenrollment === 'failed') {
        // Access has already been revoked by the time the zambda reports this — only the eRx side
        // failed — so it's a warning rather than an error. But it has to be said out loud: the copy
        // above promises the prescriber enrollment is removed, and a plain success toast would leave
        // the operator believing a departed clinician can no longer prescribe when they still can.
        // Persisted (and keyed) because it needs follow-up, unlike the transient success toast.
        enqueueSnackbar(
          `User was ${userActivationMode}d, but their eRx prescriber enrollment could not be removed. ` +
            `The failure has been reported — please contact support to have the enrollment removed.`,
          { variant: 'warning', persist: true, preventDuplicate: true, key: 'erx-unenroll-failed' }
        );
      } else {
        enqueueSnackbar(`User was ${userActivationMode}d successfully`, {
          variant: 'success',
        });
      }
    } catch {
      const errorString = `Failed to ${userActivationMode} user. Please try again`;
      setErrors((prev) => ({ ...prev, submit: `${errorString}` }));
      enqueueSnackbar(`${errorString}`, {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer tabTitle={'Edit Employee'}>
      <>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth={'1100px'} width={'100%'}>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs
              chain={[
                { link: '/admin', children: 'Admin' },
                { link: '/admin/employees', children: 'Employees' },
                { link: '#', children: user?.name || <Skeleton width={150} /> },
              ]}
            />

            {/* Page Title */}
            <Typography
              variant="h3"
              color="primary.dark"
              marginTop={2}
              sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2, fontWeight: '600 !important' }}
            >
              {user?.name || <Skeleton width={250} />}
              {isActive !== undefined && !isActive && <Chip label="Deactivated" color="error" size="small" />}
              {needsSetup && (
                <Chip
                  label="NEEDS REVIEW"
                  size="small"
                  data-testid={dataTestIds.employeesPage.needsReviewChip}
                  sx={{ backgroundColor: otherColors.orange100, color: otherColors.orange800, borderRadius: '4px' }}
                />
              )}
              {gettingAlerts && (
                <Chip
                  label="GETS ALERTS"
                  size="small"
                  data-testid={dataTestIds.employeesPage.gettingAlertsChip}
                  sx={{ bgcolor: 'info.light', color: 'info.dark', borderRadius: '4px' }}
                />
              )}
            </Typography>
            <Typography variant="body1" my={2}>
              {user?.email || <Skeleton width={250} />}
            </Typography>

            {/* Page Content */}
            <Box>
              {user && (
                <EmployeeInformationForm
                  submitLabel="Save changes"
                  existingUser={user}
                  isActive={isActive}
                  licenses={userLicenses}
                  seenPatientRecently={seenPatientRecently}
                  getUserAndUpdatePage={getUserAndUpdatePage}
                />
              )}

              {isActive && user?.profileResource?.id && (
                <Box id="schedule" ref={scheduleAnchorRef}>
                  <PractitionerRoleList practitionerId={user.profileResource.id} />
                </Box>
              )}

              {/* A user who never completed setup has no clinician record and no role, so there is
                  nothing to deactivate — the only meaningful action is removing the account. Filling
                  in their details and saving is the other way out: `update-user` creates the
                  Practitioner and repoints the profile, after which this becomes a normal record. */}
              {isActive === undefined ? (
                <Skeleton height={300} sx={{ marginTop: -8 }} />
              ) : needsSetup ? (
                <Paper sx={{ padding: 3, marginTop: 3 }}>
                  <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                    Delete user
                  </Typography>
                  <Typography variant="body1" marginTop={1}>
                    This user signed up but has never been set up as an employee, so they hold no role and have no
                    clinician record. Assign them a role above to finish setting them up, or delete the account to
                    permanently block their access.
                  </Typography>

                  {errors.submit && (
                    <Typography color="error" variant="body2" mt={1}>
                      {errors.submit}
                    </Typography>
                  )}

                  <ConfirmationDialog
                    title="Delete user?"
                    description={`This will permanently delete ${
                      user?.email || user?.name
                    } and block EHR access. This cannot be undone.`}
                    response={handleDeleteUser}
                    actionButtons={{
                      proceed: { text: 'Delete', color: 'error', loading: deleteMutation.isPending },
                    }}
                  >
                    {(showDialog) => (
                      <LoadingButton
                        variant="contained"
                        color="error"
                        data-testid={dataTestIds.employeesPage.deleteUserButton}
                        sx={{
                          textTransform: 'none',
                          borderRadius: 28,
                          marginTop: 4,
                          fontWeight: 'bold',
                          marginRight: 1,
                        }}
                        loading={deleteMutation.isPending}
                        onClick={showDialog}
                      >
                        Delete
                      </LoadingButton>
                    )}
                  </ConfirmationDialog>
                </Paper>
              ) : (
                <Paper sx={{ padding: 3, marginTop: 3 }}>
                  <Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                    {isActive ? 'Deactivate profile' : 'Activate profile'}
                  </Typography>
                  <Typography variant="body1" marginTop={1}>
                    {isActive
                      ? 'When you deactivate this account, this employee will not have access to the system anymore. If they are enrolled in eRx, their prescriber enrollment is removed as well.'
                      : 'Activate this user account. This will immediately give the user the Staff role.'}
                  </Typography>

                  {/* Error on submit if request fails */}
                  {errors.submit && (
                    <Typography color="error" variant="body2" mt={1}>
                      {errors.submit}
                    </Typography>
                  )}

                  <LoadingButton
                    variant="contained"
                    color={isActive ? 'error' : 'primary'}
                    data-testid={dataTestIds.employeesPage.deactivateUserButton}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 28,
                      marginTop: 4,
                      fontWeight: 'bold',
                      marginRight: 1,
                    }}
                    loading={loading}
                    onClick={
                      isActive ? () => handleUserActivation('deactivate') : () => handleUserActivation('activate')
                    }
                  >
                    {isActive ? 'Deactivate' : 'Activate'}
                  </LoadingButton>
                </Paper>
              )}
            </Box>
          </Grid>
        </Grid>
      </>
    </PageContainer>
  );
}
