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
exports.TrackingBoardTableRowSkeleton = void 0;
exports.TrackingBoardTableRow = TrackingBoardTableRow;
// cSpell:ignore Español
var colors_1 = require("@ehrTheme/colors");
var ChatOutlined_1 = require("@mui/icons-material/ChatOutlined");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var ChatModal_1 = require("../../../features/chat/ChatModal");
var formatDateTime_1 = require("../../../helpers/formatDateTime");
var components_1 = require("../../components");
var utils_2 = require("../../utils");
var TrackingBoardTableButton_1 = require("./TrackingBoardTableButton");
function TrackingBoardTableRow(_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    var appointment = _a.appointment, showProvider = _a.showProvider, next = _a.next;
    var theme = (0, material_1.useTheme)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _m = (0, react_1.useState)(false), chatModalOpen = _m[0], setChatModalOpen = _m[1];
    var _o = (0, react_1.useState)(((_b = appointment === null || appointment === void 0 ? void 0 : appointment.smsModel) === null || _b === void 0 ? void 0 : _b.hasUnreadMessages) || false), hasUnread = _o[0], setHasUnread = _o[1];
    var patientName = [(_c = appointment === null || appointment === void 0 ? void 0 : appointment.patient) === null || _c === void 0 ? void 0 : _c.lastName, (_d = appointment === null || appointment === void 0 ? void 0 : appointment.patient) === null || _d === void 0 ? void 0 : _d.firstName].filter(Boolean).join(', ') || 'Unknown';
    var practitionerFamilyName = (_g = (_f = (_e = appointment === null || appointment === void 0 ? void 0 : appointment.practitioner) === null || _e === void 0 ? void 0 : _e.name) === null || _f === void 0 ? void 0 : _f.at(0)) === null || _g === void 0 ? void 0 : _g.family;
    var displayedPractitionerName = practitionerFamilyName ? "Dr. ".concat(practitionerFamilyName) : '';
    var showChatIcon = (appointment === null || appointment === void 0 ? void 0 : appointment.smsModel) !== undefined;
    var patientInfo = (0, react_1.useMemo)(function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        var dob = (0, formatDateTime_1.formatDateUsingSlashes)((_a = appointment === null || appointment === void 0 ? void 0 : appointment.patient) === null || _a === void 0 ? void 0 : _a.dateOfBirth);
        var age = (0, utils_1.calculatePatientAge)((_b = appointment === null || appointment === void 0 ? void 0 : appointment.patient) === null || _b === void 0 ? void 0 : _b.dateOfBirth);
        var sex = (_e = (_d = (_c = appointment === null || appointment === void 0 ? void 0 : appointment.patient) === null || _c === void 0 ? void 0 : _c.sex) === null || _d === void 0 ? void 0 : _d.replace) === null || _e === void 0 ? void 0 : _e.call(_d, /^[a-z]/i, function (str) { return str.toUpperCase(); });
        var dobAge = dob && age && "DOB: ".concat(dob, " (").concat(age, ")");
        var parsedAnswers = {};
        var isParentGuardian = ((_j = (_h = (_g = (_f = appointment === null || appointment === void 0 ? void 0 : appointment.paperwork) === null || _f === void 0 ? void 0 : _f.item) === null || _g === void 0 ? void 0 : _g.find(function (item) { return item.linkId === 'patient-filling-out-as'; })) === null || _h === void 0 ? void 0 : _h.answer) === null || _j === void 0 ? void 0 : _j[0].valueString) === 'Parent/Guardian';
        var _p = (_o = (_m = (_l = (_k = appointment === null || appointment === void 0 ? void 0 : appointment.paperwork) === null || _k === void 0 ? void 0 : _k.item) === null || _l === void 0 ? void 0 : _l.reduce) === null || _m === void 0 ? void 0 : _m.call(_l, function (acc, val) {
            var _a, _b, _c, _d, _e;
            if (!(val === null || val === void 0 ? void 0 : val.linkId) || typeof ((_b = (_a = val === null || val === void 0 ? void 0 : val.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueString) !== 'string') {
                return acc;
            }
            var linkId = val.linkId;
            var answer = (_d = (_c = val.answer) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.valueString;
            if (isParentGuardian && linkId === 'guardian-number') {
                acc.phone = answer;
            }
            else if (linkId === 'patient-number') {
                acc.phone = answer;
            }
            if (linkId === 'preferred-language' && ((_e = answer === null || answer === void 0 ? void 0 : answer.toLowerCase) === null || _e === void 0 ? void 0 : _e.call(answer)) === 'spanish') {
                acc.language = 'Español';
            }
            return acc;
        }, parsedAnswers)) !== null && _o !== void 0 ? _o : parsedAnswers, phone = _p.phone, language = _p.language;
        var baseInfo = [sex, dobAge, phone].filter(Boolean).join(' | ');
        return (<>
        <material_1.Typography variant="subtitle2" sx={{ fontSize: '16px' }}>
          {patientName}
        </material_1.Typography>
        <material_1.Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          {baseInfo}
        </material_1.Typography>
        {language && (<material_1.Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {language}
          </material_1.Typography>)}
      </>);
    }, [
        (_h = appointment === null || appointment === void 0 ? void 0 : appointment.paperwork) === null || _h === void 0 ? void 0 : _h.item,
        (_j = appointment === null || appointment === void 0 ? void 0 : appointment.patient) === null || _j === void 0 ? void 0 : _j.dateOfBirth,
        (_k = appointment === null || appointment === void 0 ? void 0 : appointment.patient) === null || _k === void 0 ? void 0 : _k.sex,
        theme.palette.text.secondary,
        patientName,
    ]);
    var reasonForVisit = appointment === null || appointment === void 0 ? void 0 : appointment.reasonForVisit;
    var goToAppointment = function () {
        navigate("/telemed/appointments/".concat(appointment.id));
    };
    var start;
    if (appointment.start) {
        var timezone = 'America/New_York';
        try {
            timezone = (0, utils_1.getTimezone)(appointment.locationVirtual);
        }
        catch (error) {
            console.error('Error getting timezone for appointment', appointment.id, error);
        }
        var dateTime = luxon_1.DateTime.fromISO(appointment.start).setZone(timezone);
        start = dateTime.toFormat('h:mm a');
    }
    return (<material_1.TableRow data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardTableRow(appointment.id)} data-location-group={appointment.locationVirtual.state} sx={__assign({ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': {
                backgroundColor: colors_1.otherColors.apptHover,
            }, position: 'relative' }, (next && { boxShadow: "inset 0 0 0 1px ".concat(colors_1.otherColors.orange800) }))}>
      <material_1.TableCell sx={{ verticalAlign: 'middle', cursor: 'pointer' }} onClick={goToAppointment}>
        {next && (<material_1.Box sx={{
                backgroundColor: colors_1.otherColors.orange800,
                position: 'absolute',
                width: '14px',
                bottom: 0,
                left: '-14px',
                height: '100%',
                borderTopLeftRadius: '10px',
                borderBottomLeftRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
            <material_1.Typography variant="subtitle2" fontSize={10} sx={{
                writingMode: 'vertical-lr',
                transform: 'scale(-1)',
                color: theme.palette.common.white,
            }}>
              NEXT
            </material_1.Typography>
          </material_1.Box>)}
        <material_1.Typography variant="body1">
          {material_1.capitalize === null || material_1.capitalize === void 0 ? void 0 : (0, material_1.capitalize)(appointment.appointmentType === 'walk-in' ? 'On-demand' : (appointment.appointmentType || '').toString())}
        </material_1.Typography>
        <material_1.Typography variant="body1">
          <strong>{start}</strong>
        </material_1.Typography>
        <components_1.AppointmentStatusChip status={appointment.telemedStatus}/>
        {appointment.telemedStatus == utils_1.TelemedAppointmentStatusEnum.cancelled ? (<material_1.Typography variant="body2" sx={{
                color: theme.palette.text.primary,
                width: '80px',
                whiteSpace: 'wrap',
                overflow: 'visible',
                pt: '6px',
            }}>
            {appointment.cancellationReason}
          </material_1.Typography>) : (<></>)}
        <material_1.Tooltip title={appointment.id}>
          <material_1.Typography variant="body2" sx={{
            color: theme.palette.text.secondary,
            textOverflow: 'ellipsis',
            width: '80px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            pt: '6px',
        }}>
            ID: {appointment.id}
          </material_1.Typography>
        </material_1.Tooltip>
      </material_1.TableCell>
      <material_1.TableCell sx={{ verticalAlign: 'middle' }}>
        <components_1.StatusHistory history={appointment.telemedStatusHistory} currentStatus={appointment.telemedStatus}/>
      </material_1.TableCell>
      <material_1.TableCell sx={{ verticalAlign: 'middle', cursor: 'pointer' }} onClick={goToAppointment}>
        {patientInfo}
        <material_1.Typography variant="body2" sx={{
            fontSize: '16px',
            width: '160px',
            whiteSpace: 'wrap',
            overflow: 'visible',
        }}>
          {reasonForVisit}
        </material_1.Typography>
      </material_1.TableCell>
      <material_1.TableCell sx={{ verticalAlign: 'middle', cursor: 'pointer' }} onClick={goToAppointment}>
        <material_1.Typography sx={{ fontSize: '16px' }}>{appointment.locationVirtual.state}</material_1.Typography>
      </material_1.TableCell>
      {showProvider && (<material_1.TableCell sx={{ verticalAlign: 'middle' }}>
          <material_1.Box>{displayedPractitionerName}</material_1.Box>
        </material_1.TableCell>)}
      <material_1.TableCell sx={{ verticalAlign: 'middle' }}>
        <material_1.Typography>{(_l = appointment.group) === null || _l === void 0 ? void 0 : _l.join(', ')}</material_1.Typography>
      </material_1.TableCell>
      <material_1.TableCell sx={{ verticalAlign: 'middle' }}>
        {showChatIcon && (<material_1.IconButton color="primary" sx={{
                backgroundColor: theme.palette.primary.main,
                width: '36px',
                height: '36px',
                borderRadius: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                '&:hover': {
                    backgroundColor: theme.palette.primary.dark,
                },
            }} onClick={function (_event) {
                setChatModalOpen(true);
            }} aria-label={hasUnread ? 'unread messages chat icon' : 'chat icon, no unread messages'} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.trackingBoardChatButton(appointment.id)}>
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
      <material_1.TableCell sx={{ verticalAlign: 'middle' }}>
        <TrackingBoardTableButton_1.TrackingBoardTableButton appointment={appointment}/>
      </material_1.TableCell>
      {chatModalOpen && (<ChatModal_1.default appointment={appointment} onClose={function () { return setChatModalOpen(false); }} onMarkAllRead={function () { return setHasUnread(false); }} quickTexts={utils_2.quickTexts}/>)}
    </material_1.TableRow>);
}
var SKELETON_ROWS_COUNT = 3;
var TrackingBoardTableRowSkeleton = function (_a) {
    var showProvider = _a.showProvider, isState = _a.isState, columnsCount = _a.columnsCount;
    var theme = (0, material_1.useTheme)();
    return (<>
      {!isState && (<material_1.TableRow>
          <material_1.TableCell sx={{ backgroundColor: (0, material_1.alpha)(theme.palette.secondary.main, 0.08) }} colSpan={columnsCount}>
            <material_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
              <material_1.Skeleton>
                <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  ST - State name
                </material_1.Typography>
              </material_1.Skeleton>
            </material_1.Box>
          </material_1.TableCell>
        </material_1.TableRow>)}
      {__spreadArray([], Array(SKELETON_ROWS_COUNT), true).map(function (_row, index) { return (<material_1.TableRow key={index} sx={{}}>
          <material_1.TableCell>
            <material_1.Skeleton variant="rounded">
              <components_1.AppointmentStatusChip status={utils_1.TelemedAppointmentStatusEnum.ready}/>
            </material_1.Skeleton>
            <material_1.Skeleton width="100%">
              <material_1.Typography variant="body2" sx={{
                pt: '6px',
            }}>
                ID: some ID
              </material_1.Typography>
            </material_1.Skeleton>
          </material_1.TableCell>
          <material_1.TableCell sx={{ verticalAlign: 'top' }}>
            <material_1.Skeleton width="100%">
              <material_1.Typography>time</material_1.Typography>
            </material_1.Skeleton>
          </material_1.TableCell>
          <material_1.TableCell sx={{ verticalAlign: 'top' }}>
            <material_1.Skeleton>
              <material_1.Typography variant="subtitle2" sx={{ fontSize: '16px' }}>
                Patient name
              </material_1.Typography>
            </material_1.Skeleton>
            <material_1.Skeleton width="100%">
              <material_1.Typography variant="body2">Lots of patient info</material_1.Typography>
            </material_1.Skeleton>
          </material_1.TableCell>
          <material_1.TableCell sx={{ verticalAlign: 'top' }}>
            <material_1.Skeleton>
              <material_1.Typography sx={{ fontSize: '16px' }}>ST</material_1.Typography>
            </material_1.Skeleton>
          </material_1.TableCell>
          {showProvider && (<material_1.TableCell sx={{ verticalAlign: 'top' }}>
              <material_1.Skeleton width="100%">
                <material_1.Typography>Dr. Name</material_1.Typography>
              </material_1.Skeleton>
            </material_1.TableCell>)}
          <material_1.TableCell sx={{ verticalAlign: 'top' }}>
            <material_1.Skeleton width="100%">
              <material_1.Typography>Group</material_1.Typography>
            </material_1.Skeleton>
          </material_1.TableCell>
          <material_1.TableCell sx={{ verticalAlign: 'top' }}>
            <material_1.Skeleton variant="circular">
              <material_1.IconButton sx={{
                width: '36px',
                height: '36px',
            }}/>
            </material_1.Skeleton>
          </material_1.TableCell>
          <material_1.TableCell sx={{ verticalAlign: 'top' }}>
            <material_1.Skeleton variant="rounded">
              <lab_1.LoadingButton variant="contained" sx={{
                fontSize: '15px',
                fontWeight: 500,
            }}>
                text
              </lab_1.LoadingButton>
            </material_1.Skeleton>
          </material_1.TableCell>
        </material_1.TableRow>); })}
    </>);
};
exports.TrackingBoardTableRowSkeleton = TrackingBoardTableRowSkeleton;
//# sourceMappingURL=TrackingBoardTableRow.js.map