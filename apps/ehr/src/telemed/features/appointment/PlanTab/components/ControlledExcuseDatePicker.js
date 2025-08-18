"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlledExcuseDatePicker = void 0;
var x_date_pickers_1 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var react_hook_form_1 = require("react-hook-form");
var ControlledExcuseDatePicker = function (props) {
    var name = props.name, validate = props.validate;
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<react_hook_form_1.Controller name={name} control={control} rules={{ validate: validate }} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
            return (<x_date_pickers_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
          <x_date_pickers_1.DatePicker value={value} onChange={onChange} slotProps={{
                    textField: {
                        size: 'small',
                        placeholder: 'MM/DD/YYYY',
                        helperText: error ? error.message : null,
                        error: !!error,
                    },
                }} format="MM/dd/yyyy"/>
        </x_date_pickers_1.LocalizationProvider>);
        }}/>);
};
exports.ControlledExcuseDatePicker = ControlledExcuseDatePicker;
//# sourceMappingURL=ControlledExcuseDatePicker.js.map