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
exports.ControlledExamRadioGroup = void 0;
var material_1 = require("@mui/material");
var useExamObservations_1 = require("../../../../hooks/useExamObservations");
var ControlledExamRadioGroup = function (props) {
    var label = props.label, name = props.name, abnormal = props.abnormal;
    var _a = (0, useExamObservations_1.useExamObservations)(name), field = _a.value, update = _a.update, isLoading = _a.isLoading;
    var theme = (0, material_1.useTheme)();
    var onChange = function (value) {
        update(__assign(__assign({}, field), { value: value === 'true' }));
    };
    return (<material_1.FormControl sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <material_1.Typography sx={{ flex: 1 }}>{label}</material_1.Typography>
      <material_1.RadioGroup row value={field.value ? 'true' : 'false'} onChange={function (e) { return onChange(e.target.value); }} sx={{ display: 'flex', gap: 1 }}>
        <material_1.FormControlLabel value="true" control={<material_1.Radio size="small" disabled={isLoading} sx={{
                p: 0.5,
                '&.Mui-checked': {
                    color: isLoading ? undefined : abnormal ? theme.palette.error.main : theme.palette.success.main,
                },
            }}/>} label={<material_1.Typography fontWeight={field.value === true && abnormal ? 600 : 400}>Yes</material_1.Typography>} sx={{ m: 0 }}/>
        <material_1.FormControlLabel value="false" control={<material_1.Radio size="small" disabled={isLoading} sx={{
                p: 0.5,
                '&.Mui-checked': {
                    color: isLoading ? undefined : abnormal ? theme.palette.success.main : theme.palette.error.main,
                },
            }}/>} label={<material_1.Typography fontWeight={field.value === false && !abnormal ? 600 : 400}>No</material_1.Typography>} sx={{ m: 0 }}/>
      </material_1.RadioGroup>
    </material_1.FormControl>);
};
exports.ControlledExamRadioGroup = ControlledExamRadioGroup;
//# sourceMappingURL=ControlledExamRadioGroup.js.map