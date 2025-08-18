"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TooltipWrapper = exports.CPT_TOOLTIP_PROPS = exports.DEFAULT_TOOLTIP_PROPS = void 0;
var InfoOutlined_1 = require("@mui/icons-material/InfoOutlined");
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
exports.DEFAULT_TOOLTIP_PROPS = {
    placement: 'top',
    arrow: true,
    enterTouchDelay: 0,
    leaveTouchDelay: 5000,
};
var CPT_TOOLTIP_CONTENT = (<system_1.Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
    {"CPT copyright 2024 American Medical Association. All rights reserved.\n\nFee schedules, relative value units, conversion factors and/or related components are not assigned by the AMA, are not part of CPT, and the AMA is not recommending their use. The AMA does not directly or indirectly practice medicine or dispense medical services. The AMA assumes no liability for data contained or not contained herein.\n\nCPT is a registered trademark of the American Medical Association."}
  </system_1.Box>);
var CPT_TOOLTIP_ICON = <InfoOutlined_1.default sx={{ fontSize: 16, color: 'inherit', cursor: 'pointer' }}/>;
exports.CPT_TOOLTIP_PROPS = {
    title: CPT_TOOLTIP_CONTENT,
    children: CPT_TOOLTIP_ICON,
};
var TooltipWrapper = function (_a) {
    var children = _a.children, tooltipProps = _a.tooltipProps;
    return (<material_1.Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {children}
      <material_1.Tooltip {...exports.DEFAULT_TOOLTIP_PROPS} {...tooltipProps}/>
    </material_1.Typography>);
};
exports.TooltipWrapper = TooltipWrapper;
//# sourceMappingURL=WithTooltip.js.map