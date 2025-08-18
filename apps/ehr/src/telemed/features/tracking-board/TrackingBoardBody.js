"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingBoardBody = TrackingBoardBody;
var material_1 = require("@mui/material");
var react_number_format_1 = require("react-number-format");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var notifications_queries_1 = require("../../../features/notifications/notifications.queries");
var notifications_store_1 = require("../../../features/notifications/notifications.store");
var useEvolveUser_1 = require("../../../hooks/useEvolveUser");
var PageContainer_1 = require("../../../layout/PageContainer");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var components_1 = require("../../components");
var state_1 = require("../../state");
var TrackingBoardTabs_1 = require("./TrackingBoardTabs");
function TrackingBoardBody() {
    var _a, _b, _c;
    var _d = (0, getSelectors_1.getSelectors)(state_1.useTrackingBoardStore, ['alignment', 'setAlignment']), alignment = _d.alignment, setAlignment = _d.setAlignment;
    var user = (0, useEvolveUser_1.default)();
    var _e = (0, getSelectors_1.getSelectors)(notifications_store_1.useProviderNotificationsStore, [
        'notificationsEnabled',
        'notificationMethod',
    ]), notificationsEnabled = _e.notificationsEnabled, notificationMethod = _e.notificationMethod;
    var updateNotificationSettingsMutation = (0, notifications_queries_1.useUpdateProviderNotificationSettingsMutation)(function (params) {
        notifications_store_1.useProviderNotificationsStore.setState({ notificationsEnabled: params.enabled, notificationMethod: params.method });
    });
    var phoneNumber = (_c = (_b = (_a = user === null || user === void 0 ? void 0 : user.profileResource) === null || _a === void 0 ? void 0 : _a.telecom) === null || _b === void 0 ? void 0 : _b.find(function (telecom) { return telecom.system === 'sms'; })) === null || _c === void 0 ? void 0 : _c.value;
    return (<form>
      <PageContainer_1.default>
        <>
          <material_1.Grid container direction="row" justifyContent="space-between" alignItems="center">
            <material_1.ToggleButtonGroup size="small" value={alignment} exclusive onChange={setAlignment}>
              <components_1.ContainedPrimaryToggleButton value="all-patients" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.allPatientsButton}>
                All Patients
              </components_1.ContainedPrimaryToggleButton>
              <components_1.ContainedPrimaryToggleButton value="my-patients" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.myPatientsButton}>
                Patients Matching My Credentials
              </components_1.ContainedPrimaryToggleButton>
            </material_1.ToggleButtonGroup>

            <material_1.Box>
              <material_1.FormControl sx={{ marginTop: '7px', marginRight: '20px' }}>
                <material_1.FormGroup>
                  <material_1.FormControlLabel control={<material_1.Switch value={notificationsEnabled || false} disabled={updateNotificationSettingsMutation.isLoading} checked={notificationsEnabled || false} onChange={function () {
                return updateNotificationSettingsMutation.mutateAsync({
                    enabled: !notificationsEnabled,
                    method: notificationMethod || utils_1.ProviderNotificationMethod['phone and computer'],
                });
            }}/>} label="Send alerts" labelPlacement="start"/>
                </material_1.FormGroup>
              </material_1.FormControl>
              <react_number_format_1.PatternFormat customInput={material_1.TextField} value={phoneNumber} format="(###) ###-####" label="Send alerts to:" InputLabelProps={{ shrink: true }} placeholder="(XXX) XXX-XXXX" readOnly={!notificationsEnabled || notificationMethod === utils_1.ProviderNotificationMethod['computer']} disabled={!notificationsEnabled || notificationMethod === utils_1.ProviderNotificationMethod['computer']}/>
              <material_1.FormControl sx={{ marginLeft: 2, width: 250 }}>
                <material_1.InputLabel id="alert-setting-label">Notify me by:</material_1.InputLabel>
                <material_1.Select labelId="alert-setting-label" id="alert-setting" value={notificationMethod || utils_1.ProviderNotificationMethod['phone and computer']} label="Notify me by" disabled={updateNotificationSettingsMutation.isLoading} onChange={function (event) {
            console.log(event.target);
            void updateNotificationSettingsMutation.mutateAsync({
                enabled: notificationsEnabled || false,
                method: event.target.value,
            });
        }}>
                  {Object.keys(utils_1.ProviderNotificationMethod).map(function (key) { return (<material_1.MenuItem key={key} value={utils_1.ProviderNotificationMethod[key]}>
                      {utils_1.ProviderNotificationMethod[key]}
                    </material_1.MenuItem>); })}
                </material_1.Select>
              </material_1.FormControl>
            </material_1.Box>
          </material_1.Grid>
          <TrackingBoardTabs_1.TrackingBoardTabs />
        </>
      </PageContainer_1.default>
    </form>);
}
//# sourceMappingURL=TrackingBoardBody.js.map