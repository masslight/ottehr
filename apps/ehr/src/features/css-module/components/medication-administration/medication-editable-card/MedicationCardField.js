"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationCardField = void 0;
var material_1 = require("@mui/material");
var styles_1 = require("@mui/material/styles");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var DateTimePicker_1 = require("@mui/x-date-pickers/DateTimePicker");
var LocalizationProvider_1 = require("@mui/x-date-pickers/LocalizationProvider");
var luxon_1 = require("luxon");
var react_1 = require("react");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var utils_2 = require("./utils");
var StyledTextField = (0, styles_1.styled)(material_1.TextField)({
    '& .MuiInputBase-input': {
        height: '1.44em',
    },
});
var StyledFormControl = (0, styles_1.styled)(material_1.FormControl)({
    width: '100%',
});
var emptySelectsOptions = {
    medicationId: { options: [], status: 'loading' },
    route: { options: [], status: 'loading' },
    associatedDx: { options: [], status: 'loading' },
    units: { options: [], status: 'loading' },
    location: { options: [], status: 'loading' },
    providerId: { options: [], status: 'loading' },
};
var MedicationCardField = function (_a) {
    var _b;
    var field = _a.field, label = _a.label, _c = _a.type, type = _c === void 0 ? 'text' : _c, value = _a.value, onChange = _a.onChange, _d = _a.required, required = _d === void 0 ? false : _d, _f = _a.showError, showError = _f === void 0 ? false : _f, _g = _a.isEditable, isEditable = _g === void 0 ? true : _g, _h = _a.selectsOptions, selectsOptions = _h === void 0 ? emptySelectsOptions : _h, renderValue = _a.renderValue;
    var handleChange = function (newValue) {
        onChange(field, newValue);
    };
    var isInstruction = field === 'instructions';
    if (field === 'effectiveDateTime') {
        var dateTimeValue = value ? luxon_1.DateTime.fromISO(value) : null;
        return (<LocalizationProvider_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
        <DateTimePicker_1.DateTimePicker data-testid={data_test_ids_1.dataTestIds.orderMedicationPage.inputField(field)} label={label} value={dateTimeValue} onChange={function (newValue) {
                if (!newValue)
                    return;
                var isoString = newValue.toISO();
                if (isoString) {
                    handleChange(isoString);
                }
            }} disabled={!isEditable} slotProps={{
                textField: {
                    fullWidth: true,
                    variant: 'outlined',
                    required: required,
                    error: showError && required && !value,
                    helperText: showError && required && !value ? utils_1.REQUIRED_FIELD_ERROR_MESSAGE : '',
                },
            }} format="yyyy-MM-dd HH:mm a"/>
      </LocalizationProvider_1.LocalizationProvider>);
    }
    if (type === 'autocomplete') {
        var options = selectsOptions[field].options;
        var foundOption = (_b = options.find(function (option) { return option.value === value; })) !== null && _b !== void 0 ? _b : options.find(function (option) { return option.value === ''; });
        var isOptionsLoaded = selectsOptions[field].status === 'loaded';
        var currentValue = renderValue ? { value: utils_1.IN_HOUSE_CONTAINED_MEDICATION_ID, label: renderValue } : foundOption;
        var autocomplete = isOptionsLoaded ? (<material_1.Autocomplete disabled={!isOptionsLoaded || !isEditable} options={options} isOptionEqualToValue={function (option, value) {
                return option.value === value.value || value.value === utils_1.IN_HOUSE_CONTAINED_MEDICATION_ID;
            }} value={currentValue} getOptionLabel={function (option) { return option.label; }} onChange={function (_e, val) { return handleChange(val === null || val === void 0 ? void 0 : val.value); }} renderInput={function (params) { return (<material_1.TextField {...params} label={label} placeholder={"Search ".concat(label)} error={showError && required && !value}/>); }}/>) : (<material_1.Skeleton variant="rectangular" width="100%" height={56}/>);
        return (<StyledFormControl data-testid={data_test_ids_1.dataTestIds.orderMedicationPage.inputField(field)} disabled={!isEditable} required={required} error={showError && required && !value}>
        {autocomplete}
        {showError && required && !value && <material_1.FormHelperText>This field is required</material_1.FormHelperText>}
      </StyledFormControl>);
    }
    if (type === 'select' && utils_2.medicationOrderFieldsWithOptions.includes(field)) {
        var options = selectsOptions[field].options;
        var isOptionsLoaded = selectsOptions[field].status === 'loaded';
        var select = isOptionsLoaded ? (<material_1.Select disabled={!isEditable} labelId={"".concat(field, "-label")} value={value !== null && value !== void 0 ? value : ''} {...(renderValue
            ? {
                renderValue: function () { return renderValue; },
            }
            : {})} onChange={function (e) { return handleChange(e.target.value); }} label={label} required={required} error={showError && required && !value} autoComplete="off">
        <material_1.MenuItem value="">Select {label}</material_1.MenuItem>
        {options.map(function (option) { return (<material_1.MenuItem key={option.value} value={option.value}>
            {option.label}
          </material_1.MenuItem>); })}
      </material_1.Select>) : (<material_1.Skeleton variant="rectangular" width="100%" height={56}/>);
        return (<StyledFormControl data-testid={data_test_ids_1.dataTestIds.orderMedicationPage.inputField(field)} disabled={!isEditable} required={required} error={showError && required && !value}>
        <material_1.InputLabel id={"".concat(field, "-label")}>{label}</material_1.InputLabel>
        {select}
        {showError && required && !value && <material_1.FormHelperText>This field is required</material_1.FormHelperText>}
      </StyledFormControl>);
    }
    return (<StyledTextField data-testid={data_test_ids_1.dataTestIds.orderMedicationPage.inputField(field)} disabled={!isEditable} autoComplete="off" fullWidth label={label} variant="outlined" value={value !== null && value !== void 0 ? value : ''} onChange={function (e) { return handleChange(e.target.value); }} type={type} {...(type === 'number' ? { inputProps: { min: 0 } } : {})} multiline={isInstruction} rows={isInstruction ? 3 : undefined} InputLabelProps={type === 'datetime' || type === 'month' || isInstruction ? { shrink: true } : undefined} required={required} error={showError && required && !value} helperText={showError && required && !value ? utils_1.REQUIRED_FIELD_ERROR_MESSAGE : ''} 
    // https://github.com/mui/material-ui/issues/7960#issuecomment-1858083123
    {...(type === 'number'
        ? { onFocus: function (e) { return e.target.addEventListener('wheel', function (e) { return e.preventDefault(); }, { passive: false }); } }
        : {})}/>);
};
exports.MedicationCardField = MedicationCardField;
exports.default = exports.MedicationCardField;
//# sourceMappingURL=MedicationCardField.js.map