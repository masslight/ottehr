"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabsAutocompleteForPatient = void 0;
var material_1 = require("@mui/material");
var LabsAutocompleteForPatient = function (_a) {
    var patientLabItems = _a.patientLabItems, selectedLabItem = _a.selectedLabItem, setSelectedLabItem = _a.setSelectedLabItem, _b = _a.loading, loading = _b === void 0 ? false : _b, _c = _a.error, error = _c === void 0 ? false : _c, _d = _a.helperText, helperText = _d === void 0 ? '' : _d, _e = _a.label, label = _e === void 0 ? 'Test Type' : _e, _f = _a.required, required = _f === void 0 ? false : _f;
    var selectedPatientLabItem = selectedLabItem
        ? {
            code: selectedLabItem.item.itemCode,
            display: selectedLabItem.item.itemName,
        }
        : null;
    var handleChange = function (_, newValue) {
        if (newValue) {
            var orderableItem = {
                item: {
                    itemCode: newValue.code,
                    itemName: newValue.display,
                    itemLoinc: newValue.code,
                },
                lab: { labName: '' },
            };
            setSelectedLabItem(orderableItem);
        }
        else {
            setSelectedLabItem(null);
        }
    };
    return (<material_1.Autocomplete size="small" options={patientLabItems} getOptionLabel={function (option) { return "".concat(option.display, " (").concat(option.code, ")"); }} noOptionsText="No lab tests available for this patient" value={selectedPatientLabItem} onChange={handleChange} loading={loading} isOptionEqualToValue={function (option, value) { return option.code === value.code; }} renderInput={function (params) { return (<material_1.TextField required={required} {...params} label={label} variant="outlined" error={error} helperText={helperText}/>); }}/>);
};
exports.LabsAutocompleteForPatient = LabsAutocompleteForPatient;
//# sourceMappingURL=LabsAutocompleteForPatient.js.map