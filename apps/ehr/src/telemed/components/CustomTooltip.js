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
exports.CustomTooltip = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
exports.CustomTooltip = (0, material_1.styled)(function (_a) {
    var className = _a.className, props = __rest(_a, ["className"]);
    return (<material_1.Tooltip {...props} classes={{ popper: className }}/>);
})(function (_a) {
    var _b;
    var theme = _a.theme;
    return (_b = {},
        _b["& .".concat(material_1.tooltipClasses.tooltip)] = {
            backgroundColor: '#F9FAFB',
            color: '#000000',
            boxShadow: "\n    0px 1px 8px 0px rgba(0, 0, 0, 0.12),\n    0px 3px 4px 0px rgba(0, 0, 0, 0.14),\n    0px 3px 3px -2px rgba(0, 0, 0, 0.20)\n  ",
            maxWidth: 190,
            padding: 5,
            fontSize: theme.typography.pxToRem(16),
            border: '1px solid #dadde9',
        },
        _b["& .".concat(material_1.tooltipClasses.arrow)] = {
            backgroundColor: '#F9FAFB',
            boxShadow: "\n    0px 1px 8px 0px rgba(0, 0, 0, 0.12),\n    0px 3px 4px 0px rgba(0, 0, 0, 0.14),\n    0px 3px 3px -2px rgba(0, 0, 0, 0.20)\n  ",
        },
        _b);
});
//# sourceMappingURL=CustomTooltip.js.map