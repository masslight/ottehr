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
exports.ButtonStyled = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var ButtonStyled = function (_a) {
    var children = _a.children, props = __rest(_a, ["children"]);
    return (<material_1.Button sx={{
            p: 1,
            py: 0.5,
            color: 'primary.main',
            minWidth: 'auto',
            '&:hover': { backgroundColor: 'transparent' },
            textTransform: 'none',
            fontWeight: 'bold',
        }} {...props}>
    {children}
  </material_1.Button>);
};
exports.ButtonStyled = ButtonStyled;
//# sourceMappingURL=ButtonStyled.js.map