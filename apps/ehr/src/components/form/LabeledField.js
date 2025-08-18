"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabeledField = void 0;
var material_1 = require("@mui/material");
var LabeledField = function (_a) {
    var children = _a.children, label = _a.label, _b = _a.required, required = _b === void 0 ? false : _b, error = _a.error;
    var theme = (0, material_1.useTheme)();
    return (<material_1.FormControl fullWidth>
      <material_1.InputLabel shrink required={required} error={error} sx={{ fontWeight: 'bold', backgroundColor: theme.palette.background.paper, px: '5px' }}>
        {label}
      </material_1.InputLabel>
      {children}
    </material_1.FormControl>);
};
exports.LabeledField = LabeledField;
//# sourceMappingURL=LabeledField.js.map