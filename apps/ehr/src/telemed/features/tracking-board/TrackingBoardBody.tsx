import {
  Box,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  ToggleButtonGroup,
} from '@mui/material';
import { ReactElement } from 'react';
import { PatternFormat } from 'react-number-format';
import { ProviderNotificationMethod } from 'utils';
import { dataTestIds } from '../../../constants/data-test-ids';
import { useUpdateProviderNotificationSettingsMutation } from '../../../features/notifications/notifications.queries';
import { useProviderNotificationsStore } from '../../../features/notifications/notifications.store';
import useEvolveUser from '../../../hooks/useEvolveUser';
import PageContainer from '../../../layout/PageContainer';
import { getSelectors } from '../../../shared/store/getSelectors';
import { ContainedPrimaryToggleButton } from '../../components';
import { useTrackingBoardStore } from '../../state';
import { TrackingBoardTabs } from './TrackingBoardTabs';

export function TrackingBoardBody(): ReactElement {
  const { alignment, setAlignment } = getSelectors(useTrackingBoardStore, ['alignment', 'setAlignment']);
  const user = useEvolveUser();
  const { notificationsEnabled, notificationMethod } = getSelectors(useProviderNotificationsStore, [
    'notificationsEnabled',
    'notificationMethod',
  ]);
  const updateNotificationSettingsMutation = useUpdateProviderNotificationSettingsMutation((params) => {
    useProviderNotificationsStore.setState({ notificationsEnabled: params.enabled, notificationMethod: params.method });
  });
  const phoneNumber = user?.profileResource?.telecom?.find((telecom) => telecom.system === 'sms')?.value;

  return (
    <form>
      <PageContainer>
        <>
          <Grid container direction="row" justifyContent="space-between" alignItems="center">
            <ToggleButtonGroup size="small" value={alignment} exclusive onChange={setAlignment}>
              <ContainedPrimaryToggleButton
                value="all-patients"
                data-testid={dataTestIds.telemedEhrFlow.allPatientsButton}
              >
                All Patients
              </ContainedPrimaryToggleButton>
              <ContainedPrimaryToggleButton
                value="my-patients"
                data-testid={dataTestIds.telemedEhrFlow.myPatientsButton}
              >
                Patients Matching My Credentials
              </ContainedPrimaryToggleButton>
            </ToggleButtonGroup>

            <Box>
              <FormControl sx={{ marginTop: '7px', marginRight: '20px' }}>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        value={notificationsEnabled || false}
                        disabled={updateNotificationSettingsMutation.isPending}
                        checked={notificationsEnabled || false}
                        onChange={() =>
                          updateNotificationSettingsMutation.mutateAsync({
                            enabled: !notificationsEnabled,
                            method: notificationMethod || ProviderNotificationMethod['phone and computer'],
                          })
                        }
                      />
                    }
                    label="Send alerts"
                    labelPlacement="start"
                  />
                </FormGroup>
              </FormControl>
              <PatternFormat
                customInput={TextField}
                value={phoneNumber}
                format="(###) ###-####"
                label="Send alerts to:"
                InputLabelProps={{ shrink: true }}
                placeholder="(XXX) XXX-XXXX"
                readOnly={!notificationsEnabled || notificationMethod === ProviderNotificationMethod['computer']}
                disabled={!notificationsEnabled || notificationMethod === ProviderNotificationMethod['computer']}
              />
              <FormControl sx={{ marginLeft: 2, width: 250 }}>
                <InputLabel id="alert-setting-label">Notify me by:</InputLabel>
                <Select
                  labelId="alert-setting-label"
                  id="alert-setting"
                  value={notificationMethod || ProviderNotificationMethod['phone and computer']}
                  label="Notify me by"
                  disabled={updateNotificationSettingsMutation.isPending}
                  onChange={(event) => {
                    console.log(event.target);
                    void updateNotificationSettingsMutation.mutateAsync({
                      enabled: notificationsEnabled || false,
                      method: event.target.value as ProviderNotificationMethod,
                    });
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
            </Box>
          </Grid>
          <TrackingBoardTabs />
        </>
      </PageContainer>
    </form>
  );
}
