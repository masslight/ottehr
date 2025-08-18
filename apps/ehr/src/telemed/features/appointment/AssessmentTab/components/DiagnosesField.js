"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosesField = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var DiagnosesField = function (props) {
    var onChange = props.onChange, disabled = props.disabled, disableForPrimary = props.disableForPrimary, value = props.value, label = props.label, placeholder = props.placeholder, error = props.error;
    var _a = (0, react_1.useState)(''), debouncedSearchTerm = _a[0], setDebouncedSearchTerm = _a[1];
    var _b = (0, state_1.useGetIcd10Search)({ search: debouncedSearchTerm, sabs: 'ICD10CM' }), isSearching = _b.isFetching, data = _b.data;
    var icdSearchOptions = (data === null || data === void 0 ? void 0 : data.codes) || [];
    var debounce = (0, hooks_1.useDebounce)(800).debounce;
    var debouncedHandleInputChange = function (data) {
        debounce(function () {
            setDebouncedSearchTerm(data);
        });
    };
    var onInternalChange = function (_e, data) {
        if (data) {
            onChange(data);
        }
    };
    return (<material_1.Autocomplete fullWidth blurOnSelect disabled={disabled} options={icdSearchOptions} noOptionsText={debouncedSearchTerm && icdSearchOptions.length === 0
            ? 'Nothing found for this search criteria'
            : 'Start typing to load results'} autoComplete includeInputInList disableClearable filterOptions={function (x) { return x; }} value={value || null} isOptionEqualToValue={function (option, value) { return value.code === option.code; }} loading={isSearching} onChange={onInternalChange} getOptionLabel={function (option) { return (typeof option === 'string' ? option : "".concat(option.code, " ").concat(option.display)); }} getOptionDisabled={function (option) { return disableForPrimary && option.code.startsWith('W'); }} renderInput={function (params) { return (<material_1.TextField {...params} data-testid={data_test_ids_1.dataTestIds.diagnosisContainer.diagnosisDropdown} onChange={function (e) { return debouncedHandleInputChange(e.target.value); }} size="small" label={label || 'Search'} placeholder={placeholder || 'Diagnoses'} helperText={error ? error.message : null} error={!!error}/>); }}/>);
};
exports.DiagnosesField = DiagnosesField;
//# sourceMappingURL=DiagnosesField.js.map