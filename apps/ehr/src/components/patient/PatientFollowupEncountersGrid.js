"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientFollowupEncountersGrid = exports.getFollowupStatusChip = void 0;
var Add_1 = require("@mui/icons-material/Add");
var material_1 = require("@mui/material");
var x_data_grid_pro_1 = require("@mui/x-data-grid-pro");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var styled_components_1 = require("styled-components");
var utils_1 = require("utils");
var formatDateTime_1 = require("../../helpers/formatDateTime");
var useAppClients_1 = require("../../hooks/useAppClients");
var RoundedButton_1 = require("../RoundedButton");
var statusColors = {
    OPEN: { bg: '#b3e5fc', text: '#01579B' },
    RESOLVED: { bg: '#c8e6c9', text: '#1b5e20' },
};
var StatusChip = (0, styled_components_1.default)(material_1.Chip)(function () { return ({
    borderRadius: '8px',
    padding: '0 9px',
    margin: 0,
    height: '24px',
    '& .MuiChip-label': {
        padding: 0,
        fontWeight: 'bold',
        fontSize: '0.7rem',
    },
    '& .MuiChip-icon': {
        marginLeft: 'auto',
        marginRight: '-4px',
        order: 1,
    },
}); });
var getFollowupStatusChip = function (status) {
    var statusVal = status === 'OPEN'
        ? { statusText: 'OPEN', statusColors: statusColors.OPEN }
        : { statusText: 'RESOLVED', statusColors: statusColors.RESOLVED };
    return (<StatusChip label={statusVal.statusText} sx={{
            backgroundColor: statusVal.statusColors.bg,
            color: statusVal.statusColors.text,
            '& .MuiSvgIcon-root': {
                color: 'inherit',
                fontSize: '1.2rem',
                margin: '0 -4px 0 2px',
            },
        }}/>);
};
exports.getFollowupStatusChip = getFollowupStatusChip;
var columns = [
    {
        sortable: false,
        field: 'dateTime',
        headerName: 'Date & Time',
        flex: 1,
        valueGetter: function (_a) {
            var period = _a.row.period;
            return (period === null || period === void 0 ? void 0 : period.start) || null;
        },
        renderCell: function (_a) {
            var value = _a.value;
            if (!value)
                return '-';
            return (0, formatDateTime_1.formatISOStringToDateAndTime)(value);
        },
    },
    {
        sortable: false,
        field: 'type',
        headerName: 'Type',
        flex: 1,
        renderCell: function (_a) {
            var type = _a.row.type;
            var typeCoding = type === null || type === void 0 ? void 0 : type.find(function (t) { var _a; return (_a = t.coding) === null || _a === void 0 ? void 0 : _a.find(function (c) { return c.system === utils_1.FOLLOWUP_SYSTEMS.type.url && c.code === utils_1.FOLLOWUP_SYSTEMS.type.code; }); });
            var typeText = '-';
            if (typeCoding === null || typeCoding === void 0 ? void 0 : typeCoding.text) {
                typeText = typeCoding === null || typeCoding === void 0 ? void 0 : typeCoding.text;
            }
            return <material_1.Typography variant="body2">{typeText}</material_1.Typography>;
        },
    },
    {
        sortable: false,
        field: 'reason',
        headerName: 'Reason',
        flex: 1,
        renderCell: function (_a) {
            var reasonCode = _a.row.reasonCode;
            if (!reasonCode) {
                return;
            }
            // const reasonDisplay = encounter.reasonCode ? encounter.reasonCode[0].text : '-';
            return <material_1.Typography variant="body2">{reasonCode[0].text}</material_1.Typography>;
        },
    },
    {
        sortable: false,
        field: 'answered',
        headerName: 'Answered',
        flex: 1,
        renderCell: function (_a) {
            var _b, _c, _d;
            var participant = _a.row.participant;
            var answered = (_d = (_c = (_b = participant === null || participant === void 0 ? void 0 : participant.find(function (p) { var _a; return (_a = p.type) === null || _a === void 0 ? void 0 : _a.find(function (t) { var _a; return (_a = t.coding) === null || _a === void 0 ? void 0 : _a.find(function (c) { return c.system === utils_1.FOLLOWUP_SYSTEMS.answeredUrl; }); }); })) === null || _b === void 0 ? void 0 : _b.type) === null || _c === void 0 ? void 0 : _c[0].coding) === null || _d === void 0 ? void 0 : _d[0].display;
            var answeredText = answered ? answered : '-';
            return <material_1.Typography variant="body2">{answeredText}</material_1.Typography>;
        },
    },
    {
        sortable: false,
        field: 'caller',
        headerName: 'Caller',
        flex: 1,
        renderCell: function (_a) {
            var _b, _c, _d;
            var participant = _a.row.participant;
            var caller = (_d = (_c = (_b = participant === null || participant === void 0 ? void 0 : participant.find(function (p) { var _a; return (_a = p.type) === null || _a === void 0 ? void 0 : _a.find(function (t) { var _a; return (_a = t.coding) === null || _a === void 0 ? void 0 : _a.find(function (c) { return c.system === utils_1.FOLLOWUP_SYSTEMS.callerUrl; }); }); })) === null || _b === void 0 ? void 0 : _b.type) === null || _c === void 0 ? void 0 : _c[0].coding) === null || _d === void 0 ? void 0 : _d[0].display;
            var callerText = caller ? caller : '-';
            return <material_1.Typography variant="body2">{callerText}</material_1.Typography>;
        },
    },
    {
        sortable: false,
        field: 'status',
        headerName: 'Status',
        flex: 0.5,
        renderCell: function (_a) {
            var status = _a.row.status;
            if (!status) {
                return;
            }
            var statusVal = status === 'in-progress' ? 'OPEN' : 'RESOLVED';
            return (0, exports.getFollowupStatusChip)(statusVal);
        },
    },
];
var PatientFollowupEncountersGrid = function (props) {
    var patient = props.patient, loading = props.loading;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var _a = (0, react_1.useState)([]), followupEncounters = _a[0], setFollowupEncounters = _a[1];
    var navigate = (0, react_router_dom_1.useNavigate)();
    (0, react_1.useEffect)(function () {
        function getPatientFollowup(oystehr) {
            return __awaiter(this, void 0, void 0, function () {
                var fhirEncounters, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, oystehr.fhir.search({
                                    resourceType: 'Encounter',
                                    params: [
                                        {
                                            name: '_sort',
                                            value: '-date',
                                        },
                                        {
                                            name: 'subject',
                                            value: "Patient/".concat(patient === null || patient === void 0 ? void 0 : patient.id),
                                        },
                                        {
                                            name: 'type',
                                            value: utils_1.FOLLOWUP_SYSTEMS.type.code,
                                        },
                                    ],
                                })];
                        case 1:
                            fhirEncounters = (_a.sent()).unbundle();
                            setFollowupEncounters(fhirEncounters);
                            return [3 /*break*/, 3];
                        case 2:
                            e_1 = _a.sent();
                            console.error('error loading encounters', e_1);
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            });
        }
        if (oystehr) {
            void getPatientFollowup(oystehr);
        }
    }, [oystehr, patient]);
    var handleRowClick = function (params) {
        navigate("followup/".concat(params.id));
    };
    return (<material_1.Paper sx={{ padding: 3 }} component={material_1.Stack} spacing={2}>
      <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <material_1.Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
          Patient Follow-up
        </material_1.Typography>
        <RoundedButton_1.RoundedButton onClick={function () { return navigate('followup/add'); }} variant="contained" startIcon={<Add_1.default fontSize="small"/>}>
          New Follow-up
        </RoundedButton_1.RoundedButton>
      </material_1.Box>

      <x_data_grid_pro_1.DataGridPro rows={followupEncounters} columns={columns} initialState={{
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
            cursor: 'pointer',
        }} onRowClick={handleRowClick}/>
    </material_1.Paper>);
};
exports.PatientFollowupEncountersGrid = PatientFollowupEncountersGrid;
//# sourceMappingURL=PatientFollowupEncountersGrid.js.map