"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusHistory = void 0;
var InfoOutlined_1 = require("@mui/icons-material/InfoOutlined");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var utils_1 = require("utils");
var utils_2 = require("../utils");
var AppointmentStatusChip_1 = require("./AppointmentStatusChip");
var CustomTooltip_1 = require("./CustomTooltip");
var initialTooltipState = {
    visible: false,
};
function tooltipReducer(state, action) {
    switch (action) {
        case 'OPEN_ON_CLICK':
            return state.visible === false || state.triggeredBy !== 'click' ? { visible: true, triggeredBy: 'click' } : state;
        case 'OPEN_ON_HOVER':
            return state.visible === false ? { visible: true, triggeredBy: 'hover' } : state;
        case 'CLOSE_ON_CLICK':
            return state.visible === true ? { visible: false } : state;
        case 'CLOSE_ON_LEAVE':
            return state.visible === true && state.triggeredBy === 'hover' ? { visible: false } : state;
        default:
            return state;
    }
}
var StatusHistory = function (props) {
    var history = props.history, currentStatus = props.currentStatus;
    var theme = (0, material_1.useTheme)();
    var _a = (0, react_1.useReducer)(tooltipReducer, initialTooltipState), tooltipState = _a[0], updateTooltip = _a[1];
    var closeTooltipOnClick = function () { return updateTooltip('CLOSE_ON_CLICK'); };
    var closeTooltipOnLeave = function () { return updateTooltip('CLOSE_ON_LEAVE'); };
    var openTooltipOnClick = function () { return updateTooltip('OPEN_ON_CLICK'); };
    var openTooltipOnHover = function () { return updateTooltip('OPEN_ON_HOVER'); };
    var currentTimeISO = new Date().toISOString();
    return (<material_1.ClickAwayListener onClickAway={closeTooltipOnClick}>
      <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} onMouseEnter={openTooltipOnHover} onMouseLeave={closeTooltipOnLeave}>
        <StatusHistoryTimeCounter history={history} currentAppointmentStatus={currentStatus} currentTimeISO={currentTimeISO}/>
        <div>
          <CustomTooltip_1.CustomTooltip PopperProps={{
            disablePortal: true,
        }} onClose={closeTooltipOnClick} open={tooltipState.visible} disableFocusListener disableHoverListener disableTouchListener title={<TooltipContent history={history} currentAppointmentStatus={currentStatus} currentTimeISO={currentTimeISO}/>}>
            <material_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
              <InfoOutlined_1.default onClick={openTooltipOnClick} fontSize="small" sx={{ color: theme.palette.text.secondary, cursor: 'pointer' }}/>
            </material_1.Box>
          </CustomTooltip_1.CustomTooltip>
        </div>
      </material_1.Box>
    </material_1.ClickAwayListener>);
};
exports.StatusHistory = StatusHistory;
var StatusHistoryTimeCounter = function (props) {
    var history = props.history, currentAppointmentStatus = props.currentAppointmentStatus, currentTimeISO = props.currentTimeISO;
    var totalTime = getTotalAppointmentTime(history, currentAppointmentStatus, currentTimeISO);
    var appointmentStatus = utils_1.TelemedAppointmentStatusEnum[currentAppointmentStatus];
    var isStatusReady = appointmentStatus === utils_1.TelemedAppointmentStatusEnum.ready;
    var isStatusComplete = appointmentStatus === utils_1.TelemedAppointmentStatusEnum.complete;
    var isStatusCanceled = appointmentStatus === utils_1.TelemedAppointmentStatusEnum.cancelled;
    if (isStatusReady || isStatusComplete) {
        return <material_1.Typography>{"".concat((0, utils_2.getAppointmentWaitingTime)(history), " m")}</material_1.Typography>;
    }
    if (isStatusCanceled) {
        return <material_1.Typography>{"".concat(totalTime, " m")}</material_1.Typography>;
    }
    var lastHistoryRecord = history.at(-1);
    return (<material_1.Typography>
      <>
        {(0, utils_2.diffInMinutes)(luxon_1.DateTime.fromISO((lastHistoryRecord === null || lastHistoryRecord === void 0 ? void 0 : lastHistoryRecord.end) || currentTimeISO), luxon_1.DateTime.fromISO((lastHistoryRecord === null || lastHistoryRecord === void 0 ? void 0 : lastHistoryRecord.start) || currentTimeISO))}
        m / {totalTime}m
      </>
    </material_1.Typography>);
};
var TooltipContent = function (props) {
    var history = props.history, currentAppointmentStatus = props.currentAppointmentStatus, currentTimeISO = props.currentTimeISO;
    var appointmentStatus = utils_1.TelemedAppointmentStatusEnum[currentAppointmentStatus];
    var isStatusReady = appointmentStatus === utils_1.TelemedAppointmentStatusEnum.ready;
    // const isStatusComplete = appointmentStatus === TelemedAppointmentStatusEnum.complete;
    // const isStatusCanceled = appointmentStatus === TelemedAppointmentStatusEnum.cancelled;
    var appointmentTotalTime = getTotalAppointmentTime(history, currentAppointmentStatus, currentTimeISO);
    var totalTime = isStatusReady ? (0, utils_2.getAppointmentWaitingTime)(history) : appointmentTotalTime;
    var composeHistoryElementText = function (historyElement) {
        var isCanceledEntry = historyElement.status === utils_1.TelemedAppointmentStatusEnum.cancelled;
        var isCompletedEntry = historyElement.status === utils_1.TelemedAppointmentStatusEnum.complete;
        if (isCanceledEntry || isCompletedEntry) {
            return '';
        }
        var historyElementStartTime = historyElement.start;
        if (!historyElementStartTime) {
            return '';
        }
        return "".concat((0, utils_2.diffInMinutes)(luxon_1.DateTime.fromISO(historyElement.end || currentTimeISO), luxon_1.DateTime.fromISO(historyElementStartTime)), " mins");
    };
    return (<material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {history.map(function (element, index) { return (<material_1.Box sx={{ display: 'flex', gap: 1 }} key={"".concat(element.status, "-").concat(index)}>
          <material_1.Typography sx={{ minWidth: '60px' }}>{composeHistoryElementText(element)}</material_1.Typography>
          <AppointmentStatusChip_1.AppointmentStatusChip status={element.status}/>
        </material_1.Box>); })}
      <material_1.Typography sx={{ fontWeight: 500, mt: 1 }}>Total: {totalTime} mins</material_1.Typography>
    </material_1.Box>);
};
var getTotalAppointmentTime = function (history, appointmentStatus, currentTimeISO) {
    var firstHistoryRecord = history.at(0);
    var lastHistoryRecord = history.at(-1);
    var firstRecordStartTime = firstHistoryRecord === null || firstHistoryRecord === void 0 ? void 0 : firstHistoryRecord.start;
    if (!firstRecordStartTime) {
        return 0;
    }
    var historyStartTime = luxon_1.DateTime.fromISO(firstRecordStartTime);
    var currentTime = luxon_1.DateTime.fromISO(currentTimeISO);
    if (appointmentStatus === utils_1.TelemedAppointmentStatusEnum.complete) {
        var onVideoHistoryRecord = history.find(function (element) { return element.status === utils_1.TelemedAppointmentStatusEnum['on-video']; });
        var videoEndTime = onVideoHistoryRecord === null || onVideoHistoryRecord === void 0 ? void 0 : onVideoHistoryRecord.end;
        return videoEndTime ? (0, utils_2.diffInMinutes)(luxon_1.DateTime.fromISO(videoEndTime), historyStartTime) : 0;
    }
    if (appointmentStatus === utils_1.TelemedAppointmentStatusEnum.cancelled) {
        var lastRecordStartTime = lastHistoryRecord === null || lastHistoryRecord === void 0 ? void 0 : lastHistoryRecord.start;
        return lastRecordStartTime ? (0, utils_2.diffInMinutes)(luxon_1.DateTime.fromISO(lastRecordStartTime), historyStartTime) : 0;
    }
    return (0, utils_2.diffInMinutes)(currentTime, historyStartTime);
};
//# sourceMappingURL=StatusHistory.js.map