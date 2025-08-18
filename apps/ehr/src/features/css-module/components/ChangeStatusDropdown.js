"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.ChangeStatusDropdown = void 0;
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var notistack_1 = require("notistack");
var react_1 = require("react");
var utils_1 = require("utils");
var AppointmentTableRow_1 = require("../../../components/AppointmentTableRow");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var inPersonVisitStatusUtils_1 = require("../../../helpers/inPersonVisitStatusUtils");
var useAppClients_1 = require("../../../hooks/useAppClients");
var useEvolveUser_1 = require("../../../hooks/useEvolveUser");
var useAppointment_1 = require("../hooks/useAppointment");
var StyledSelect = (0, system_1.styled)(material_1.Select)(function (_a) {
    var hasDropdown = _a.hasDropdown, arrowColor = _a.arrowColor;
    return (__assign({ height: '32px', borderRadius: '4px', paddingLeft: '12px', paddingRight: '12px', boxShadow: 'none', '& .MuiSelect-select': {
            paddingRight: '32px !important',
        }, '& .MuiOutlinedInput-notchedOutline': {
            border: 'none',
        }, '& .MuiSvgIcon-root': {
            display: 'none',
        } }, (hasDropdown && {
        '&::after': {
            content: '""',
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '10px',
            height: '7px',
            // cSpell:disable-next %3C svg
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='7' viewBox='0 0 10 7' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 6.83317L0 1.83317L1.16667 0.666504L5 4.49984L8.83333 0.666504L10 1.83317L5 6.83317Z' fill='".concat(encodeURIComponent(arrowColor), "'/%3E%3C/svg%3E\")"),
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            pointerEvents: 'none',
        },
    })));
});
var ChangeStatusDropdown = function (_a) {
    var appointmentID = _a.appointmentID, onStatusChange = _a.onStatusChange, getAndSetResources = _a.getAndSetResources;
    var _b = (0, react_1.useState)(false), statusLoading = _b[0], setStatusLoading = _b[1];
    var _c = (0, react_1.useState)(undefined), status = _c[0], setStatus = _c[1];
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var user = (0, useEvolveUser_1.default)();
    var _d = (0, useAppointment_1.useAppointment)(appointmentID), telemedData = _d.visitState, refetch = _d.refetch;
    var appointment = telemedData.appointment, encounter = telemedData.encounter;
    (0, react_1.useEffect)(function () {
        if (!(encounter === null || encounter === void 0 ? void 0 : encounter.id) || !appointment) {
            return;
        }
        var encounterStatus = (0, utils_1.getVisitStatus)(appointment, encounter);
        if (encounterStatus === 'unknown') {
            console.warn('Encounter status is unknown, so not setting a status');
            return;
        }
        setStatus(encounterStatus);
        onStatusChange(encounterStatus);
    }, [appointment, encounter, onStatusChange]);
    if (!user || !(encounter === null || encounter === void 0 ? void 0 : encounter.id) || statusLoading || !status) {
        return (<material_1.Grid item>
        <material_1.Skeleton aria-busy="true" sx={{ marginTop: -1 }} width={120} height={52}/>
      </material_1.Grid>);
    }
    var encounterId = encounter.id;
    var nonDropdownStatuses = ['checked out', 'canceled', 'no show'];
    var hasDropdown = !nonDropdownStatuses.includes(status);
    var updateInPersonVisitStatus = function (event) { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (event.target.value === 'completed') {
                        alert('To mark a visit as completed, scroll to the bottom of the "Progress Note" and click "Review & Sign"');
                        return [2 /*return*/];
                    }
                    setStatusLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, 7, 8]);
                    return [4 /*yield*/, (0, inPersonVisitStatusUtils_1.handleChangeInPersonVisitStatus)({
                            encounterId: encounterId,
                            user: user,
                            updatedStatus: event.target.value,
                        }, oystehrZambda)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, refetch()];
                case 3:
                    _a.sent();
                    if (!getAndSetResources) return [3 /*break*/, 5];
                    return [4 /*yield*/, getAndSetResources({ logs: true }).catch(function (error) {
                            console.log('error getting activity logs after status dropdown update', error);
                            (0, notistack_1.enqueueSnackbar)('An error getting updated activity logs. Please try refreshing the page.', {
                                variant: 'error',
                            });
                        })];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5: return [3 /*break*/, 8];
                case 6:
                    error_1 = _a.sent();
                    console.error(error_1);
                    (0, notistack_1.enqueueSnackbar)('An error occurred. Please try again.', { variant: 'error' });
                    return [3 /*break*/, 8];
                case 7:
                    setStatusLoading(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    return (<material_1.Grid item>
      <div id="user-set-appointment-status">
        <material_1.FormControl size="small">
          <StyledSelect data-testid={data_test_ids_1.dataTestIds.cssHeader.appointmentStatus} id="appointment-status" value={status} {...(hasDropdown ? { hasDropdown: 'true' } : {})} arrowColor={AppointmentTableRow_1.CHIP_STATUS_MAP[status].color.primary} onChange={updateInPersonVisitStatus} sx={{
            border: "1px solid ".concat(AppointmentTableRow_1.CHIP_STATUS_MAP[status].color.primary),
            borderRadius: '7px',
            backgroundColor: AppointmentTableRow_1.CHIP_STATUS_MAP[status].background.primary,
            color: AppointmentTableRow_1.CHIP_STATUS_MAP[status].color.primary,
            '&:hover': {
                backgroundColor: AppointmentTableRow_1.CHIP_STATUS_MAP[status].background.primary,
                filter: 'brightness(0.95)',
            },
        }} MenuProps={{
            PaperProps: {
                sx: {
                    maxHeight: 300,
                    '& .MuiMenuItem-root': {
                        padding: '6px 16px',
                    },
                },
            },
        }}>
            {utils_1.Visit_Status_Array.filter(function (statusTemp) {
            var allHiddenStatuses = __spreadArray([
                'no show',
                'unknown'
            ], ['cancelled', 'intake', 'provider', 'ready for provider', 'discharged'].filter(function (s) { return s !== status; }), true);
            if (status === 'ready for provider' || status === 'intake') {
                allHiddenStatuses = allHiddenStatuses.filter(function (s) { return s !== 'provider'; });
            }
            return !allHiddenStatuses.includes(statusTemp);
        }).map(function (statusTemp) { return (<material_1.MenuItem key={statusTemp} value={statusTemp} sx={{
                backgroundColor: AppointmentTableRow_1.CHIP_STATUS_MAP[statusTemp].background.primary,
                color: AppointmentTableRow_1.CHIP_STATUS_MAP[statusTemp].color.primary,
                '&:hover': {
                    backgroundColor: AppointmentTableRow_1.CHIP_STATUS_MAP[statusTemp].background.primary,
                    filter: 'brightness(0.95)',
                },
                '&.Mui-selected': {
                    backgroundColor: AppointmentTableRow_1.CHIP_STATUS_MAP[statusTemp].background.primary,
                    color: AppointmentTableRow_1.CHIP_STATUS_MAP[statusTemp].color.primary,
                    '&:hover': {
                        backgroundColor: AppointmentTableRow_1.CHIP_STATUS_MAP[statusTemp].background.primary,
                        filter: 'brightness(0.95)',
                    },
                },
            }}>
                {statusTemp}
              </material_1.MenuItem>); })}
          </StyledSelect>
        </material_1.FormControl>
        {statusLoading && <material_1.CircularProgress size="20px" sx={{ marginTop: 2.8, marginLeft: 1 }}/>}
      </div>
    </material_1.Grid>);
};
exports.ChangeStatusDropdown = ChangeStatusDropdown;
//# sourceMappingURL=ChangeStatusDropdown.js.map