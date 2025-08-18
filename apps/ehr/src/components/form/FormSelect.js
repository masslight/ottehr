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
exports.FormSelect = void 0;
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var FormSelect = function (_a) {
    var name = _a.name, control = _a.control, options = _a.options, _b = _a.defaultValue, defaultValue = _b === void 0 ? '' : _b, rules = _a.rules, onChangeHandler = _a.onChangeHandler, selectProps = __rest(_a, ["name", "control", "options", "defaultValue", "rules", "onChangeHandler"]);
    return (<react_hook_form_1.Controller name={name} control={control} defaultValue={defaultValue} rules={rules} render={function (_a) {
            var _b;
            var field = _a.field, error = _a.fieldState.error;
            return (<system_1.Box sx={{ width: '100%' }}>
        <material_1.Select {...field} {...selectProps} variant={(_b = selectProps.variant) !== null && _b !== void 0 ? _b : 'standard'} fullWidth error={!!error} onChange={function (e) {
                    field.onChange(e);
                    onChangeHandler === null || onChangeHandler === void 0 ? void 0 : onChangeHandler(e);
                }}>
          {options.map(function (option) { return (<material_1.MenuItem key={option.value} value={option.value}>
              {option.label}
            </material_1.MenuItem>); })}
        </material_1.Select>
        {error && <material_1.FormHelperText error={true}>{error === null || error === void 0 ? void 0 : error.message}</material_1.FormHelperText>}
      </system_1.Box>);
        }}/>);
};
exports.FormSelect = FormSelect;
//# sourceMappingURL=FormSelect.js.map