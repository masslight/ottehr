"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlledExcuseTextField = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var ControlledExcuseTextField = function (props) {
    var name = props.name, validate = props.validate, placeholder = props.placeholder, label = props.label, fullWidth = props.fullWidth, multiline = props.multiline, required = props.required;
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<react_hook_form_1.Controller name={name} control={control} rules={{ validate: validate, required: required }} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
            return (<material_1.TextField error={!!error} helperText={error === null || error === void 0 ? void 0 : error.message} placeholder={placeholder} label={label} size="small" value={value} onChange={onChange} fullWidth={fullWidth} multiline={multiline}/>);
        }}/>);
};
exports.ControlledExcuseTextField = ControlledExcuseTextField;
//# sourceMappingURL=ControlledExcuseTextField.js.map