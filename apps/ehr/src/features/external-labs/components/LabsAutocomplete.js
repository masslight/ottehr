"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabsAutocomplete = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var telemed_1 = require("src/telemed");
var telemed_2 = require("src/telemed");
var utils_1 = require("utils");
var LabsAutocomplete = function (props) {
    var selectedLab = props.selectedLab, setSelectedLab = props.setSelectedLab;
    var _a = (0, react_1.useState)(undefined), debouncedLabSearchTerm = _a[0], setDebouncedLabSearchTerm = _a[1];
    var _b = (0, telemed_1.useGetCreateExternalLabResources)({
        search: debouncedLabSearchTerm,
    }), isFetching = _b.isFetching, data = _b.data, isError = _b.isError, resourceFetchError = _b.error;
    var labs = (data === null || data === void 0 ? void 0 : data.labs) || [];
    var debounce = (0, telemed_2.useDebounce)(800).debounce;
    var debouncedHandleLabInputChange = function (searchValue) {
        debounce(function () {
            setDebouncedLabSearchTerm(searchValue);
        });
    };
    if (resourceFetchError)
        console.log('resourceFetchError', resourceFetchError);
    return (<material_1.Autocomplete size="small" options={labs} getOptionLabel={function (option) { return (0, utils_1.nameLabTest)(option.item.itemName, option.lab.labName, false); }} noOptionsText={debouncedLabSearchTerm && labs.length === 0 ? 'No labs based on input' : 'Start typing to load labs'} value={selectedLab} onChange={function (_, newValue) { return setSelectedLab(newValue); }} loading={isFetching} renderInput={function (params) { return (<material_1.TextField required {...params} label="Lab" variant="outlined" error={isError} helperText={isError ? 'Failed to load labs list' : ''} onChange={function (e) { return debouncedHandleLabInputChange(e.target.value); }}/>); }}/>);
};
exports.LabsAutocomplete = LabsAutocomplete;
//# sourceMappingURL=LabsAutocomplete.js.map