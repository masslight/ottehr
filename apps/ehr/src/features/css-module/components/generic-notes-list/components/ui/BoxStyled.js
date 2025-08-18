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
exports.BoxStyled = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var BoxStyled = function (_a) {
    var children = _a.children, props = __rest(_a, ["children"]);
    var theme = (0, material_1.useTheme)();
    return (<material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            '&:hover': {
                backgroundColor: (0, material_1.alpha)(theme.palette.primary.light, 0.08),
            },
            transition: 'background-color 0.3s',
            py: 0.5,
            px: 3,
            borderRadius: 1,
        }} {...props}>
      {children}
    </material_1.Box>);
};
exports.BoxStyled = BoxStyled;
//# sourceMappingURL=BoxStyled.js.map