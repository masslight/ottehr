"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultEntryRadioButton = void 0;
var RadioButtonChecked_1 = require("@mui/icons-material/RadioButtonChecked");
var RadioButtonUnchecked_1 = require("@mui/icons-material/RadioButtonUnchecked");
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var ABNORMAL_FONT_COLOR = '#F44336';
var ABNORMAL_RADIO_COLOR_STYLING = {
    color: ABNORMAL_FONT_COLOR,
    '&.Mui-checked': {
        color: ABNORMAL_FONT_COLOR,
    },
};
var NORMAL_FONT_COLOR = '#4CAF50';
var NORMAL_RADIO_COLOR_STYLING = {
    color: NORMAL_FONT_COLOR,
    '&.Mui-checked': {
        color: NORMAL_FONT_COLOR,
    },
};
var NEUTRAL_RADIO_STYLING = {
    color: 'primary.main',
    '&.Mui-disabled': {
        color: 'primary.main',
        '& .MuiSvgIcon-root': {
            fill: 'primary.main',
        },
    },
};
var ResultEntryRadioButton = function (_a) {
    var _b;
    var testItemComponent = _a.testItemComponent, disabled = _a.disabled;
    var nullCode = (_b = testItemComponent.nullOption) === null || _b === void 0 ? void 0 : _b.code;
    var control = (0, react_hook_form_1.useFormContext)().control;
    var isChecked = function (curValueCode, selectedValue) {
        return curValueCode === selectedValue;
    };
    var isNeutral = !testItemComponent.abnormalValues.length;
    var isAbnormal = function (curValueCode) {
        if (isNeutral)
            return false;
        return testItemComponent.abnormalValues.map(function (val) { return val.code; }).includes(curValueCode);
    };
    var radioStylingColor = function (curValueCode, selectedValue) {
        if (isChecked(curValueCode, selectedValue)) {
            if (!isNeutral) {
                return isAbnormal(curValueCode) ? ABNORMAL_RADIO_COLOR_STYLING : NORMAL_RADIO_COLOR_STYLING;
            }
            else {
                return NEUTRAL_RADIO_STYLING;
            }
        }
        return undefined;
    };
    var typographyStyling = function (curValueCode, selectedValue) {
        if (selectedValue) {
            var valIsChecked = isChecked(curValueCode, selectedValue);
            if (valIsChecked && isNeutral)
                return { fontWeight: 'bold' };
            if (valIsChecked) {
                if (isAbnormal(curValueCode)) {
                    return {
                        color: ABNORMAL_FONT_COLOR,
                        fontWeight: 'bold',
                    };
                }
                else {
                    return {
                        color: NORMAL_FONT_COLOR,
                        fontWeight: 'bold',
                    };
                }
            }
            else {
                return {
                    color: 'text.disabled',
                    fontWeight: 'bold',
                };
            }
        }
        else {
            if (isNeutral)
                return { fontWeight: 'bold' };
            if (isAbnormal(curValueCode)) {
                return {
                    color: ABNORMAL_FONT_COLOR,
                    fontWeight: 'bold',
                };
            }
            else {
                return {
                    color: NORMAL_FONT_COLOR,
                    fontWeight: 'bold',
                };
            }
        }
    };
    var getBackgroundColor = function (curValue, selectedValue) {
        if (isChecked(curValue, selectedValue) && !isNeutral) {
            return isAbnormal(curValue) ? '#FFEBEE' : '#E8F5E9';
        }
        else {
            return 'transparent';
        }
    };
    var finalViewNullOptionCheckboxStyling = function (curValue) {
        var isFinalView = !!disabled;
        if (isFinalView) {
            var isChecked_1 = curValue === nullCode;
            if (isChecked_1) {
                return NEUTRAL_RADIO_STYLING;
            }
            else {
                return {};
            }
        }
        return {};
    };
    var finalViewNullOptionCheckboxLabelStyling = function (curValue) {
        var isFinalView = !!disabled;
        if (isFinalView) {
            var isChecked_2 = curValue === nullCode;
            if (isChecked_2) {
                return {
                    color: 'text.primary',
                    '& .MuiFormControlLabel-label': {
                        color: 'text.primary',
                    },
                    '&.Mui-disabled .MuiFormControlLabel-label': {
                        color: 'text.primary',
                    },
                };
            }
            else {
                return {};
            }
        }
        return {};
    };
    return (<react_hook_form_1.Controller name={testItemComponent.observationDefinitionId} control={control} rules={{ required: 'Please select a value' }} defaultValue={''} render={function (_a) {
            var field = _a.field;
            return (<>
          <material_1.RadioGroup value={field.value === nullCode ? '' : field.value} onChange={function (e) { return field.onChange(e.target.value); }}>
            <material_1.Grid container spacing={2}>
              {testItemComponent.valueSet.map(function (valueCode) { return (<material_1.Grid item xs={6} key={valueCode.code}>
                  <material_1.FormControlLabel value={valueCode.code} control={<material_1.Radio sx={radioStylingColor(valueCode.code, field.value)} disabled={!!disabled}/>} label={<material_1.Typography sx={typographyStyling(valueCode.code, field.value)}>{valueCode.display}</material_1.Typography>} sx={{
                        margin: 0,
                        padding: 2,
                        width: '100%',
                        border: '1px solid #E0E0E0',
                        borderRadius: 1,
                        backgroundColor: getBackgroundColor(valueCode.code, field.value),
                    }}/>
                </material_1.Grid>); })}
            </material_1.Grid>
          </material_1.RadioGroup>

          {testItemComponent.nullOption && (<material_1.Box mt={2}>
              <material_1.FormControlLabel control={<material_1.Checkbox icon={<RadioButtonUnchecked_1.default />} checkedIcon={<RadioButtonChecked_1.default />} disabled={!!disabled} checked={field.value === nullCode} onChange={function () { return field.onChange(field.value === nullCode ? '' : nullCode); }} sx={disabled ? finalViewNullOptionCheckboxStyling(field.value) : {}}/>} label={testItemComponent.nullOption.text} sx={disabled ? finalViewNullOptionCheckboxLabelStyling(field.value) : {}}/>
            </material_1.Box>)}
        </>);
        }}/>);
};
exports.ResultEntryRadioButton = ResultEntryRadioButton;
//# sourceMappingURL=ResultEntryRadioButton.js.map