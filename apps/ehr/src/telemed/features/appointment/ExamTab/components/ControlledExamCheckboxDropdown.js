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
exports.ControlledExamCheckboxDropdown = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var useExamObservations_1 = require("../../../../hooks/useExamObservations");
var StatelessExamCheckbox_1 = require("./StatelessExamCheckbox");
var ControlledExamCheckboxDropdown = function (props) {
    var checkboxLabel = props.checkboxLabel, dropdownLabel = props.dropdownLabel, abnormal = props.abnormal, options = props.options, dropdownTestId = props.dropdownTestId, checkboxBlockTestId = props.checkboxBlockTestId;
    var _a = (0, useExamObservations_1.useExamObservations)(options.map(function (option) { return option.name; })), fields = _a.value, update = _a.update, isLoading = _a.isLoading;
    var _b = (0, react_1.useState)(fields
        .filter(function (field) { return field.value === true; })
        .map(function (field) { return options.find(function (option) { return option.name === field.field; }); })[0] || null), selectedOption = _b[0], setSelectedOption = _b[1];
    var _c = (0, react_1.useState)(!!selectedOption), booleanValue = _c[0], setBooleanValue = _c[1];
    var onChange = function (fieldsToChange) {
        update(fieldsToChange);
    };
    var onBooleanChange = function (newValue) {
        if (!newValue) {
            setSelectedOption(null);
            if (selectedOption) {
                onChange(fields.map(function (field) { return (__assign(__assign({}, field), { value: false })); }));
            }
        }
        setBooleanValue(newValue);
    };
    var onOptionChange = function (newValue) {
        setBooleanValue(!!newValue);
        setSelectedOption(newValue);
        onChange(fields.map(function (field) { return (__assign(__assign({}, field), { value: field.field === (newValue === null || newValue === void 0 ? void 0 : newValue.name) })); }));
    };
    return (<material_1.Box sx={{ display: 'flex', gap: 2 }}>
      <material_1.Box data-testid={checkboxBlockTestId}>
        <StatelessExamCheckbox_1.StatelessExamCheckbox label={checkboxLabel} abnormal={abnormal} checked={booleanValue} onChange={onBooleanChange} disabled={isLoading}/>
      </material_1.Box>
      <material_1.Autocomplete data-testid={dropdownTestId} disablePortal disabled={isLoading} options={options} value={selectedOption} onChange={function (_e, newValue) { return onOptionChange(newValue); }} fullWidth renderInput={function (params) { return <material_1.TextField {...params} size="small" label={dropdownLabel}/>; }}/>
    </material_1.Box>);
};
exports.ControlledExamCheckboxDropdown = ControlledExamCheckboxDropdown;
//# sourceMappingURL=ControlledExamCheckboxDropdown.js.map