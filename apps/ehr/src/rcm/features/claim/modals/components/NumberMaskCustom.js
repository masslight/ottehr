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
exports.NumberMaskCustom = void 0;
var react_1 = require("react");
var react_imask_1 = require("react-imask");
exports.NumberMaskCustom = (0, react_1.forwardRef)(function TextMaskCustom(props, ref) {
    var onChange = props.onChange, other = __rest(props, ["onChange"]);
    return (<react_imask_1.IMaskInput {...other} mask="(000) 000-0000" inputRef={ref} onAccept={function (value) { return onChange({ target: { name: props.name, value: value } }); }} overwrite/>);
});
//# sourceMappingURL=NumberMaskCustom.js.map