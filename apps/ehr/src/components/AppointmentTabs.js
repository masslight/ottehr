"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApptTab = void 0;
exports.default = AppointmentTabs;
var colors_1 = require("@ehrTheme/colors");
var FmdBadOutlined_1 = require("@mui/icons-material/FmdBadOutlined");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var data_test_ids_1 = require("../constants/data-test-ids");
var AppointmentTable_1 = require("./AppointmentTable");
var Loading_1 = require("./Loading");
var ApptTab;
(function (ApptTab) {
    ApptTab["prebooked"] = "prebooked";
    ApptTab["in-office"] = "in-office";
    ApptTab["completed"] = "completed";
    ApptTab["cancelled"] = "cancelled";
})(ApptTab || (exports.ApptTab = ApptTab = {}));
function AppointmentTabs(_a) {
    var location = _a.location, providers = _a.providers, groups = _a.groups, preBookedAppointments = _a.preBookedAppointments, completedAppointments = _a.completedAppointments, cancelledAppointments = _a.cancelledAppointments, inOfficeAppointments = _a.inOfficeAppointments, loading = _a.loading, updateAppointments = _a.updateAppointments, setEditingComment = _a.setEditingComment, orders = _a.orders;
    var _b = (0, react_1.useState)(ApptTab['in-office']), value = _b[0], setValue = _b[1];
    var _c = (0, react_1.useState)(luxon_1.DateTime.now()), now = _c[0], setNow = _c[1];
    var handleChange = function (event, newValue) {
        setValue(newValue);
    };
    react_1.default.useEffect(function () {
        function updateTime() {
            setNow(luxon_1.DateTime.now());
        }
        var timeInterval = setInterval(updateTime, 1000);
        // Call updateTime so we don't need to wait for it to be called
        updateTime();
        return function () { return clearInterval(timeInterval); };
    }, []);
    var selectLocationMsg = !location && (providers === null || providers === void 0 ? void 0 : providers.length) === 0 && (groups === null || groups === void 0 ? void 0 : groups.length) === 0 && (<material_1.Grid container sx={{ width: '100%' }} padding={4}>
      <material_1.Grid item>
        <FmdBadOutlined_1.default sx={{
            width: 62,
            height: 62,
            color: colors_1.otherColors.orange700,
            borderRadius: '50%',
            backgroundColor: colors_1.otherColors.orange100,
            padding: 1.4,
            marginRight: 2,
        }}></FmdBadOutlined_1.default>
      </material_1.Grid>
      <material_1.Grid item sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
        }}>
        <material_1.Typography sx={{ fontWeight: 'bold' }}>Please select an office, provider, or group</material_1.Typography>
        <material_1.Typography>Please select an office, provider, or group to get appointments</material_1.Typography>
      </material_1.Grid>
    </material_1.Grid>);
    var renderAppointmentTable = function (appointments) {
        return (<AppointmentTable_1.default appointments={appointments} orders={orders} location={location} tab={value} now={now} updateAppointments={updateAppointments} setEditingComment={setEditingComment}/>);
    };
    return (<material_1.Box sx={{ width: '100%', marginTop: 3 }}>
      <lab_1.TabContext value={value}>
        <material_1.Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <lab_1.TabList variant="scrollable" allowScrollButtonsMobile={true} onChange={handleChange} aria-label="appointment tabs">
            <material_1.Tab data-testid={data_test_ids_1.dataTestIds.dashboard.prebookedTab} label={"Pre-booked".concat(preBookedAppointments ? " \u2013 ".concat(preBookedAppointments === null || preBookedAppointments === void 0 ? void 0 : preBookedAppointments.length) : '')} value={ApptTab.prebooked} sx={{ textTransform: 'none', fontWeight: 500 }}/>
            <material_1.Tab data-testid={data_test_ids_1.dataTestIds.dashboard.inOfficeTab} label={"In Office".concat(inOfficeAppointments ? " \u2013 ".concat(inOfficeAppointments === null || inOfficeAppointments === void 0 ? void 0 : inOfficeAppointments.length) : '')} value={ApptTab['in-office']} sx={{ textTransform: 'none', fontWeight: 500 }}/>
            <material_1.Tab data-testid={data_test_ids_1.dataTestIds.dashboard.dischargedTab} label={"Discharged".concat(completedAppointments ? " \u2013 ".concat(completedAppointments === null || completedAppointments === void 0 ? void 0 : completedAppointments.length) : '')} value={ApptTab.completed} sx={{ textTransform: 'none', fontWeight: 500 }}/>
            <material_1.Tab data-testid={data_test_ids_1.dataTestIds.dashboard.cancelledTab} label="Cancelled" value={ApptTab.cancelled} sx={{ textTransform: 'none', fontWeight: 500 }}/>
            {loading && <Loading_1.default />}
          </lab_1.TabList>
        </material_1.Box>
        <lab_1.TabPanel value={ApptTab.prebooked} sx={{ padding: 0 }}>
          {selectLocationMsg || renderAppointmentTable(preBookedAppointments)}
        </lab_1.TabPanel>
        <lab_1.TabPanel value={ApptTab['in-office']} sx={{ padding: 0 }}>
          {selectLocationMsg || renderAppointmentTable(inOfficeAppointments)}
        </lab_1.TabPanel>
        <lab_1.TabPanel value={ApptTab.completed} sx={{ padding: 0 }}>
          {selectLocationMsg || renderAppointmentTable(completedAppointments)}
        </lab_1.TabPanel>
        <lab_1.TabPanel value={ApptTab.cancelled} sx={{ padding: 0 }}>
          {selectLocationMsg || renderAppointmentTable(cancelledAppointments)}
        </lab_1.TabPanel>
      </lab_1.TabContext>
    </material_1.Box>);
}
//# sourceMappingURL=AppointmentTabs.js.map