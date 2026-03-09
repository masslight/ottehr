import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { useEffect, useMemo, useState } from 'react';
import { PatternFormat } from 'react-number-format';
import { useUpdateProviderNotificationSettingsMutation } from 'src/features/notifications/notifications.queries';
import { useProviderNotificationsStore } from 'src/features/notifications/notifications.store';
import { getProviderNotificationSettingsForPractitioner, isPhoneNumberValid, ProviderNotificationMethod } from 'utils';
import useEvolveUser from '../hooks/useEvolveUser';
import PageContainer from '../layout/PageContainer';

export default function EmployeeProfilePage(): JSX.Element {
  const user = useEvolveUser();

  const notificationSettings = useMemo(
    () => getProviderNotificationSettingsForPractitioner(user?.profileResource),
    [user?.profileResource]
  );
  const [taskNotificationsEnabled, setTaskNotificationsEnabled] = useState<boolean>(false);
  const [telemedNotificationsEnabled, setTelemedNotificationsEnabled] = useState<boolean>(false);
  const [notificationMethod, setNotificationMethod] = useState<ProviderNotificationMethod>(
    ProviderNotificationMethod['phone and computer']
  );
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [phoneDirty, setPhoneDirty] = useState<boolean>(false);
  const [notificationDirty, setNotificationDirty] = useState<boolean>(false);

  const updateNotificationSettingsMutation = useUpdateProviderNotificationSettingsMutation((params) => {
    useProviderNotificationsStore.setState({
      notificationMethod: params.method,
      taskNotificationsEnabled: params.taskNotificationsEnabled,
      telemedNotificationsEnabled: params.telemedNotificationsEnabled,
    });
    setNotificationDirty(false);
    enqueueSnackbar('Notification settings saved', { variant: 'success' });
  });

  useEffect(() => {
    if (!notificationSettings) return;
    setTaskNotificationsEnabled(notificationSettings.taskNotificationsEnabled);
    setTelemedNotificationsEnabled(notificationSettings.telemedNotificationsEnabled);
    setNotificationMethod(notificationSettings.method ?? ProviderNotificationMethod['phone and computer']);
  }, [notificationSettings]);

  useEffect(() => {
    const smsPhone = user?.profileResource?.telecom?.find((t) => t.system === 'sms')?.value ?? '';
    setPhoneNumber(smsPhone);
  }, [user?.profileResource?.telecom]);

  async function handleApplyNotifications(): Promise<void> {
    if (!notificationSettings) return;
    const isValidPhoneNumber = isPhoneNumberValid(phoneNumber);
    if (
      [ProviderNotificationMethod['phone'], ProviderNotificationMethod['phone and computer']].includes(
        notificationSettings.method
      ) &&
      (!phoneNumber || !isValidPhoneNumber)
    ) {
      enqueueSnackbar('Please enter a valid phone number to receive notifications via phone', { variant: 'error' });
      return;
    }
    const params = {
      taskNotificationsEnabled,
      telemedNotificationsEnabled,
      method: notificationMethod,
      phoneNumber: isValidPhoneNumber ? phoneNumber : undefined,
    };
    try {
      await updateNotificationSettingsMutation.mutateAsync(params);
    } catch (error) {
      console.error('Error updating notification settings: ', error);
      enqueueSnackbar('Failed to save notification settings', { variant: 'error' });
    }
  }

  return (
    <PageContainer tabTitle="My Profile">
      <>
        <Grid container direction="row" alignItems="center" justifyContent="center">
          <Grid item maxWidth="584px" width="100%">
            <Typography variant="h3" color="primary.dark" marginTop={2} sx={{ fontWeight: 600 }}>
              {user?.name || <Skeleton width={250} />}
            </Typography>
            <Typography variant="body1" my={2}>
              {user?.email || <Skeleton width={250} />}
            </Typography>

            <Box>
              <Paper sx={{ padding: 3, marginTop: 3 }}>
                <Typography variant="h4" color="primary.dark" sx={{ fontWeight: 600, mb: 3 }}>
                  Notification Settings
                </Typography>
                <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
                  <Grid item xs={12}>
                    <FormControl>
                      <FormGroup>
                        <FormControlLabel
                          control={
                            <Switch
                              value={taskNotificationsEnabled}
                              disabled={updateNotificationSettingsMutation.isPending}
                              checked={taskNotificationsEnabled}
                              onChange={(e) => {
                                setTaskNotificationsEnabled(e.target.checked);
                                setNotificationDirty(true);
                              }}
                            />
                          }
                          label="Task notifications"
                          componentsProps={{ typography: { fontWeight: 500, variant: 'body1', ml: 1 } }}
                          labelPlacement="end"
                        />
                      </FormGroup>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl>
                      <FormGroup>
                        <FormControlLabel
                          control={
                            <Switch
                              value={telemedNotificationsEnabled}
                              disabled={updateNotificationSettingsMutation.isPending}
                              checked={telemedNotificationsEnabled}
                              onChange={(e) => {
                                setTelemedNotificationsEnabled(e.target.checked);
                                setNotificationDirty(true);
                              }}
                            />
                          }
                          label="Telemed notifications"
                          componentsProps={{ typography: { fontWeight: 500, variant: 'body1', ml: 1 } }}
                          labelPlacement="end"
                        />
                      </FormGroup>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel id="alert-setting-label">Notify me by</InputLabel>
                      <Select
                        labelId="alert-setting-label"
                        id="alert-setting"
                        value={notificationMethod || ProviderNotificationMethod['phone and computer']}
                        label="Notify me by"
                        disabled={
                          updateNotificationSettingsMutation.isPending ||
                          (!taskNotificationsEnabled && !telemedNotificationsEnabled)
                        }
                        onChange={(e) => {
                          setNotificationMethod(e.target.value as ProviderNotificationMethod);
                          setNotificationDirty(true);
                        }}
                      >
                        {Object.keys(ProviderNotificationMethod).map((key) => (
                          <MenuItem
                            key={key}
                            value={ProviderNotificationMethod[key as keyof typeof ProviderNotificationMethod]}
                          >
                            {ProviderNotificationMethod[key as keyof typeof ProviderNotificationMethod]}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <PatternFormat
                      customInput={TextField}
                      value={phoneNumber}
                      format="(###) ###-####"
                      label="Phone"
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                      onValueChange={(values) => {
                        const newNumber = values.value;
                        if (newNumber !== user?.profileResource?.telecom?.find((t) => t.system === 'sms')?.value) {
                          setPhoneDirty(true);
                        }
                        setPhoneNumber(newNumber);
                        setNotificationDirty(true);
                      }}
                      placeholder="(XXX) XXX-XXXX"
                      readOnly={
                        updateNotificationSettingsMutation.isPending ||
                        (!taskNotificationsEnabled && !telemedNotificationsEnabled) ||
                        notificationMethod === ProviderNotificationMethod['computer']
                      }
                      disabled={
                        updateNotificationSettingsMutation.isPending ||
                        (!taskNotificationsEnabled && !telemedNotificationsEnabled) ||
                        notificationMethod === ProviderNotificationMethod['computer']
                      }
                    />
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                  <Button
                    variant="contained"
                    sx={{ borderRadius: 28, textTransform: 'none', fontWeight: 'bold', px: 4 }}
                    onClick={handleApplyNotifications}
                    disabled={!notificationDirty || !phoneDirty || updateNotificationSettingsMutation.isPending}
                  >
                    Save changes
                  </Button>
                </Box>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </>
    </PageContainer>
  );
}
