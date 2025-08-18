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
var react_1 = require("react");
var react_imask_1 = require("react-imask");
var InputMask = (0, react_1.forwardRef)(function (_a, ref) {
    var onChange = _a.onChange, name = _a.name, mask = _a.mask, blocks = _a.blocks, other = __rest(_a, ["onChange", "name", "mask", "blocks"]);
    return (<react_imask_1.IMaskInput {...other} mask={mask} inputRef={ref} blocks={blocks} onAccept={function (value) { return onChange({ target: { name: name, value: value } }); }} overwrite name={name} // todo check why name is not included when there is a mask
    />);
});
exports.default = InputMask;
//# sourceMappingURL=InputMask.js.map