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
exports.FormAutocomplete = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var FormAutocomplete = function (_a) {
    var name = _a.name, control = _a.control, options = _a.options, _b = _a.defaultValue, defaultValue = _b === void 0 ? '' : _b, rules = _a.rules, required = _a.required, onChangeHandler = _a.onChangeHandler, helperText = _a.helperText, autocompleteProps = __rest(_a, ["name", "control", "options", "defaultValue", "rules", "required", "onChangeHandler", "helperText"]);
    return (<react_hook_form_1.Controller name={name} control={control} defaultValue={defaultValue} rules={__assign({ required: required, validate: function (value) { return !value || options.some(function (option) { return option.value === value; }); } }, rules)} render={function (_a) {
            var _b;
            var _c = _a.field, onChange = _c.onChange, value = _c.value, error = _a.fieldState.error;
            return (<material_1.Autocomplete {...autocompleteProps} options={options} value={(_b = options.find(function (option) { return option.value === value; })) !== null && _b !== void 0 ? _b : undefined} onChange={function (_, newValue) {
                    var newStringValue = (newValue === null || newValue === void 0 ? void 0 : newValue.value) || '';
                    onChange(newStringValue);
                    onChangeHandler === null || onChangeHandler === void 0 ? void 0 : onChangeHandler(name, newStringValue);
                }} disableClearable={true} renderInput={function (params) { return (<material_1.TextField {...params} variant="standard" error={!!error} fullWidth helperText={(error === null || error === void 0 ? void 0 : error.message) || helperText}/>); }}/>);
        }}/>);
};
exports.FormAutocomplete = FormAutocomplete;
//# sourceMappingURL=FormAutocomplete.js.map