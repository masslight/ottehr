"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextFieldController = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var TextFieldController = function (props) {
    var name = props.name, rules = props.rules, label = props.label, placeholder = props.placeholder, InputProps = props.InputProps, children = props.children, select = props.select, multiline = props.multiline, variant = props.variant, type = props.type;
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<react_hook_form_1.Controller name={name} control={control} rules={rules} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
            return (<material_1.TextField value={value} onChange={onChange} helperText={error ? error.message : null} error={!!error} size="small" fullWidth label={label} placeholder={placeholder} InputProps={InputProps} select={select} multiline={multiline} variant={variant} type={type}>
          {children}
        </material_1.TextField>);
        }}/>);
};
exports.TextFieldController = TextFieldController;
//# sourceMappingURL=TextFieldController.js.map