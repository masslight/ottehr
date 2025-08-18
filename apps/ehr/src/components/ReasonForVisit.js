"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var react_1 = require("react");
var constants_1 = require("../constants");
var AppointmentTabs_1 = require("./AppointmentTabs");
var GenericToolTip_1 = require("./GenericToolTip");
var ReasonsForVisit = function (_a) {
    var reasonsForVisit = _a.reasonsForVisit, tab = _a.tab, formattedPriorityHighIcon = _a.formattedPriorityHighIcon, lineMax = _a.lineMax, _b = _a.isMobile, isMobile = _b === void 0 ? false : _b;
    var _c = (0, react_1.useState)(false), reasonIsOverflowing = _c[0], setReasonIsOverflowing = _c[1];
    var reasonRef = (0, react_1.useRef)(null);
    var _d = reasonsForVisit.split(' - '), reason = _d[0], reasonAdditional = _d[1];
    var _e = (0, react_1.useState)(false), mobileModalOpen = _e[0], setMobileModalOpen = _e[1];
    var truncatedTextStyles = (0, react_1.useMemo)(function () {
        return {
            fontSize: '14px',
            display: '-webkit-box',
            WebkitLineClamp: lineMax,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        };
    }, [lineMax]);
    var flagReason = (0, react_1.useMemo)(function () { return constants_1.FLAGGED_REASONS_FOR_VISIT.includes(reason) && tab !== AppointmentTabs_1.ApptTab.cancelled && tab !== AppointmentTabs_1.ApptTab.completed; }, [reason, tab]);
    (0, react_1.useEffect)(function () {
        if (reasonRef.current) {
            var isOverflowing = reasonRef.current.scrollHeight > reasonRef.current.clientHeight;
            setReasonIsOverflowing(isOverflowing);
        }
    }, [reasonsForVisit]);
    var toolTipTitle = (0, react_1.useMemo)(function () {
        var title = flagReason ? 'Alert clinical team for immediate evaluation' : undefined;
        if (reasonIsOverflowing) {
            title = title ? "".concat(title, "\n").concat(reasonsForVisit) : reasonsForVisit;
        }
        return title;
    }, [flagReason, reasonIsOverflowing, reasonsForVisit]);
    var reasonForVisitReactElement = (0, react_1.useMemo)(function () { return (<material_1.Typography ref={reasonRef} sx={truncatedTextStyles} onClick={function () {
            if (isMobile && toolTipTitle) {
                setMobileModalOpen(true);
            }
        }}>
        {flagReason && formattedPriorityHighIcon}
        <span style={{ color: flagReason ? colors_1.otherColors.priorityHighText : undefined, display: 'inline' }}>
          {reason}
        </span>
        {reasonAdditional && " - ".concat(reasonAdditional)}
      </material_1.Typography>); }, [flagReason, formattedPriorityHighIcon, isMobile, reason, reasonAdditional, toolTipTitle, truncatedTextStyles]);
    return (<>
      {toolTipTitle && !isMobile ? (<GenericToolTip_1.GenericToolTip title={toolTipTitle}>{reasonForVisitReactElement}</GenericToolTip_1.GenericToolTip>) : (reasonForVisitReactElement)}
      {toolTipTitle && isMobile && (<material_1.Modal open={mobileModalOpen} onClose={function () { return setMobileModalOpen(false); }}>
          <material_1.Box sx={constants_1.MOBILE_MODAL_STYLE}>{toolTipTitle}</material_1.Box>
        </material_1.Modal>)}
    </>);
};
exports.default = ReasonsForVisit;
//# sourceMappingURL=ReasonForVisit.js.map