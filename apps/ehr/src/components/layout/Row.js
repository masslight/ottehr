"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Row = void 0;
var material_1 = require("@mui/material");
var Row = function (_a) {
    var label = _a.label, children = _a.children, inputId = _a.inputId, required = _a.required, dataTestId = _a.dataTestId;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
      <material_1.Box sx={{ display: 'flex', alignItems: 'center', flex: '0 1 30%' }}>
        <material_1.Typography component="label" htmlFor={inputId} sx={{ color: theme.palette.primary.dark }}>
          {label}
          {required && ' *'}
        </material_1.Typography>
      </material_1.Box>
      <material_1.Box data-testid={dataTestId} sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
        {children}
      </material_1.Box>
    </material_1.Box>);
};
exports.Row = Row;
//# sourceMappingURL=Row.js.map