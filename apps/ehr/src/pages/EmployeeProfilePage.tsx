import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, CircularProgress, Grid, Paper, Tab, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PatternFormat } from 'react-number-format';
import { useSearchParams } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import { useGetEmployeeDetails } from 'src/features/admin/employees.queries';
import {
  useGetAllLocations,
  useUpdateProviderNotificationPreferencesV2Mutation,
} from 'src/features/notifications/notifications.queries';
import NotificationSettingsTable from 'src/features/notifications/NotificationSettingsTable';
import { allLicensesForPractitioner } from 'utils/lib/fhir/helpers';
import { getProviderNotificationPreferencesV2 } from 'utils/lib/fhir/patient';
import { formatPhoneNumber, isPhoneNumberValid, standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { PractitionerLicense, ProviderNotificationMethod } from 'utils/lib/types/api/practitioner.types';
import { getAllNotificationRows, ProviderNotificationPreferencesV2 } from 'utils/lib/types/api/provider-notifications';
import EmployeeInformationForm from '../components/EmployeeInformation';
import { dataTestIds } from '../constants/data-test-ids';
import { checkUserIsActive } from '../helpers/checkUserIsActive';
import useEvolveUser from '../hooks/useEvolveUser';
import PageContainer from '../layout/PageContainer';

export const MY_PROFILE_TABS = {
  profile: 'profile',
  notifications: 'notifications',
} as const;
export type MyProfileTab = (typeof MY_PROFILE_TABS)[keyof typeof MY_PROFILE_TABS];

export default function EmployeeProfilePage(): JSX.Element {
  const user = useEvolveUser();
  const [searchParams, setSearchParams] = useSearchParams();

  // In the URL so a tab survives a refresh and can be linked to — the command palette points
  // straight at the notification settings.
  const activeTab: MyProfileTab =
    searchParams.get('tab') === MY_PROFILE_TABS.notifications ? MY_PROFILE_TABS.notifications : MY_PROFILE_TABS.profile;
  const setActiveTab = useCallback(
    (tab: MyProfileTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === MY_PROFILE_TABS.profile) next.delete('tab');
          else next.set('tab', tab);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // The employee record behind the Profile tab. `useEvolveUser` carries the Practitioner but not the
  // Oystehr roles or licenses the form needs, so the record comes from the same query the admin
  // employee page uses — one definition of "this employee's record", not two.
  const { data: employeeDetails, refetch } = useGetEmployeeDetails(user?.id);

  const userLicenses: PractitionerLicense[] = useMemo(() => {
    const practitioner = employeeDetails?.user?.profileResource;
    return practitioner?.qualification ? allLicensesForPractitioner(practitioner) : [];
  }, [employeeDetails?.user?.profileResource]);

  const refetchEmployeeDetails = useCallback(async (): Promise<void> => {
    await refetch();
  }, [refetch]);

  const initialPreferences = useMemo(
    () => getProviderNotificationPreferencesV2(user?.profileResource),
    [user?.profileResource]
  );
  const { data: locations = [], isLoading: locationsLoading } = useGetAllLocations();

  const [preferences, setPreferences] = useState<ProviderNotificationPreferencesV2 | undefined>(undefined);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [dirty, setDirty] = useState<boolean>(false);

  const updatePreferencesMutation = useUpdateProviderNotificationPreferencesV2Mutation(() => {
    setDirty(false);
    enqueueSnackbar('Notification settings saved', { variant: 'success' });
  });

  const resetToInitial = useCallback(() => {
    if (!initialPreferences) return;
    setPreferences(initialPreferences);
    const sms = user?.profileResource?.telecom?.find((t) => t.system === 'sms')?.value;
    // Tolerates any stored shape (+1…, formatted, bare); PatternFormat wants the bare 10 digits.
    setPhoneNumber(standardizePhoneNumber(sms)?.replace(/\D/g, '') ?? '');
    setDirty(false);
  }, [initialPreferences, user?.profileResource]);

  // Latest-dirty ref so the sync effect below can consult it without re-running on every dirty flip.
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (!initialPreferences) return;
    // The post-save profile refetch changes identity; don't clobber edits made while it was in flight.
    if (dirtyRef.current) return;
    resetToInitial();
    setIsInitialized(true);
  }, [initialPreferences, resetToInitial]);

  async function handleSave(): Promise<void> {
    if (!preferences) return;
    // Demand a phone number only when an enabled row actually uses a phone-based method.
    const phoneRequired = getAllNotificationRows(preferences).some(
      (row) =>
        row.enabled &&
        (row.method === ProviderNotificationMethod['phone'] ||
          row.method === ProviderNotificationMethod['phone and computer'])
    );
    const isValidPhoneNumber = isPhoneNumberValid(phoneNumber);
    if (phoneRequired && (!phoneNumber || !isValidPhoneNumber)) {
      enqueueSnackbar('Please enter a valid phone number to receive notifications via phone', { variant: 'error' });
      return;
    }
    try {
      await updatePreferencesMutation.mutateAsync({
        preferences,
        phoneNumber: isValidPhoneNumber ? formatPhoneNumber(phoneNumber) : undefined,
      });
    } catch (error) {
      console.error('Error updating notification settings: ', error);
      enqueueSnackbar('Failed to save notification settings', { variant: 'error' });
    }
  }

  return (
    <PageContainer tabTitle="My Profile">
      <>
        <Grid container direction="row" justifyContent="center">
          <Grid item maxWidth="1100px" width="100%">
            <Typography variant="h3" color="primary.dark" marginTop={2} sx={{ fontWeight: 600 }}>
              My Profile
            </Typography>

            {/* Two unrelated things about the signed-in user — who they are, and how they want to be
                contacted — written by different endpoints, so each tab keeps its own save. */}
            <TabContext value={activeTab}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
                <TabList onChange={(_, value: MyProfileTab) => setActiveTab(value)} aria-label="My profile sections">
                  <Tab
                    value={MY_PROFILE_TABS.profile}
                    label="Profile"
                    data-testid={dataTestIds.myProfilePage.profileTab}
                    sx={{ textTransform: 'none', fontWeight: 500 }}
                  />
                  <Tab
                    value={MY_PROFILE_TABS.notifications}
                    label="Notification Settings"
                    data-testid={dataTestIds.myProfilePage.notificationsTab}
                    sx={{ textTransform: 'none', fontWeight: 500 }}
                  />
                </TabList>
              </Box>

              <TabPanel value={MY_PROFILE_TABS.profile} sx={{ p: 0, pt: 3 }}>
                {employeeDetails?.user ? (
                  <EmployeeInformationForm
                    submitLabel="Save changes"
                    existingUser={employeeDetails.user}
                    isActive={checkUserIsActive(employeeDetails.user)}
                    licenses={userLicenses}
                    seenPatientRecently={employeeDetails.seenPatientRecently}
                    getUserAndUpdatePage={refetchEmployeeDetails}
                  />
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                )}
              </TabPanel>

              <TabPanel value={MY_PROFILE_TABS.notifications} sx={{ p: 0, pt: 3 }}>
                <Paper sx={{ padding: 3 }}>
                  {preferences && isInitialized && !locationsLoading ? (
                    <>
                      <Grid item xs={12} sm={6} md={4} sx={{ mb: 3 }}>
                        <PatternFormat
                          customInput={TextField}
                          value={phoneNumber}
                          format="(###) ###-####"
                          label="Phone"
                          required
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                          onValueChange={(values, sourceInfo) => {
                            setPhoneNumber(values.value);
                            // onValueChange also fires for prop-driven changes (e.g. Cancel restoring the
                            // number) — only actual user input may mark the form dirty.
                            if (sourceInfo.source === 'event') setDirty(true);
                          }}
                          placeholder="(XXX) XXX-XXXX"
                          disabled={updatePreferencesMutation.isPending}
                        />
                      </Grid>

                      <NotificationSettingsTable
                        preferences={preferences}
                        locations={locations}
                        disabled={updatePreferencesMutation.isPending}
                        onChange={(next) => {
                          setPreferences(next);
                          setDirty(true);
                        }}
                      />

                      <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 2, mt: 3 }}>
                        <RoundedButton
                          variant="contained"
                          onClick={handleSave}
                          disabled={!dirty || updatePreferencesMutation.isPending}
                          loading={updatePreferencesMutation.isPending}
                        >
                          Save changes
                        </RoundedButton>
                        <RoundedButton
                          variant="text"
                          onClick={resetToInitial}
                          disabled={!dirty || updatePreferencesMutation.isPending}
                        >
                          Cancel
                        </RoundedButton>
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  )}
                </Paper>
              </TabPanel>
            </TabContext>
          </Grid>
        </Grid>
      </>
    </PageContainer>
  );
}
