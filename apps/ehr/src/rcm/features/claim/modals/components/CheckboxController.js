"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckboxController = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var CheckboxController = function (props) {
    var name = props.name, rules = props.rules, label = props.label;
    var control = (0, react_hook_form_1.useFormContext)().control;
    var controller = (<react_hook_form_1.Controller name={name} control={control} rules={rules} render={function (_a) {
        var field = _a.field;
        return <material_1.Checkbox {...field} checked={field.value} onChange={field.onChange}/>;
    }}/>);
    if (label) {
        return <material_1.FormControlLabel control={controller} label={label}/>;
    }
    else {
        return controller;
    }
};
exports.CheckboxController = CheckboxController;
//# sourceMappingURL=CheckboxController.js.map