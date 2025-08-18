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
exports.DateRangePickerController = void 0;
var material_1 = require("@mui/material");
var x_date_pickers_1 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var x_date_pickers_pro_1 = require("@mui/x-date-pickers-pro");
var react_hook_form_1 = require("react-hook-form");
var DateRangePickerController = function (props) {
    var name = props.name, rules = props.rules, label = props.label, separator = props.separator, variant = props.variant, sx = props.sx;
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<react_hook_form_1.Controller name={name} control={control} rules={rules} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, _ = _a.fieldState.error;
            return (<material_1.FormControl>
          {label && <material_1.FormLabel sx={{ fontSize: '12px', pb: 0.5 }}>{label}</material_1.FormLabel>}
          <x_date_pickers_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon} localeText={{ start: undefined, end: undefined }}>
            <x_date_pickers_pro_1.DateRangePicker value={value} sx={__assign({}, sx)} onChange={onChange} format="MM/dd/yyyy" slotProps={{
                    fieldSeparator: { children: separator || 'to' },
                    textField: {
                        style: { width: '100%' },
                        placeholder: 'MM.DD.YYYY',
                        size: 'small',
                        variant: variant,
                    },
                }}/>
          </x_date_pickers_1.LocalizationProvider>
        </material_1.FormControl>);
        }}/>);
};
exports.DateRangePickerController = DateRangePickerController;
//# sourceMappingURL=DateRangePickerController.js.map