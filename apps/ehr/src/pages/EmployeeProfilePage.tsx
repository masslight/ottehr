import { Box, CircularProgress, Grid, Paper, Skeleton, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PatternFormat } from 'react-number-format';
import { RoundedButton } from 'src/components/RoundedButton';
import {
  useGetAllLocations,
  useUpdateProviderNotificationPreferencesV2Mutation,
} from 'src/features/notifications/notifications.queries';
import NotificationSettingsTable from 'src/features/notifications/NotificationSettingsTable';
import {
  formatPhoneNumber,
  getAllNotificationRows,
  getProviderNotificationPreferencesV2,
  isPhoneNumberValid,
  ProviderNotificationMethod,
  ProviderNotificationPreferencesV2,
  standardizePhoneNumber,
} from 'utils';
import useEvolveUser from '../hooks/useEvolveUser';
import PageContainer from '../layout/PageContainer';

export default function EmployeeProfilePage(): JSX.Element {
  const user = useEvolveUser();

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
              {user?.name || <Skeleton width={250} />}
            </Typography>
            <Typography variant="body1" my={2}>
              {user?.email || <Skeleton width={250} />}
            </Typography>

            <Paper sx={{ padding: 3, marginTop: 3 }}>
              <Typography variant="h4" color="primary.dark" sx={{ fontWeight: 600, mb: 3 }}>
                Notification Settings
              </Typography>

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
          </Grid>
        </Grid>
      </>
    </PageContainer>
  );
}
