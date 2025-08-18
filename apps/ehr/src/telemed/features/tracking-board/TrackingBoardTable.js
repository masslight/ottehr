"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingBoardTable = TrackingBoardTable;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var utils_2 = require("../../utils");
var TrackingBoardFilters_1 = require("./TrackingBoardFilters");
var TrackingBoardTableRow_1 = require("./TrackingBoardTableRow");
var TRACKING_BOARD_COLUMNS_CONFIG = {
    STATUS: {
        id: 'status',
        label: 'Type & Status',
    },
    WAITING_TIME: {
        id: 'waitingTime',
        label: 'Waiting time',
    },
    PATIENT_INFO_REASON: {
        id: 'patient-info-reason',
        label: 'Patient & Reason',
    },
    LOCATION: {
        id: 'state',
        label: 'State',
    },
    PROVIDER: {
        id: 'provider',
        label: 'Provider',
        conditional: {
            showWhen: 'showProvider',
        },
    },
    GROUP: {
        id: 'group',
        label: 'Group',
    },
    CHAT: {
        id: 'chat',
        label: 'Chat',
    },
    ACTION: {
        id: 'action',
        label: 'Action',
    },
};
function TrackingBoardTable(_a) {
    var _b, _c;
    var tab = _a.tab;
    var theme = (0, material_1.useTheme)();
    var _d = (0, getSelectors_1.getSelectors)(state_1.useTrackingBoardStore, [
        'appointments',
        'selectedStates',
        'unsignedFor',
        'availableStates',
        'isAppointmentsLoading',
        'showOnlyNext',
    ]), appointments = _d.appointments, selectedStates = _d.selectedStates, availableStates = _d.availableStates, isAppointmentsLoading = _d.isAppointmentsLoading, unsignedFor = _d.unsignedFor, showOnlyNext = _d.showOnlyNext;
    var filteredAppointments = (0, utils_2.filterAppointments)(appointments, unsignedFor, tab, showOnlyNext, availableStates);
    var showProvider = tab !== utils_1.ApptTelemedTab.ready;
    var columns = getVisibleColumns({ showProvider: showProvider });
    var groupsSortedByState = (0, react_1.useMemo)(function () {
        var createGroups = function () {
            return filteredAppointments.reduce(function (accumulator, appointment) {
                if (appointment.locationVirtual.state) {
                    if (!accumulator[appointment.locationVirtual.state]) {
                        accumulator[appointment.locationVirtual.state] = [];
                    }
                    accumulator[appointment.locationVirtual.state].push(appointment);
                    return accumulator;
                }
                else if (appointment.provider) {
                    if (!accumulator[appointment.provider.join(',')]) {
                        accumulator[appointment.provider.join(',')] = [];
                    }
                    accumulator[appointment.provider.join(',')].push(appointment);
                    return accumulator;
                }
                else if (appointment.group) {
                    if (!accumulator[appointment.group.join(',')]) {
                        accumulator[appointment.group.join(',')] = [];
                    }
                    accumulator[appointment.group.join(',')].push(appointment);
                    return accumulator;
                }
                else {
                    console.error('missing location and provider and group for appointment', appointment);
                    return accumulator;
                }
            }, {});
        };
        var groups = createGroups();
        var states = selectedStates || [];
        if (!states || states.length === 0) {
            return groups;
        }
        // Rebuild the record with a sorted states as keys
        var sortedGroups = {};
        states.forEach(function (usState) {
            if (usState in groups) {
                sortedGroups[usState] = groups[usState];
            }
        });
        return sortedGroups;
    }, [filteredAppointments, selectedStates]);
    var groupCollapse = Object.keys(groupsSortedByState).reduce(function (accumulator, state) {
        accumulator[state] = false;
        return accumulator;
    }, {});
    var oldestId = (_c = (_b = filteredAppointments
        .filter(function (appointment) { return availableStates.includes(appointment.locationVirtual.state); })
        .sort(function (a, b) { return (0, utils_2.compareLuxonDates)(luxon_1.DateTime.fromISO(a.start), luxon_1.DateTime.fromISO(b.start)); })) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.id;
    var showNext = tab === utils_1.ApptTelemedTab.ready;
    return (<material_1.Box>
      <TrackingBoardFilters_1.TrackingBoardFilters tab={tab}/>
      <material_1.TableContainer sx={{ overflow: 'inherit' }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTable}>
        <material_1.Table>
          <material_1.TableHead>
            <material_1.TableRow>
              {columns.map(function (column) { return (<material_1.TableCell key={column.id}>
                  <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    {column.label}
                  </material_1.Typography>
                </material_1.TableCell>); })}
            </material_1.TableRow>
          </material_1.TableHead>
          <material_1.TableBody>
            {isAppointmentsLoading ? (<TrackingBoardTableRow_1.TrackingBoardTableRowSkeleton showProvider={showProvider} isState={false} columnsCount={columns.length}/>) : (Object.keys(groupsSortedByState).map(function (state) { return (<react_1.default.Fragment key={state}>
                  <material_1.TableRow data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTableGroupRow}>
                    <material_1.TableCell sx={{ backgroundColor: (0, material_1.alpha)(theme.palette.secondary.main, 0.08) }} colSpan={9 + +showProvider}>
                      <material_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                          {state} - {utils_1.AllStatesToNames[state]}
                        </material_1.Typography>
                      </material_1.Box>
                    </material_1.TableCell>
                  </material_1.TableRow>
                  {!groupCollapse[state] &&
                groupsSortedByState[state]
                    .sort(function (a, b) { return (0, utils_2.compareAppointments)(tab === utils_1.ApptTelemedTab['not-signed'], a, b); })
                    .map(function (appointment) { return (<TrackingBoardTableRow_1.TrackingBoardTableRow key={appointment.id} appointment={appointment} showProvider={showProvider} next={appointment.id === oldestId && showNext}/>); })}
                </react_1.default.Fragment>); }))}
          </material_1.TableBody>
        </material_1.Table>
      </material_1.TableContainer>
    </material_1.Box>);
}
var getVisibleColumns = function (conditions) {
    return Object.values(TRACKING_BOARD_COLUMNS_CONFIG).filter(function (column) { return !column.conditional || conditions[column.conditional.showWhen]; });
};
//# sourceMappingURL=TrackingBoardTable.js.map