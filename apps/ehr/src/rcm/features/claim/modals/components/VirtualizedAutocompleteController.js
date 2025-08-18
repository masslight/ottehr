"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualizedAutocompleteController = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var VirtualizedAutocomplete_1 = require("./VirtualizedAutocomplete");
var VirtualizedAutocompleteController = function (props) {
    var name = props.name, rules = props.rules, options = props.options, renderRow = props.renderRow, label = props.label;
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<react_hook_form_1.Controller name={name} control={control} rules={rules} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
            return (<VirtualizedAutocomplete_1.VirtualizedAutocomplete label={label} options={options} renderRow={renderRow} value={value} onChange={onChange} helperText={error ? error.message : null} error={!!error}/>);
        }}/>);
};
exports.VirtualizedAutocompleteController = VirtualizedAutocompleteController;
//# sourceMappingURL=VirtualizedAutocompleteController.js.map