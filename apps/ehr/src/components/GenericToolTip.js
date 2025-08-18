"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaperworkToolTipContent = exports.GenericToolTip = void 0;
var colors_1 = require("@ehrTheme/colors");
var AccountCircleOutlined_1 = require("@mui/icons-material/AccountCircleOutlined");
var AssignmentTurnedInOutlined_1 = require("@mui/icons-material/AssignmentTurnedInOutlined");
var BadgeOutlined_1 = require("@mui/icons-material/BadgeOutlined");
var HealthAndSafetyOutlined_1 = require("@mui/icons-material/HealthAndSafetyOutlined");
var material_1 = require("@mui/material");
exports.GenericToolTip = (0, material_1.styled)(function (_a) {
    var className = _a.className, customWidth = _a.customWidth, props = __rest(_a, ["className", "customWidth"]);
    return (<material_1.Tooltip enterTouchDelay={0} placement="top-end" classes={{ popper: className }} slotProps={{
            tooltip: {
                sx: {
                    maxWidth: customWidth || 150,
                    backgroundColor: '#F9FAFB',
                    color: '#000000',
                    border: '1px solid #dadde9',
                },
            },
        }} {...props}/>);
})(function (_a) {
    var _b;
    var theme = _a.theme;
    return (_b = {},
        _b["& .".concat(material_1.tooltipClasses.tooltip)] = {
            boxShadow: theme.shadows[1],
            fontSize: theme.typography.pxToRem(12),
        },
        _b);
});
var PaperworkToolTipContent = function (_a) {
    var appointment = _a.appointment;
    return (<material_1.Box sx={{
            margin: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
    <material_1.Box sx={{ display: 'flex', gap: 1 }}>
      <AccountCircleOutlined_1.default sx={{ marginRight: 0.75, color: appointment.paperwork.demographics ? '#43A047' : '#BFC2C6' }} fill={colors_1.otherColors.cardChip}></AccountCircleOutlined_1.default>
      <material_1.Typography sx={!appointment.paperwork.demographics ? { color: '#78909C' } : {}}>Demographics</material_1.Typography>
    </material_1.Box>
    <material_1.Box sx={{ display: 'flex', gap: 1 }}>
      <HealthAndSafetyOutlined_1.default sx={{ marginRight: 0.75, color: appointment.paperwork.insuranceCard ? '#43A047' : '#BFC2C6' }} fill={colors_1.otherColors.cardChip}></HealthAndSafetyOutlined_1.default>
      <material_1.Typography sx={!appointment.paperwork.insuranceCard ? { color: '#78909C' } : {}}>INS Card</material_1.Typography>
    </material_1.Box>
    <material_1.Box sx={{ display: 'flex', gap: 1 }}>
      <BadgeOutlined_1.default sx={{ marginRight: 0.75, color: appointment.paperwork.photoID ? '#43A047' : '#BFC2C6' }} fill={colors_1.otherColors.cardChip}></BadgeOutlined_1.default>
      <material_1.Typography sx={!appointment.paperwork.photoID ? { color: '#78909C' } : {}}>ID</material_1.Typography>
    </material_1.Box>
    <material_1.Box sx={{ display: 'flex', gap: 1 }}>
      <AssignmentTurnedInOutlined_1.default sx={{ marginRight: 0.75, color: appointment.paperwork.consent ? '#43A047' : '#BFC2C6' }} fill={colors_1.otherColors.cardChip}></AssignmentTurnedInOutlined_1.default>
      <material_1.Typography sx={!appointment.paperwork.consent ? { color: '#78909C' } : {}}>Consent</material_1.Typography>
    </material_1.Box>
  </material_1.Box>);
};
exports.PaperworkToolTipContent = PaperworkToolTipContent;
//# sourceMappingURL=GenericToolTip.js.map