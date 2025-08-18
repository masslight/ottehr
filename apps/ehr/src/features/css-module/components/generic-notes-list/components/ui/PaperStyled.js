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
exports.PaperStyled = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var PaperStyled = function (_a) {
    var children = _a.children, props = __rest(_a, ["children"]);
    return (<material_1.Paper elevation={3} sx={{ mt: 3, boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)' }} {...props}>
    {children}
  </material_1.Paper>);
};
exports.PaperStyled = PaperStyled;
//# sourceMappingURL=PaperStyled.js.map