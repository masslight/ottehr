"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientEncountersGrid = void 0;
var Add_1 = require("@mui/icons-material/Add");
var material_1 = require("@mui/material");
var x_data_grid_pro_1 = require("@mui/x-data-grid-pro");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_query_1 = require("react-query");
var types_1 = require("src/types/types");
var utils_1 = require("utils");
var zustand_1 = require("zustand");
var api_1 = require("../api/api");
var formatDateTime_1 = require("../helpers/formatDateTime");
var useAppClients_1 = require("../hooks/useAppClients");
var utils_2 = require("../telemed/utils");
var RoundedButton_1 = require("./RoundedButton");
var useEmployeesStore = (0, zustand_1.create)()(function () { return ({ employees: [] }); });
var ProviderCell = function (_a) {
    var _b, _c, _d, _e, _f;
    var encounter = _a.encounter;
    var employees = useEmployeesStore().employees;
    var practitioner = (_f = (_e = (_d = (_c = (_b = encounter === null || encounter === void 0 ? void 0 : encounter.participant) === null || _b === void 0 ? void 0 : _b.find(function (participant) { var _a, _b; return (_b = (_a = participant.individual) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Practitioner'); })) === null || _c === void 0 ? void 0 : _c.individual) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.split('/')) === null || _f === void 0 ? void 0 : _f[1];
    var employee = practitioner ? employees.find(function (employee) { return employee.profile.endsWith(practitioner); }) : undefined;
    return <material_1.Typography variant="body2">{employee ? "".concat(employee.firstName, " ").concat(employee.lastName) : '-'}</material_1.Typography>;
};
var columns = [
    {
        sortComparator: function (a, b) {
            var createdA = luxon_1.DateTime.fromISO(a !== null && a !== void 0 ? a : '');
            var createdB = luxon_1.DateTime.fromISO(b !== null && b !== void 0 ? b : '');
            return createdA.diff(createdB).milliseconds;
        },
        field: 'dateTime',
        headerName: 'Date & Time',
        width: 150,
        renderCell: function (_a) {
            var _b = _a.row, dateTime = _b.dateTime, officeTimeZone = _b.officeTimeZone;
            return dateTime ? (0, formatDateTime_1.formatISOStringToDateAndTime)(dateTime, officeTimeZone) : '-';
        },
    },
    {
        sortable: false,
        field: 'status',
        headerName: 'Status',
        width: 140,
        renderCell: function (_a) {
            var _b = _a.row, appointment = _b.appointment, serviceType = _b.serviceMode, encounter = _b.encounter;
            if (serviceType === utils_1.ServiceMode.virtual) {
                if (!encounter) {
                    return;
                }
                var status_1 = (0, utils_1.mapStatusToTelemed)(encounter.status, appointment.status);
                return (0, utils_2.getAppointmentStatusChip)(status_1);
            }
            else {
                if (!encounter)
                    return;
                var encounterStatus = (0, utils_1.getVisitStatus)(appointment, encounter);
                if (!encounterStatus) {
                    return;
                }
                return encounterStatus;
            }
        },
    },
    {
        sortable: false,
        field: 'type',
        headerName: 'Type',
        width: 150,
        renderCell: function (_a) {
            var type = _a.row.typeLabel;
            return type || '-';
        },
    },
    {
        sortable: false,
        field: 'reason',
        headerName: 'Reason for visit',
        width: 150,
        renderCell: function (_a) {
            var _b;
            var appointment = _a.row.appointment;
            return (<material_1.Typography variant="body2">
        {((_b = appointment === null || appointment === void 0 ? void 0 : appointment.description) !== null && _b !== void 0 ? _b : '')
                    .split(',')
                    .map(function (complaint) { return complaint.trim(); })
                    .join(', ') || '-'}
      </material_1.Typography>);
        },
    },
    {
        sortable: false,
        field: 'provider',
        headerName: 'Provider',
        width: 150,
        renderCell: function (_a) {
            var encounter = _a.row.encounter;
            return <ProviderCell encounter={encounter}/>;
        },
    },
    {
        sortable: false,
        field: 'office',
        headerName: 'Office',
        width: 150,
        renderCell: function (_a) {
            var office = _a.row.office;
            return office || '-';
        },
    },
    {
        sortable: false,
        field: 'los',
        headerName: 'LOS',
        width: 100,
        renderCell: function (_a) {
            var length = _a.row.length;
            return length !== undefined ? "".concat((0, utils_1.formatMinutes)(length), " ").concat(length === 1 ? 'min' : 'mins') : '-';
        },
    },
    {
        sortable: false,
        field: 'info',
        headerName: 'Visit Info',
        headerAlign: 'center',
        width: 120,
        renderCell: function (_a) {
            var _b, _c;
            var _d = _a.row, id = _d.id, appointment = _d.appointment;
            // if it's a pre-booked telemed visit the text is just 'prebook' so use the TM tag instead to support both
            var isTelemed = !!((_c = (_b = appointment.meta) === null || _b === void 0 ? void 0 : _b.tag) === null || _c === void 0 ? void 0 : _c.find(function (tag) { return tag.code === utils_1.OTTEHR_MODULE.TM; }));
            return !isTelemed && <RoundedButton_1.RoundedButton to={"/visit/".concat(id)}>Visit Info</RoundedButton_1.RoundedButton>;
        },
    },
    {
        sortable: false,
        field: 'note',
        headerName: 'Progress Note',
        width: 150,
        renderCell: function (_a) {
            var _b = _a.row, id = _b.id, serviceType = _b.serviceMode;
            return (<RoundedButton_1.RoundedButton to={serviceType === utils_1.ServiceMode.virtual
                    ? "/telemed/appointments/".concat(id, "?tab=sign")
                    : "/in-person/".concat(id, "/progress-note")}>
        Progress Note
      </RoundedButton_1.RoundedButton>);
        },
    },
];
var PatientEncountersGrid = function (props) {
    var _a;
    var appointments = props.appointments, loading = props.loading;
    var _b = (0, react_1.useState)('all'), type = _b[0], setType = _b[1];
    var _c = (0, react_1.useState)(0), period = _c[0], setPeriod = _c[1];
    var _d = (0, react_1.useState)('all'), status = _d[0], setStatus = _d[1];
    var _e = (0, react_1.useState)(false), hideCancelled = _e[0], setHideCancelled = _e[1];
    var _f = (0, react_1.useState)(false), hideNoShow = _f[0], setHideNoShow = _f[1];
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    (0, react_query_1.useQuery)(['patient-record-get-employees', { zambdaClient: oystehrZambda }], function () { return (oystehrZambda ? (0, api_1.getEmployees)(oystehrZambda) : null); }, {
        onSuccess: function (response) {
            useEmployeesStore.setState({ employees: (response === null || response === void 0 ? void 0 : response.employees) || [] });
        },
        enabled: !!oystehrZambda,
    });
    var filtered = (0, react_1.useMemo)(function () {
        var filtered = appointments || [];
        if (type !== 'all') {
            filtered = filtered.filter(function (item) { return item.typeLabel === type; });
        }
        if (period) {
            filtered = filtered.filter(function (item) {
                var _a;
                return -luxon_1.DateTime.fromISO((_a = item.dateTime) !== null && _a !== void 0 ? _a : '').diffNow('months').months < period;
            });
        }
        if (status !== 'all') {
            filtered = filtered.filter(function (item) { return filterAppointmentForStatus(item, status); });
        }
        if (hideCancelled) {
            filtered = filtered.filter(function (item) { return !filterAppointmentForStatus(item, 'cancelled'); });
        }
        if (hideNoShow) {
            filtered = filtered.filter(function (item) { return item.serviceMode === utils_1.ServiceMode.virtual || !filterAppointmentForStatus(item, 'no show'); });
        }
        return filtered;
    }, [appointments, period, type, status, hideCancelled, hideNoShow]);
    function filterAppointmentForStatus(appointmentHistory, filterStatus) {
        if (!appointmentHistory.encounter)
            return false;
        var appointmentStatus = appointmentHistory.serviceMode === utils_1.ServiceMode.virtual
            ? (0, utils_1.mapStatusToTelemed)(appointmentHistory.encounter.status, appointmentHistory.appointment.status)
            : (0, utils_1.getVisitStatus)(appointmentHistory.appointment, appointmentHistory.encounter);
        return filterStatus === appointmentStatus;
    }
    return (<material_1.Paper sx={{ padding: 3 }} component={material_1.Stack} spacing={2}>
      <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <material_1.Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
          Encounters - {(appointments === null || appointments === void 0 ? void 0 : appointments.length) || 0}
        </material_1.Typography>
        {((_a = appointments === null || appointments === void 0 ? void 0 : appointments[0]) === null || _a === void 0 ? void 0 : _a.dateTime) && (<material_1.Typography>
            Latest visit: {(0, formatDateTime_1.formatISOStringToDateAndTime)(appointments[0].dateTime, appointments[0].officeTimeZone)}
          </material_1.Typography>)}
        <RoundedButton_1.RoundedButton to="/visits/add" target="_blank" variant="contained" startIcon={<Add_1.default fontSize="small"/>}>
          New Visit
        </RoundedButton_1.RoundedButton>
      </material_1.Box>

      <material_1.Box sx={{ display: 'flex', gap: 2 }}>
        <material_1.TextField size="small" fullWidth label="Type" select value={type} onChange={function (e) { return setType(e.target.value); }}>
          <material_1.MenuItem value="all">All</material_1.MenuItem>
          <material_1.MenuItem value={types_1.VisitTypeToLabel['walk-in']}>{types_1.VisitTypeToLabel['walk-in']}</material_1.MenuItem>
          <material_1.MenuItem value={types_1.VisitTypeToLabel['post-telemed']}>{types_1.VisitTypeToLabel['post-telemed']}</material_1.MenuItem>
          <material_1.MenuItem value={types_1.VisitTypeToLabel['pre-booked']}>{types_1.VisitTypeToLabel['pre-booked']}</material_1.MenuItem>
          <material_1.MenuItem value={types_1.VisitTypeToLabelTelemed['pre-booked']}>{types_1.VisitTypeToLabelTelemed['pre-booked']}</material_1.MenuItem>
          <material_1.MenuItem value={types_1.VisitTypeToLabelTelemed['walk-in']}>{types_1.VisitTypeToLabelTelemed['walk-in']}</material_1.MenuItem>
        </material_1.TextField>

        <material_1.TextField size="small" fullWidth label="Visit Period" select value={period} onChange={function (e) { return setPeriod(+e.target.value); }}>
          <material_1.MenuItem value={0}>All</material_1.MenuItem>
          <material_1.MenuItem value={1}>Last month</material_1.MenuItem>
          <material_1.MenuItem value={3}>Last 3 months</material_1.MenuItem>
          <material_1.MenuItem value={6}>Last 6 months</material_1.MenuItem>
          <material_1.MenuItem value={12}>Last year</material_1.MenuItem>
        </material_1.TextField>

        <material_1.TextField size="small" fullWidth label="Visit Status" select value={status} onChange={function (e) { return setStatus(e.target.value); }}>
          <material_1.MenuItem value="all">All</material_1.MenuItem>
          {__spreadArray([], new Set(__spreadArray(__spreadArray([], utils_1.TelemedCallStatusesArr, true), utils_1.Visit_Status_Array.filter(function (item) { return item !== 'cancelled'; }), true)), true).map(function (status) { return (<material_1.MenuItem key={status} value={status}>
                {(0, material_1.capitalize)(status)}
              </material_1.MenuItem>); })}
        </material_1.TextField>

        <material_1.FormControlLabel sx={{
            whiteSpace: 'nowrap',
        }} control={<material_1.Checkbox value={hideCancelled} onChange={function (e) { return setHideCancelled(e.target.checked); }}/>} label="Hide “Cancelled”"/>

        <material_1.FormControlLabel sx={{
            whiteSpace: 'nowrap',
        }} control={<material_1.Checkbox value={hideNoShow} onChange={function (e) { return setHideNoShow(e.target.checked); }}/>} label="Hide “No Show”"/>
      </material_1.Box>

      <x_data_grid_pro_1.DataGridPro rows={filtered} columns={columns} initialState={{
            pagination: {
                paginationModel: {
                    pageSize: 5,
                },
            },
            sorting: {
                sortModel: [{ field: 'dateTime', sort: 'desc' }],
            },
        }} autoHeight loading={loading} pagination disableColumnMenu pageSizeOptions={[5]} disableRowSelectionOnClick sx={{
            border: 0,
            '.MuiDataGrid-columnHeaderTitle': {
                fontWeight: 500,
            },
        }}/>
    </material_1.Paper>);
};
exports.PatientEncountersGrid = PatientEncountersGrid;
//# sourceMappingURL=PatientEncountersGrid.js.map