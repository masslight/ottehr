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
exports.PageHeader = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var PageHeader = function (_a) {
    var title = _a.title, _b = _a.variant, variant = _b === void 0 ? 'h3' : _b, _c = _a.component, component = _c === void 0 ? 'h1' : _c, color = _a.color, dataTestId = _a.dataTestId;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Typography data-testid={dataTestId} variant={variant} component={component} sx={__assign(__assign({}, theme.typography[variant]), { color: color || theme.palette.primary.dark })}>
      {title}
    </material_1.Typography>);
};
exports.PageHeader = PageHeader;
//# sourceMappingURL=PageHeader.js.map