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
exports.CHIP_STATUS_MAP = void 0;
exports.getAppointmentStatusChip = getAppointmentStatusChip;
exports.default = AppointmentTableRow;
var icons_1 = require("@ehrTheme/icons");
var ChatOutlined_1 = require("@mui/icons-material/ChatOutlined");
var InfoOutlined_1 = require("@mui/icons-material/InfoOutlined");
var Logout_1 = require("@mui/icons-material/Logout");
var MedicalInformationOutlined_1 = require("@mui/icons-material/MedicalInformationOutlined");
var PriorityHighRounded_1 = require("@mui/icons-material/PriorityHighRounded");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var colors_1 = require("src/themes/ottehr/colors");
var utils_1 = require("utils");
var data_test_ids_1 = require("../constants/data-test-ids");
var ChatModal_1 = require("../features/chat/ChatModal");
var helpers_1 = require("../helpers");
var formatDateTime_1 = require("../helpers/formatDateTime");
var formatPatientName_1 = require("../helpers/formatPatientName");
var getOfficePhoneNumber_1 = require("../helpers/getOfficePhoneNumber");
var inPersonVisitStatusUtils_1 = require("../helpers/inPersonVisitStatusUtils");
var useAppClients_1 = require("../hooks/useAppClients");
var useEvolveUser_1 = require("../hooks/useEvolveUser");
var AppointmentNote_1 = require("./AppointmentNote");
var AppointmentTableRowMobile_1 = require("./AppointmentTableRowMobile");
var AppointmentTabs_1 = require("./AppointmentTabs");
var GenericToolTip_1 = require("./GenericToolTip");
var GoToButton_1 = require("./GoToButton");
var InfoIconsToolTip_1 = require("./InfoIconsToolTip");
var PatientDateOfBirth_1 = require("./PatientDateOfBirth");
var PriorityIconWithBorder_1 = require("./PriorityIconWithBorder");
var ReasonForVisit_1 = require("./ReasonForVisit");
var VITE_APP_QRS_URL = import.meta.env.VITE_APP_QRS_URL;
function getAppointmentStatusChip(status, count) {
    if (!status) {
        return <span>todo1</span>;
    }
    if (!exports.CHIP_STATUS_MAP[status]) {
        return <span>todo2</span>;
    }
    return (<span data-testid={data_test_ids_1.dataTestIds.dashboard.appointmentStatus} style={{
            fontSize: '12px',
            borderRadius: '4px',
            border: "".concat(['pending', 'checked out'].includes(status) ? '1px solid #BFC2C6' : 'none'),
            textTransform: 'uppercase',
            background: exports.CHIP_STATUS_MAP[status].background.primary,
            color: exports.CHIP_STATUS_MAP[status].color.primary,
            display: 'inline-block',
            padding: '2px 8px 0 8px',
            verticalAlign: 'middle',
        }}>
      {count ? "".concat(status, " - ").concat(count) : status}
    </span>);
}
exports.CHIP_STATUS_MAP = {
    pending: {
        background: {
            primary: '#FFFFFF',
        },
        color: {
            primary: '#546E7A',
        },
    },
    arrived: {
        background: {
            primary: '#ECEFF1',
            secondary: '#9E9E9E',
        },
        color: {
            primary: '#37474F',
        },
    },
    ready: {
        background: {
            primary: '#C8E6C9',
            secondary: '#43A047',
        },
        color: {
            primary: '#1B5E20',
        },
    },
    intake: {
        background: {
            primary: '#e0b6fc',
        },
        color: {
            primary: '#412654',
        },
    },
    'ready for provider': {
        background: {
            primary: '#D1C4E9',
            secondary: '#673AB7',
        },
        color: {
            primary: '#311B92',
        },
    },
    provider: {
        background: {
            primary: '#B3E5FC',
        },
        color: {
            primary: '#01579B',
        },
    },
    discharged: {
        background: {
            primary: '#B2EBF2',
        },
        color: {
            primary: '#006064',
        },
    },
    completed: {
        background: {
            primary: '#FFFFFF',
        },
        color: {
            primary: '#546E7A',
        },
    },
    cancelled: {
        background: {
            primary: '#FECDD2',
        },
        color: {
            primary: '#B71C1C',
        },
    },
    'no show': {
        background: {
            primary: '#DFE5E9',
        },
        color: {
            primary: '#212121',
        },
    },
    unknown: {
        background: {
            primary: '#FFFFFF',
        },
        color: {
            primary: '#000000',
        },
    },
};
var linkStyle = {
    display: 'contents',
    color: colors_1.otherColors.tableRow,
};
var longWaitTimeFlag = function (appointment, statusTime) {
    if (appointment.status === 'ready for provider' ||
        appointment.status === 'intake' ||
        (appointment.status === 'ready' && appointment.appointmentType !== 'walk-in')) {
        if (statusTime > 45) {
            return true;
        }
    }
    return false;
};
function AppointmentTableRow(_a) {
    var _this = this;
    var _b, _c, _d, _e, _f, _g, _h, _j;
    var appointment = _a.appointment, location = _a.location, actionButtons = _a.actionButtons, showTime = _a.showTime, now = _a.now, tab = _a.tab, updateAppointments = _a.updateAppointments, setEditingComment = _a.setEditingComment, orders = _a.orders;
    var _k = (0, useAppClients_1.useApiClients)(), oystehr = _k.oystehr, oystehrZambda = _k.oystehrZambda;
    var theme = (0, material_1.useTheme)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var encounter = appointment.encounter;
    var _l = (0, react_1.useState)(''), statusTime = _l[0], setStatusTime = _l[1];
    var _m = (0, react_1.useState)(false), arrivedStatusSaving = _m[0], setArrivedStatusSaving = _m[1];
    var _o = (0, react_1.useState)(appointment.room || ''), room = _o[0], setRoom = _o[1];
    var _p = (0, react_1.useState)(false), roomSaving = _p[0], setRoomSaving = _p[1];
    var _q = (0, react_1.useState)(false), chatModalOpen = _q[0], setChatModalOpen = _q[1];
    var _r = (0, react_1.useState)(((_b = appointment.smsModel) === null || _b === void 0 ? void 0 : _b.hasUnreadMessages) || false), hasUnread = _r[0], setHasUnread = _r[1];
    var user = (0, useEvolveUser_1.default)();
    if (!user) {
        throw new Error('User is not defined');
    }
    if (!encounter || !encounter.id) {
        throw new Error('Encounter is not defined');
    }
    var encounterId = encounter.id;
    var _s = (0, react_1.useState)(false), startIntakeButtonLoading = _s[0], setStartIntakeButtonLoading = _s[1];
    var _t = (0, react_1.useState)(false), progressNoteButtonLoading = _t[0], setProgressNoteButtonLoading = _t[1];
    var _u = (0, react_1.useState)(false), dischargeButtonLoading = _u[0], setDischargeButtonLoading = _u[1];
    var rooms = (0, react_1.useMemo)(function () {
        var _a;
        return (_a = location === null || location === void 0 ? void 0 : location.extension) === null || _a === void 0 ? void 0 : _a.filter(function (ext) { return ext.url === utils_1.ROOM_EXTENSION_URL; }).map(function (ext) { return ext.valueString; });
    }, [location]);
    var officePhoneNumber = (0, getOfficePhoneNumber_1.getOfficePhoneNumber)(location);
    var patientName = (appointment.patient.lastName &&
        appointment.patient.firstName &&
        (0, formatPatientName_1.formatPatientName)({
            firstName: appointment.patient.firstName,
            lastName: appointment.patient.lastName,
            middleName: appointment.patient.middleName,
        })) ||
        'Unknown';
    var start;
    if (appointment.start) {
        var locationTimeZone = (0, formatDateTime_1.getTimezone)(location);
        var dateTime = luxon_1.DateTime.fromISO(appointment.start).setZone(locationTimeZone);
        start = dateTime.toFormat('h:mm a');
    }
    var showChatIcon = appointment.smsModel !== undefined;
    // console.log('sms model', appointment.smsModel);
    var isMobile = (0, material_1.useMediaQuery)(theme.breakpoints.down('sm'));
    (0, react_1.useEffect)(function () {
        var _a;
        setHasUnread(((_a = appointment.smsModel) === null || _a === void 0 ? void 0 : _a.hasUnreadMessages) || false);
    }, [(_c = appointment.smsModel) === null || _c === void 0 ? void 0 : _c.hasUnreadMessages]);
    var handleArrivedClick = function (_event) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('error getting fhir client');
                    }
                    if (!appointment.id) {
                        throw new Error('error getting appointment id');
                    }
                    setArrivedStatusSaving(true);
                    return [4 /*yield*/, (0, helpers_1.checkInPatient)(oystehr, appointment.id, appointment.encounterId, user)];
                case 1:
                    _a.sent();
                    setArrivedStatusSaving(false);
                    return [4 /*yield*/, updateAppointments()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var changeRoom = function (room) { return __awaiter(_this, void 0, void 0, function () {
        var appointmentToUpdate, patchOp, extension;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!oystehr) {
                        throw new Error('error getting fhir client');
                    }
                    if (!appointment.id) {
                        throw new Error('error getting appointment id');
                    }
                    setRoomSaving(true);
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Appointment',
                            id: appointment.id,
                        })];
                case 1:
                    appointmentToUpdate = _b.sent();
                    if (!room) {
                        extension = (appointmentToUpdate.extension || []).filter(function (ext) { return ext.url !== utils_1.ROOM_EXTENSION_URL; });
                        if ((extension === null || extension === void 0 ? void 0 : extension.length) === 0) {
                            patchOp = {
                                op: 'remove',
                                path: '/extension',
                            };
                        }
                        else {
                            patchOp = {
                                op: 'replace',
                                path: '/extension',
                                value: extension,
                            };
                        }
                    }
                    else {
                        if ((_a = appointmentToUpdate.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.ROOM_EXTENSION_URL; })) {
                            patchOp = {
                                op: 'replace',
                                path: '/extension',
                                value: appointmentToUpdate.extension.map(function (ext) {
                                    if (ext.url === utils_1.ROOM_EXTENSION_URL) {
                                        return { url: utils_1.ROOM_EXTENSION_URL, valueString: room };
                                    }
                                    return ext;
                                }),
                            };
                        }
                        else {
                            if ((appointmentToUpdate.extension || []).length === 0) {
                                patchOp = {
                                    op: 'add',
                                    path: '/extension',
                                    value: [{ url: utils_1.ROOM_EXTENSION_URL, valueString: room }],
                                };
                            }
                            else {
                                patchOp = {
                                    op: 'replace',
                                    path: '/extension',
                                    value: __spreadArray(__spreadArray([], (appointmentToUpdate.extension || []), true), [{ url: utils_1.ROOM_EXTENSION_URL, valueString: room }], false),
                                };
                            }
                        }
                    }
                    return [4 /*yield*/, oystehr.fhir.batch({
                            requests: [
                                (0, utils_1.getPatchBinary)({ resourceId: appointment.id, resourceType: 'Appointment', patchOperations: [patchOp] }),
                            ],
                        })];
                case 2:
                    _b.sent();
                    setRoomSaving(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var recentStatus = appointment === null || appointment === void 0 ? void 0 : appointment.visitStatusHistory[appointment.visitStatusHistory.length - 1];
    var _v = (0, react_1.useMemo)(function () {
        var totalMinutes = (0, utils_1.getVisitTotalTime)(appointment, appointment.visitStatusHistory, now);
        var waitingMinutesEstimate = appointment === null || appointment === void 0 ? void 0 : appointment.waitingMinutes;
        return { totalMinutes: totalMinutes, waitingMinutesEstimate: waitingMinutesEstimate };
    }, [appointment, now]), totalMinutes = _v.totalMinutes, waitingMinutesEstimate = _v.waitingMinutesEstimate;
    if (recentStatus && recentStatus.period) {
        var currentStatusTime = (0, utils_1.getDurationOfStatus)(recentStatus, now);
        var statusTimeTemp = tab === AppointmentTabs_1.ApptTab.cancelled || tab === AppointmentTabs_1.ApptTab.completed || recentStatus.status === 'discharged'
            ? "".concat((0, utils_1.formatMinutes)(totalMinutes), "m")
            : "".concat((0, utils_1.formatMinutes)(currentStatusTime), "m");
        if (tab !== AppointmentTabs_1.ApptTab.cancelled &&
            tab !== AppointmentTabs_1.ApptTab.completed &&
            statusTimeTemp !== "".concat((0, utils_1.formatMinutes)(totalMinutes), "m") &&
            recentStatus.status !== 'discharged' &&
            appointment.visitStatusHistory &&
            (appointment === null || appointment === void 0 ? void 0 : appointment.visitStatusHistory.length) > 1) {
            statusTimeTemp += " / ".concat((0, utils_1.formatMinutes)(totalMinutes), "m");
        }
        if (statusTimeTemp !== statusTime) {
            setStatusTime(statusTimeTemp);
        }
    }
    var patientDateOfBirth = appointment.needsDOBConfirmation
        ? appointment.unconfirmedDOB
        : (_d = appointment.patient) === null || _d === void 0 ? void 0 : _d.dateOfBirth;
    var isLongWaitingTime = (0, react_1.useMemo)(function () {
        return longWaitTimeFlag(appointment, parseInt(statusTime) || 0);
    }, [appointment, statusTime]);
    var formattedPriorityHighIcon = (<PriorityHighRounded_1.default style={{
            height: '14px',
            width: '14px',
            padding: '2px',
            color: theme.palette.primary.contrastText,
            backgroundColor: colors_1.otherColors.priorityHighIcon,
            borderRadius: '4px',
            marginRight: '4px',
        }}/>);
    var longWaitFlag = (<material_1.Box sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
        }}>
      <PriorityIconWithBorder_1.PriorityIconWithBorder fill={theme.palette.warning.main}/>
      <material_1.Typography variant="body2" color={theme.palette.getContrastText(theme.palette.background.default)} style={{ display: 'inline', fontWeight: 500 }}>
        Long wait: Please check on patient
      </material_1.Typography>
    </material_1.Box>);
    var timeToolTip = (<material_1.Grid container sx={{ width: '100%' }}>
      <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
        }}>
        {isLongWaitingTime && longWaitFlag}
        {(_e = appointment === null || appointment === void 0 ? void 0 : appointment.visitStatusHistory) === null || _e === void 0 ? void 0 : _e.map(function (statusTemp, index) {
            return (<material_1.Box key={index} sx={{ display: 'flex', gap: 1 }}>
              <material_1.Typography variant="body2" color={theme.palette.getContrastText(theme.palette.background.default)} style={{ display: 'inline', marginTop: 1 }}>
                {(0, utils_1.formatMinutes)((0, utils_1.getDurationOfStatus)(statusTemp, now))} mins
              </material_1.Typography>
              {getAppointmentStatusChip(statusTemp.status)}
            </material_1.Box>);
        })}

        <material_1.Typography variant="body2" color={theme.palette.getContrastText(theme.palette.background.default)} style={{ display: 'inline', fontWeight: 500 }}>
          Total LOS: {(0, utils_1.formatMinutes)(totalMinutes)} mins
        </material_1.Typography>
        <material_1.Typography variant="body2" color={theme.palette.getContrastText(theme.palette.background.default)} style={{ display: 'inline', fontWeight: 500 }} sx={{ whiteSpace: { md: 'nowrap', sm: 'normal' } }}>
          Estimated wait time at check-in:
          {waitingMinutesEstimate !== undefined
            ? " ".concat((0, utils_1.formatMinutes)(Math.floor(waitingMinutesEstimate / 5) * 5), " mins")
            : ''}
          {/* previous waiting minutes logic
        {waitingMinutesEstimate
          ? ` ${formatMinutes(waitingMinutesEstimate)} - ${formatMinutes(waitingMinutesEstimate + 15)} mins`
          : ''} */}
        </material_1.Typography>
      </material_1.Box>
    </material_1.Grid>);
    var statusTimeEl = (<>
      <material_1.Grid item>{isLongWaitingTime && <PriorityIconWithBorder_1.PriorityIconWithBorder fill={theme.palette.warning.main}/>}</material_1.Grid>
      <material_1.Grid item sx={{ display: 'flex', alignItems: 'center' }}>
        <material_1.Typography variant="body1" sx={{ display: 'inline', fontWeight: "".concat(isLongWaitingTime ? '700' : '') }}>
          {statusTime}
        </material_1.Typography>
        {appointment.visitStatusHistory && appointment.visitStatusHistory.length > 1 && (<span style={{ color: 'rgba(0, 0, 0, 0.6)', display: 'flex', alignItems: 'center' }}>
            <InfoOutlined_1.default style={{
                height: '20px',
                width: '20px',
                padding: '2px',
                borderRadius: '4px',
                marginLeft: '2px',
                marginTop: '1px',
            }}/>
          </span>)}
      </material_1.Grid>
    </>);
    var quickTexts = (0, react_1.useMemo)(function () {
        return [
            // todo need to make url dynamic or pull from location
            {
                english: "Please complete the paperwork and sign consent forms to avoid a delay in check-in. For ".concat(appointment.patient.firstName, ", click here: ").concat(VITE_APP_QRS_URL, "/visit/").concat(appointment.id),
                // cSpell:disable-next Spanish
                spanish: "Complete la documentaci\u00F3n y firme los formularios de consentimiento para evitar demoras en el registro. Para ".concat(appointment.patient.firstName, ", haga clic aqu\u00ED: ").concat(VITE_APP_QRS_URL, "/visit/").concat(appointment.id),
            },
            {
                english: 'To prevent any delays with your pre-booked visit, please complete the digital paperwork fully in our new system.',
                spanish: 
                // cSpell:disable-next Spanish
                'Para evitar demoras en su visita preprogramada, complete toda la documentación digital en nuestro nuevo sistema.',
            },
            {
                english: 'We are now ready to check you in. Please head to the front desk to complete the process.',
                // cSpell:disable-next Spanish
                spanish: 'Ahora estamos listos para registrarlo. Diríjase a la recepción para completar el proceso.',
            },
            {
                english: 'We are ready for the patient to be seen, please enter the facility.',
                // cSpell:disable-next Spanish
                spanish: 'Estamos listos para atender al paciente; ingrese al centro.',
            },
            {
                english: "".concat(utils_1.PROJECT_NAME, " is trying to get ahold of you. Please call us at ").concat(officePhoneNumber, " or respond to this text message."),
                // cSpell:disable-next Spanish
                spanish: "".concat(utils_1.PROJECT_NAME, " est\u00E1 intentando comunicarse con usted. Ll\u00E1menos al ").concat(officePhoneNumber, " o responda a este mensaje de texto."),
            },
            {
                english: "".concat(utils_1.PROJECT_NAME, " hopes you are feeling better. Please call us with any questions at ").concat(officePhoneNumber, "."),
                // cSpell:disable-next Spanish
                spanish: "".concat(utils_1.PROJECT_NAME, " espera que se sienta mejor. Ll\u00E1menos si tiene alguna pregunta al ").concat(officePhoneNumber, "."),
            },
        ];
    }, [appointment.id, appointment.patient.firstName, officePhoneNumber]);
    var onCloseChat = (0, react_1.useCallback)(function () {
        setChatModalOpen(false);
    }, [setChatModalOpen]);
    var onMarkAllRead = (0, react_1.useCallback)(function () {
        setHasUnread(false);
    }, [setHasUnread]);
    if (isMobile) {
        return (<AppointmentTableRowMobile_1.default appointment={appointment} patientName={patientName} start={start} tab={tab} formattedPriorityHighIcon={formattedPriorityHighIcon} statusTime={statusTime} statusChip={getAppointmentStatusChip(appointment.status)} isLongWaitingTime={isLongWaitingTime} patientDateOfBirth={patientDateOfBirth} statusTimeEl={showTime ? statusTimeEl : undefined} linkStyle={linkStyle} timeToolTip={timeToolTip}/>);
    }
    var handleStartIntakeButton = function () { return __awaiter(_this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setStartIntakeButtonLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, inPersonVisitStatusUtils_1.handleChangeInPersonVisitStatus)({
                            encounterId: encounterId,
                            user: user,
                            updatedStatus: 'intake',
                        }, oystehrZambda)];
                case 2:
                    _a.sent();
                    navigate("/in-person/".concat(appointment.id, "/patient-info"));
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error(error_1);
                    (0, notistack_1.enqueueSnackbar)('An error occurred. Please try again.', { variant: 'error' });
                    return [3 /*break*/, 4];
                case 4:
                    setStartIntakeButtonLoading(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var renderStartIntakeButton = function () {
        if (appointment.status === 'arrived' || appointment.status === 'ready' || appointment.status === 'intake') {
            return (<GoToButton_1.default text="Start Intake" loading={startIntakeButtonLoading} onClick={handleStartIntakeButton} dataTestId={data_test_ids_1.dataTestIds.dashboard.intakeButton}>
          <img src={icons_1.startIntakeIcon}/>
        </GoToButton_1.default>);
        }
        return undefined;
    };
    var handleProgressNoteButton = function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            setProgressNoteButtonLoading(true);
            try {
                navigate("/in-person/".concat(appointment.id));
            }
            catch (error) {
                console.error(error);
                (0, notistack_1.enqueueSnackbar)('An error occurred. Please try again.', { variant: 'error' });
            }
            setProgressNoteButtonLoading(false);
            return [2 /*return*/];
        });
    }); };
    var renderProgressNoteButton = function () {
        if (appointment.status === 'ready for provider' ||
            appointment.status === 'provider' ||
            appointment.status === 'completed' ||
            appointment.status === 'discharged') {
            return (<GoToButton_1.default text="Progress Note" loading={progressNoteButtonLoading} onClick={handleProgressNoteButton} dataTestId={data_test_ids_1.dataTestIds.dashboard.progressNoteButton}>
          <img src={icons_1.progressNoteIcon}/>
        </GoToButton_1.default>);
        }
        return undefined;
    };
    var handleDischargeButton = function () { return __awaiter(_this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setDischargeButtonLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, (0, inPersonVisitStatusUtils_1.handleChangeInPersonVisitStatus)({
                            encounterId: encounterId,
                            user: user,
                            updatedStatus: 'discharged',
                        }, oystehrZambda)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, updateAppointments()];
                case 3:
                    _a.sent();
                    (0, notistack_1.enqueueSnackbar)('Patient discharged successfully', { variant: 'success' });
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    console.error(error_2);
                    (0, notistack_1.enqueueSnackbar)('An error occurred. Please try again.', { variant: 'error' });
                    return [3 /*break*/, 5];
                case 5:
                    setDischargeButtonLoading(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var renderDischargeButton = function () {
        if (appointment.status === 'provider') {
            return (<GoToButton_1.default loading={dischargeButtonLoading} text="Discharge" onClick={handleDischargeButton} dataTestId={data_test_ids_1.dataTestIds.dashboard.dischargeButton}>
          <Logout_1.default />
        </GoToButton_1.default>);
        }
        return undefined;
    };
    // there are two different tooltips that are show on the tracking board depending which tab/section you are on
    // 1. visit components on prebooked, in-office/waiting and cancelled
    // 2. orders on in-office/in-exam and discharged
    // this bool determines what style mouse should show on hover for the cells that hold these tooltips
    // if orders tooltip is displayed, we check if there are any orders - if no orders the cell will be empty and it doesn't make sense to have the pointer hand
    // if visit components, there is always something in this cell, hence the default to true
    var showPointerForInfoIcons = (0, helpers_1.displayOrdersToolTip)(appointment, tab) ? (0, helpers_1.hasAtLeastOneOrder)(orders) : true;
    return (<material_1.TableRow id="appointments-table-row" data-testid={data_test_ids_1.dataTestIds.dashboard.tableRowWrapper(appointment.id)} sx={__assign({ '&:last-child td, &:last-child th': { border: 0 }, '& .MuiTableCell-root': { p: '8px' }, position: 'relative' }, (appointment.next && {
            // borderTop: '2px solid #43A047',
            boxShadow: "inset 0 0 0 1px ".concat(exports.CHIP_STATUS_MAP[appointment.status].background.secondary),
        }))}>
      <material_1.TableCell sx={{ verticalAlign: 'center', position: 'relative' }}>
        {appointment.next && (<material_1.Box sx={{
                backgroundColor: exports.CHIP_STATUS_MAP[appointment.status].background.secondary,
                position: 'absolute',
                width: '22px',
                bottom: 0,
                left: '0',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
            <material_1.Typography variant="body1" fontSize={14} sx={{
                writingMode: 'vertical-lr',
                transform: 'scale(-1)',
                color: theme.palette.background.paper,
            }}>
              NEXT
            </material_1.Typography>
          </material_1.Box>)}
      </material_1.TableCell>
      <material_1.TableCell sx={{ padding: '8px 8px 8px 23px !important' }} data-testid={data_test_ids_1.dataTestIds.dashboard.tableRowStatus(appointment.id)}>
        <material_1.Typography variant="body1">
          {material_1.capitalize === null || material_1.capitalize === void 0 ? void 0 : (0, material_1.capitalize)(appointment.appointmentType === 'post-telemed'
            ? 'Post Telemed'
            : (appointment.appointmentType || '').toString())}
        </material_1.Typography>
        <material_1.Typography variant="body1">
          <strong>{start}</strong>
        </material_1.Typography>
        {tab !== AppointmentTabs_1.ApptTab.prebooked && <material_1.Box mt={1}>{getAppointmentStatusChip(appointment.status)}</material_1.Box>}
      </material_1.TableCell>
      {/* placeholder until time stamps for waiting and in exam or something comparable are made */}
      {/* <TableCell sx={{ verticalAlign: 'top' }}><Typography variant="body1" aria-owns={hoverElement ? 'status-popover' : undefined} aria-haspopup='true' sx={{ verticalAlign: 'top' }} onMouseOver={(event) => setHoverElement(event.currentTarget)} onMouseLeave={() => setHoverElement(undefined)}>{statusTime}</Typography></TableCell>
            <Popover id='status-popover' open={hoverElement !== undefined} anchorEl={hoverElement} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'right' }} onClose={() => setHoverElement(undefined)}><Typography>test</Typography></Popover> */}
      {showTime && (<material_1.TableCell sx={{ verticalAlign: 'center' }}>
          <material_1.Tooltip componentsProps={{
                tooltip: {
                    sx: {
                        width: 'auto',
                        maxWidth: 'none',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        padding: 2,
                        backgroundColor: theme.palette.background.default,
                        boxShadow: '0px 1px 8px 0px rgba(0, 0, 0, 0.12), 0px 3px 4px 0px rgba(0, 0, 0, 0.14), 0px 3px 3px -2px rgba(0, 0, 0, 0.20)',
                        '& .MuiTooltip-arrow': { color: theme.palette.background.default },
                    },
                },
            }} title={timeToolTip} placement="top" arrow>
            <material_1.Grid sx={{ display: 'flex', alignItems: 'center', marginTop: '8px' }} gap={1}>
              {statusTimeEl}
            </material_1.Grid>
          </material_1.Tooltip>
        </material_1.TableCell>)}
      <material_1.TableCell sx={{ verticalAlign: 'center', wordWrap: 'break-word' }}>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <react_router_dom_1.Link to={"/patient/".concat(appointment.patient.id)} style={{ textDecoration: 'none' }} data-testId={data_test_ids_1.dataTestIds.dashboard.patientName}>
            <material_1.Typography variant="subtitle2" sx={{ fontSize: '16px', color: '#000' }}>
              {patientName}
            </material_1.Typography>
          </react_router_dom_1.Link>
          {appointment.needsDOBConfirmation ? (<GenericToolTip_1.GenericToolTip title="Date of birth for returning patient was not confirmed" customWidth="170px">
              <material_1.Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'nowrap' }}>
                <material_1.Typography variant="body2" sx={{ color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>{"".concat(((_f = appointment.patient) === null || _f === void 0 ? void 0 : _f.sex) && (0, material_1.capitalize)((_g = appointment.patient) === null || _g === void 0 ? void 0 : _g.sex), " | ")}</material_1.Typography>
                <material_1.Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                  <PatientDateOfBirth_1.PatientDateOfBirth dateOfBirth={patientDateOfBirth}/>
                  {appointment.needsDOBConfirmation && <PriorityIconWithBorder_1.PriorityIconWithBorder fill={theme.palette.warning.main}/>}
                </material_1.Box>
              </material_1.Box>
            </GenericToolTip_1.GenericToolTip>) : (<material_1.Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'nowrap' }}>
              <material_1.Typography sx={{ color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>{"".concat(((_h = appointment.patient) === null || _h === void 0 ? void 0 : _h.sex) && (0, material_1.capitalize)((_j = appointment.patient) === null || _j === void 0 ? void 0 : _j.sex), " |")}</material_1.Typography>
              <PatientDateOfBirth_1.PatientDateOfBirth dateOfBirth={patientDateOfBirth}/>
            </material_1.Box>)}
          <ReasonForVisit_1.default reasonsForVisit={appointment.reasonForVisit} tab={tab} formattedPriorityHighIcon={formattedPriorityHighIcon} lineMax={2}></ReasonForVisit_1.default>
        </material_1.Box>
      </material_1.TableCell>
      {(tab === AppointmentTabs_1.ApptTab['in-office'] || tab === AppointmentTabs_1.ApptTab.completed) && (<material_1.TableCell sx={{
                verticalAlign: 'center',
            }}>
          {tab === AppointmentTabs_1.ApptTab['in-office'] ? (rooms &&
                rooms.length > 0 && (<material_1.TextField select fullWidth variant="standard" disabled={roomSaving} value={room} onChange={function (e) {
                    setRoom(e.target.value);
                    void changeRoom(e.target.value);
                }}>
                <material_1.MenuItem value={''}>None</material_1.MenuItem>
                {rooms === null || rooms === void 0 ? void 0 : rooms.map(function (room) { return (<material_1.MenuItem key={room} value={room}>
                    {room}
                  </material_1.MenuItem>); })}
              </material_1.TextField>)) : (<material_1.Typography sx={{ fontSize: 14, display: 'inline' }}>{room}</material_1.Typography>)}
        </material_1.TableCell>)}
      <material_1.TableCell sx={{ verticalAlign: 'center' }}>
        <material_1.Typography sx={{ fontSize: 14, display: 'inline' }}>{appointment.provider}</material_1.Typography>
      </material_1.TableCell>
      <material_1.TableCell sx={{
            verticalAlign: 'center',
            cursor: "".concat(showPointerForInfoIcons ? 'pointer' : 'auto'),
        }}>
        <InfoIconsToolTip_1.InfoIconsToolTip appointment={appointment} tab={tab} orders={orders}/>
      </material_1.TableCell>
      <material_1.TableCell sx={{ verticalAlign: 'center' }}>
        <AppointmentNote_1.default appointment={appointment} oystehr={oystehr} user={user} updateAppointments={updateAppointments} setEditingComment={setEditingComment}></AppointmentNote_1.default>
      </material_1.TableCell>
      <material_1.TableCell sx={{ verticalAlign: 'center' }}>
        {showChatIcon && (<material_1.IconButton sx={{
                backgroundColor: theme.palette.primary.main,
                width: '36px',
                height: '36px',
                borderRadius: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                '&:hover': {
                    backgroundColor: theme.palette.primary.main,
                },
            }} onClick={function (_event) {
                setChatModalOpen(true);
            }} aria-label={hasUnread ? 'unread messages chat icon' : 'chat icon, no unread messages'}>
            {/* todo reduce code duplication */}
            {hasUnread ? (<material_1.Badge variant="dot" color="warning" sx={{
                    '& .MuiBadge-badge': {
                        width: '14px',
                        height: '14px',
                        borderRadius: '10px',
                        border: '2px solid white',
                        top: '-4px',
                        right: '-4px',
                    },
                }}>
                <ChatOutlined_1.default sx={{
                    color: theme.palette.primary.contrastText,
                    height: '20px',
                    width: '20px',
                }}></ChatOutlined_1.default>
              </material_1.Badge>) : (<ChatOutlined_1.default sx={{
                    color: theme.palette.primary.contrastText,
                    height: '20px',
                    width: '20px',
                }}></ChatOutlined_1.default>)}
          </material_1.IconButton>)}
      </material_1.TableCell>
      <material_1.TableCell sx={{ verticalAlign: 'center' }}>
        <material_1.Stack direction={'row'} spacing={1}>
          <GoToButton_1.default text="Visit Details" onClick={function () { return navigate("/visit/".concat(appointment.id)); }} dataTestId={data_test_ids_1.dataTestIds.dashboard.visitDetailsButton}>
            <MedicalInformationOutlined_1.default />
          </GoToButton_1.default>
          {renderStartIntakeButton()}
          {renderProgressNoteButton()}
          {renderDischargeButton()}
        </material_1.Stack>
      </material_1.TableCell>
      {actionButtons && (<material_1.TableCell sx={{ verticalAlign: 'center' }}>
          <lab_1.LoadingButton data-testid={data_test_ids_1.dataTestIds.dashboard.arrivedButton} onClick={handleArrivedClick} loading={arrivedStatusSaving} variant="contained" sx={{
                borderRadius: 8,
                textTransform: 'none',
                fontSize: '15px',
                fontWeight: 500,
            }}>
            Arrived
          </lab_1.LoadingButton>
        </material_1.TableCell>)}
      {chatModalOpen && (<ChatModal_1.default appointment={appointment} currentLocation={location} onClose={onCloseChat} onMarkAllRead={onMarkAllRead} quickTexts={quickTexts}/>)}
    </material_1.TableRow>);
}
//# sourceMappingURL=AppointmentTableRow.js.map