"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingBoardTabs = TrackingBoardTabs;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var CreateDemoVisits_1 = require("../../../components/CreateDemoVisits");
var Loading_1 = require("../../../components/Loading");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var useOystehrAPIClient_1 = require("../../hooks/useOystehrAPIClient");
var state_1 = require("../../state");
var utils_2 = require("../../utils");
var TrackingBoardTable_1 = require("./TrackingBoardTable");
function TrackingBoardTabs() {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useTrackingBoardStore, [
        'alignment',
        'selectedStates',
        'providers',
        'groups',
        'date',
        'setAppointments',
        'locationsIds',
        'visitTypes',
    ]), alignment = _a.alignment, selectedStates = _a.selectedStates, date = _a.date, providers = _a.providers, groups = _a.groups, setAppointments = _a.setAppointments, locationsIds = _a.locationsIds, visitTypes = _a.visitTypes;
    var _b = (0, react_1.useState)(utils_1.ApptTelemedTab.ready), value = _b[0], setValue = _b[1];
    var handleChange = function (_, newValue) {
        setValue(newValue);
    };
    var apiClient = (0, useOystehrAPIClient_1.useOystehrAPIClient)();
    var dateFilter = date ? date.toISODate() : undefined;
    var actualStatesFilter = selectedStates ? selectedStates : undefined;
    var _c = (0, state_1.useGetTelemedAppointments)({
        apiClient: apiClient,
        usStatesFilter: actualStatesFilter,
        locationsIdsFilter: locationsIds || undefined,
        providersFilter: providers || undefined,
        groupsFilter: groups || undefined,
        patientFilter: alignment,
        statusesFilter: utils_2.ApptTabToStatus[value],
        dateFilter: dateFilter,
        visitTypesFilter: visitTypes || undefined,
    }, function (data) {
        setAppointments(data.appointments);
    }), isFetching = _c.isFetching, isFetchedAfterMount = _c.isFetchedAfterMount;
    (0, react_1.useEffect)(function () {
        state_1.useTrackingBoardStore.setState({ isAppointmentsLoading: !isFetchedAfterMount });
    }, [isFetchedAfterMount]);
    return (<material_1.Box sx={{ width: '100%', marginTop: 3 }}>
      <lab_1.TabContext value={value}>
        <material_1.Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <lab_1.TabList onChange={handleChange} aria-label="appointment tabs">
            <material_1.Tab label="Ready for provider" value={utils_1.ApptTelemedTab.ready} sx={{ textTransform: 'none', fontWeight: 500 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(utils_1.ApptTelemedTab.ready)}/>
            <material_1.Tab label="Provider" value={utils_1.ApptTelemedTab.provider} sx={{ textTransform: 'none', fontWeight: 500 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(utils_1.ApptTelemedTab.provider)}/>
            <material_1.Tab label="Unsigned" value={utils_1.ApptTelemedTab['not-signed']} sx={{ textTransform: 'none', fontWeight: 500 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(utils_1.ApptTelemedTab['not-signed'])}/>
            <material_1.Tab label="Complete" value={utils_1.ApptTelemedTab.complete} sx={{ textTransform: 'none', fontWeight: 500 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(utils_1.ApptTelemedTab.complete)}/>
            {isFetching && <Loading_1.default />}
          </lab_1.TabList>
        </material_1.Box>
        <material_1.Paper sx={{ marginTop: 3 }}>
          <lab_1.TabPanel value={value} sx={{ padding: 0 }}>
            <TrackingBoardTable_1.TrackingBoardTable tab={value}/>
          </lab_1.TabPanel>
        </material_1.Paper>
        <CreateDemoVisits_1.default />
      </lab_1.TabContext>
    </material_1.Box>);
}
//# sourceMappingURL=TrackingBoardTabs.js.map