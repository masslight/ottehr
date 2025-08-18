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
exports.FormTextField = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var FormTextField = function (_a) {
    var name = _a.name, control = _a.control, _b = _a.defaultValue, defaultValue = _b === void 0 ? '' : _b, rules = _a.rules, id = _a.id, onChangeHandler = _a.onChangeHandler, helperText = _a.helperText, textFieldProps = __rest(_a, ["name", "control", "defaultValue", "rules", "id", "onChangeHandler", "helperText"]);
    return (<react_hook_form_1.Controller name={name} control={control} defaultValue={defaultValue} rules={rules} render={function (_a) {
            var _b;
            var field = _a.field, error = _a.fieldState.error;
            return (<material_1.TextField {...field} {...textFieldProps} id={id} error={!!error} variant={(_b = textFieldProps.variant) !== null && _b !== void 0 ? _b : 'standard'} fullWidth onChange={function (e) {
                    field.onChange(e);
                    onChangeHandler === null || onChangeHandler === void 0 ? void 0 : onChangeHandler(e);
                }} helperText={(error === null || error === void 0 ? void 0 : error.message) || helperText}/>);
        }}/>);
};
exports.FormTextField = FormTextField;
//# sourceMappingURL=FormTextField.js.map