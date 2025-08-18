"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimStatusOptions = exports.mapClaimTypeToColumnNames = exports.ClaimsQueueColumns = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var getSelectors_1 = require("../../shared/store/getSelectors");
var utils_1 = require("../../telemed/utils");
var features_1 = require("../features");
var state_1 = require("../state");
var resources_helper_1 = require("./resources.helper");
exports.ClaimsQueueColumns = {
    queue: {
        sortable: false,
        field: 'id',
        headerName: 'Queue',
        width: 60,
        renderCell: function (params) { var _a; return (((_a = params.row.appointment.appointmentType) === null || _a === void 0 ? void 0 : _a.text) === 'virtual' ? 'TM' : 'IP'); },
    },
    cid: {
        sortable: false,
        field: 'cid',
        headerName: 'Claim ID',
        width: 100,
        renderCell: function (params) { return (<material_1.Box>
        <material_1.Tooltip title={params.row.claim.id}>
          <material_1.Link component={react_router_dom_1.Link} to={"/rcm/claims/".concat(params.row.claim.id)} target="_blank">
            {params.row.claim.id}
          </material_1.Link>
        </material_1.Tooltip>
        <material_1.Typography fontSize={12} color="text.secondary">
          {calculateTimeSince(params.row.claim.created)}
        </material_1.Typography>
      </material_1.Box>); },
    },
    vid: {
        sortable: false,
        field: 'vid',
        headerName: 'Visit ID',
        width: 120,
        renderCell: function (params) {
            // const {} = params.row;
            //
            // const statuses = useMemo(
            //   () =>
            //     encounter.statusHistory && appointment?.status
            //       ? mapEncounterStatusHistory(encounter.statusHistory, appointment.status)
            //       : undefined,
            //   [encounter.statusHistory, appointment?.status]
            // );
            // const dateOfService = formatDateTimeToEDT(statuses?.find((item) => item.status === 'on-video')?.start);
            var _a, _b, _c, _d, _e;
            return (<material_1.Box>
          <material_1.Tooltip title={params.row.appointment.id}>
            <material_1.Link component={react_router_dom_1.Link} to={"".concat(((_a = params.row.appointment.appointmentType) === null || _a === void 0 ? void 0 : _a.text) === 'virtual' ? '/telemed/appointments/' : '/visit/').concat(params.row.appointment.id)} target="_blank">
              {params.row.appointment.id}
            </material_1.Link>
          </material_1.Tooltip>
          <material_1.Typography fontSize={12} color="text.secondary">
            DOS: {luxon_1.DateTime.fromISO(((_e = (_d = (_c = (_b = params.row.claim) === null || _b === void 0 ? void 0 : _b.item) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.servicedPeriod) === null || _e === void 0 ? void 0 : _e.end) || '').toFormat('MM/dd/yyyy')}
          </material_1.Typography>
        </material_1.Box>);
        },
    },
    patient: {
        sortable: false,
        field: 'patient',
        headerName: 'Patient',
        renderCell: function (params) {
            var _a;
            return (<material_1.Box>
        <material_1.Tooltip title={params.row.patient.id}>
          <material_1.Link component={react_router_dom_1.Link} to={"/patient/".concat(params.row.patient.id)} target="_blank">
            {(0, utils_1.getPatientName)(params.row.patient.name).firstLastName}
          </material_1.Link>
        </material_1.Tooltip>
        <material_1.Typography fontSize={12} color="text.secondary">
          DOB: {(_a = (0, resources_helper_1.getDateFromFormat)(params.row.patient.birthDate)) === null || _a === void 0 ? void 0 : _a.toFormat('MM/dd/yyyy')}
        </material_1.Typography>
      </material_1.Box>);
        },
    },
    member: {
        sortable: false,
        field: 'member',
        headerName: 'Team member',
        width: 120,
        renderCell: function (params) {
            var _a;
            var assigned = (_a = params.row.claim.enterer) === null || _a === void 0 ? void 0 : _a.reference;
            var employees = (0, getSelectors_1.getSelectors)(state_1.useClaimsQueueStore, ['employees']).employees;
            // eslint-disable-next-line react-hooks/rules-of-hooks
            var employee = (0, react_1.useMemo)(function () { return employees.find(function (employee) { return employee.profile === assigned; }); }, [assigned, employees]);
            if (!assigned || !employee) {
                return (<material_1.Typography variant="body2" color="text.secondary">
            Not assigned
          </material_1.Typography>);
            }
            else {
                return (<material_1.Typography variant="body2">
            {employee.firstName && employee.lastName
                        ? [employee.lastName, employee.firstName].join(', ')
                        : employee.name
                            ? employee.name
                            : '-'}
          </material_1.Typography>);
            }
        },
    },
    state: {
        sortable: false,
        field: 'state',
        headerName: 'Visit state',
        width: 90,
        renderCell: function (params) { var _a; return (_a = params.row.location.address) === null || _a === void 0 ? void 0 : _a.state; },
    },
    insurance: {
        sortable: false,
        field: 'insurance',
        headerName: 'Insurance',
        renderCell: function (params) { var _a; return <material_1.Typography variant="body2">{(_a = params.row.insurancePlan) === null || _a === void 0 ? void 0 : _a.name}</material_1.Typography>; },
    },
    tos: {
        sortable: false,
        field: 'tos',
        headerName: 'TOS $',
        width: 110,
        renderCell: function () { return <material_1.Typography variant="body2"></material_1.Typography>; },
    },
    eligibility: {
        sortable: false,
        field: 'eligibility',
        headerName: 'Initial Eligibility',
        width: 130,
        renderCell: function (params) { return (<features_1.EligibilityStatusChip appointment={params.row.appointment} eligibilityResponse={params.row.eligibilityResponse}/>); },
    },
    payment: { sortable: false, field: 'payment', headerName: 'TOS Payment', width: 130 },
    status: {
        sortable: false,
        field: 'status',
        // cSpell:disable-next Registr.(ation)
        headerName: 'Registr. Status',
        width: 130,
        renderCell: function (params) { return <features_1.ClaimStatusChip status={params.row.status}/>; },
    },
};
exports.mapClaimTypeToColumnNames = {
    registration: [
        'queue',
        'cid',
        'vid',
        'patient',
        'member',
        'state',
        'insurance',
        'tos',
        'eligibility',
        'payment',
        'status',
    ],
    coding: [],
    billing: [],
    'credentialing-hold': [],
    credits: [],
};
exports.claimStatusOptions = {
    open: 'Open',
    locked: 'Locked',
    'returned-billing': 'Returned (billing)',
    'returned-coding': 'Returned (coding)',
    sent: 'Sent',
    'partly-paid': 'Partly paid',
    denied: 'Denied',
    'returned-credentialing-hold': 'Returned (cred.hold)',
    'credential-hold': 'Credential Hold',
};
var calculateTimeSince = function (targetDate) {
    var now = luxon_1.DateTime.now();
    var target = luxon_1.DateTime.fromISO(targetDate);
    var diff = now.diff(target, ['years', 'months', 'days', 'hours', 'minutes', 'seconds']).toObject();
    var differenceString = '';
    if (diff.years) {
        differenceString = "".concat(diff.years, " years ago");
    }
    else if (diff.months) {
        differenceString = "".concat(diff.months, " months ago");
    }
    else if (diff.days) {
        differenceString = "".concat(diff.days, " days ago");
    }
    else if (diff.hours) {
        differenceString = "".concat(diff.hours, " hours ago");
    }
    else if (diff.minutes) {
        differenceString = "".concat(diff.minutes, " minutes ago");
    }
    else {
        differenceString = 'just now';
    }
    return differenceString;
};
//# sourceMappingURL=claims-queue-columns.helper.js.map