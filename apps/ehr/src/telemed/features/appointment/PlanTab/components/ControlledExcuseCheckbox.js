"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlledExcuseCheckbox = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var ControlledExcuseCheckbox = function (props) {
    var label = props.label, name = props.name, onExternalChange = props.onChange;
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<material_1.FormControlLabel control={<react_hook_form_1.Controller name={name} control={control} render={function (_a) {
                var _b = _a.field, value = _b.value, onChange = _b.onChange;
                return (<material_1.Checkbox checked={value} onChange={function (e) {
                        if (onExternalChange) {
                            onExternalChange(e.target.checked);
                        }
                        onChange(e);
                    }}/>);
            }}/>} label={label}/>);
};
exports.ControlledExcuseCheckbox = ControlledExcuseCheckbox;
//# sourceMappingURL=ControlledExcuseCheckbox.js.map