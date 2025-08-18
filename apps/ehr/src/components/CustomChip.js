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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CustomChip;
var DoneOutlined_1 = require("@mui/icons-material/DoneOutlined");
var material_1 = require("@mui/material");
function CustomChip(_a) {
    var label = _a.label, type = _a.type, additionalSx = _a.additionalSx, completed = _a.completed, fill = _a.fill;
    var theme = (0, material_1.useTheme)();
    return (<>
      {(function () {
            switch (type) {
                case 'status bullet':
                    return (<material_1.Box sx={{ display: 'flex', alignItems: 'center', mr: '8px' }}>
                <material_1.Box sx={{ borderRadius: '100px', height: '10px', width: '10px', backgroundColor: fill }}></material_1.Box>
              </material_1.Box>);
                case 'document':
                    return (<material_1.Typography variant="body2" sx={__assign({ backgroundColor: completed ? fill : '#E6E8EE', px: '8px', color: completed ? theme.palette.primary.contrastText : theme.palette.text.disabled, borderRadius: '4px', display: 'inline-flex', alignItems: 'center' }, additionalSx)}>
                <DoneOutlined_1.default sx={{ width: '12px', height: '12px' }}></DoneOutlined_1.default>
                &nbsp;{label}
              </material_1.Typography>);
            }
        })()}
    </>);
}
//# sourceMappingURL=CustomChip.js.map