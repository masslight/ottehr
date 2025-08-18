"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitalAbnormalValuePopover = void 0;
var material_1 = require("@mui/material");
var InnerStatePopover_1 = require("src/telemed/components/InnerStatePopover");
var VitalAbnormalValuePopover = function (props) {
    var children = props.children, isAbnormal = props.isAbnormal;
    return (<InnerStatePopover_1.InnerStatePopover popoverChildren={<material_1.Typography variant="body2" sx={{ p: 1 }}>
          Abnormal value
        </material_1.Typography>} popoverProps={{
            anchorOrigin: {
                vertical: 'top',
                horizontal: 'center',
            },
            transformOrigin: {
                vertical: 'bottom',
                horizontal: 'center',
            },
        }}>
      {function (_a) {
            var handlePopoverOpen = _a.handlePopoverOpen, handlePopoverClose = _a.handlePopoverClose;
            return (<material_1.Box onMouseEnter={isAbnormal ? handlePopoverOpen : undefined} onMouseLeave={isAbnormal ? handlePopoverClose : undefined} component="span">
          {children}
        </material_1.Box>);
        }}
    </InnerStatePopover_1.InnerStatePopover>);
};
exports.VitalAbnormalValuePopover = VitalAbnormalValuePopover;
//# sourceMappingURL=VitalAbnormalValuePopover.js.map