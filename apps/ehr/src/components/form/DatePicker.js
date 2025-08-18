"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicDatePicker = BasicDatePicker;
var ArrowDropDown_1 = require("@mui/icons-material/ArrowDropDown");
var material_1 = require("@mui/material");
var x_date_pickers_1 = require("@mui/x-date-pickers");
var AdapterDayjs_1 = require("@mui/x-date-pickers/AdapterDayjs");
var DatePicker_1 = require("@mui/x-date-pickers/DatePicker");
var LocalizationProvider_1 = require("@mui/x-date-pickers/LocalizationProvider");
var dayjs_1 = require("dayjs");
var react_hook_form_1 = require("react-hook-form");
function BasicDatePicker(_a) {
    var name = _a.name, control = _a.control, rules = _a.rules, defaultValue = _a.defaultValue, onChange = _a.onChange, disabled = _a.disabled, _b = _a.variant, variant = _b === void 0 ? 'standard' : _b, label = _a.label, InputLabelProps = _a.InputLabelProps, id = _a.id, dataTestId = _a.dataTestId, _c = _a.component, component = _c === void 0 ? 'Picker' : _c;
    return (<LocalizationProvider_1.LocalizationProvider dateAdapter={AdapterDayjs_1.AdapterDayjs}>
      <material_1.Box sx={{ width: '100%' }} data-testid={dataTestId}>
        <react_hook_form_1.Controller name={name} control={control} defaultValue={defaultValue || ''} rules={rules} render={function (_a) {
            var field = _a.field, error = _a.fieldState.error;
            if (component === 'Picker') {
                return (<DatePicker_1.DatePicker value={field.value ? (0, dayjs_1.default)(field.value) : null} onChange={function (newValue) {
                        var dateStr = newValue ? newValue.format('YYYY-MM-DD') : '';
                        field.onChange(dateStr);
                        onChange === null || onChange === void 0 ? void 0 : onChange(dateStr);
                    }} onClose={function () {
                        field.onBlur();
                    }} disabled={disabled} sx={{ width: '100%', scrollbarWidth: 'none' }} slots={{
                        openPickerIcon: ArrowDropDown_1.default,
                    }} slotProps={{
                        textField: {
                            id: id,
                            variant: variant,
                            error: !!error,
                            helperText: error === null || error === void 0 ? void 0 : error.message,
                            onBlur: function () {
                                field.onBlur();
                            },
                            InputLabelProps: InputLabelProps,
                        },
                        openPickerButton: {
                            sx: {
                                padding: 0,
                                marginRight: 0,
                            },
                        },
                    }} label={label}/>);
            }
            else {
                return (<x_date_pickers_1.DateField value={field.value ? (0, dayjs_1.default)(field.value) : null} onChange={function (newValue) {
                        var dateStr = newValue ? newValue.format('YYYY-MM-DD') : '';
                        field.onChange(dateStr);
                        onChange === null || onChange === void 0 ? void 0 : onChange(dateStr);
                    }} disabled={disabled} label={label} slotProps={{
                        textField: {
                            id: id,
                            variant: variant,
                            error: !!error,
                            helperText: error === null || error === void 0 ? void 0 : error.message,
                            onBlur: function () {
                                field.onBlur();
                            },
                            InputLabelProps: InputLabelProps,
                        },
                    }}/>);
            }
        }}/>
      </material_1.Box>
    </LocalizationProvider_1.LocalizationProvider>);
}
//# sourceMappingURL=DatePicker.js.map