"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultEntrySelect = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var ResultEntrySelect = function (_a) {
    var testItemComponent = _a.testItemComponent, isAbnormal = _a.isAbnormal, setIsAbnormal = _a.setIsAbnormal, disabled = _a.disabled;
    var control = (0, react_hook_form_1.useFormContext)().control;
    var theme = (0, material_1.useTheme)();
    var assessAbnormality = function (entry) {
        if (testItemComponent.dataType === 'CodeableConcept' && testItemComponent.abnormalValues) {
            console.log('entry', entry);
            if (testItemComponent.abnormalValues.map(function (val) { return val.code; }).includes(entry)) {
                setIsAbnormal(true);
            }
            else {
                setIsAbnormal(false);
            }
        }
    };
    var values = [];
    if (testItemComponent.dataType === 'CodeableConcept') {
        values = testItemComponent.valueSet;
    }
    return (<material_1.FormControl sx={{
            width: '80%',
            '& .MuiOutlinedInput-root': {
                color: isAbnormal ? 'error.main' : '',
                '& fieldset': {
                    borderColor: isAbnormal ? 'error.main' : '',
                },
                '&:hover fieldset': {
                    borderColor: isAbnormal ? 'error.dark' : '',
                },
                '&.Mui-focused fieldset': {
                    borderColor: isAbnormal ? 'error.dark' : '',
                },
                '&.Mui-disabled': {
                    '& fieldset': {
                        borderColor: isAbnormal ? 'error.dark' : '',
                    },
                },
            },
            '& .MuiSelect-select.Mui-disabled': {
                color: isAbnormal ? 'error.dark' : 'text.primary',
                WebkitTextFillColor: isAbnormal ? theme.palette.error.dark : theme.palette.text.primary,
            },
        }} size="small">
      <react_hook_form_1.Controller name={testItemComponent.observationDefinitionId} control={control} rules={{ required: 'Please select a value' }} defaultValue="" render={function (_a) {
            var field = _a.field;
            return (<material_1.Select disabled={!!disabled} fullWidth id="result-entry-select" {...field} onChange={function (e) {
                    field.onChange(e);
                    assessAbnormality(e.target.value);
                }}>
            {values === null || values === void 0 ? void 0 : values.map(function (val, idx) { return (<material_1.MenuItem id={"".concat(val, "-").concat(idx, "-id")} key={"".concat(val, "-").concat(idx, "-key")} value={val.code}>
                {val.display}
              </material_1.MenuItem>); })}
          </material_1.Select>);
        }}/>
    </material_1.FormControl>);
};
exports.ResultEntrySelect = ResultEntrySelect;
//# sourceMappingURL=ResultEntrySelect.js.map