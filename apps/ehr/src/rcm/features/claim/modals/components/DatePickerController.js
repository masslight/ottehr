"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatePickerController = void 0;
var x_date_pickers_1 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var react_hook_form_1 = require("react-hook-form");
var DatePickerController = function (props) {
    var name = props.name, rules = props.rules, label = props.label, format = props.format, placeholder = props.placeholder;
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<react_hook_form_1.Controller name={name} control={control} rules={rules} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
            return (<x_date_pickers_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
          <x_date_pickers_1.DatePicker label={label} onChange={onChange} format={format} slotProps={{
                    textField: {
                        style: { width: '100%' },
                        size: 'small',
                        placeholder: placeholder,
                        helperText: error === null || error === void 0 ? void 0 : error.message,
                        error: !!error,
                    },
                }} value={value}/>
        </x_date_pickers_1.LocalizationProvider>);
        }}/>);
};
exports.DatePickerController = DatePickerController;
//# sourceMappingURL=DatePickerController.js.map