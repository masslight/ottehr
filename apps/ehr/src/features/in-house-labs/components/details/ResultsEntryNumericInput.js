"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultEntryNumericInput = void 0;
var material_1 = require("@mui/material");
// import InputMask from 'src/components/InputMask';
var react_hook_form_1 = require("react-hook-form");
var ResultEntryNumericInput = function (_a) {
    var testItemComponent = _a.testItemComponent, isAbnormal = _a.isAbnormal, setIsAbnormal = _a.setIsAbnormal, disabled = _a.disabled;
    var control = (0, react_hook_form_1.useFormContext)().control;
    var theme = (0, material_1.useTheme)();
    var assessAbnormality = function (entry) {
        if (testItemComponent.dataType === 'Quantity' &&
            testItemComponent.normalRange.low &&
            testItemComponent.normalRange.high) {
            var entryNum = parseFloat(entry);
            var _a = testItemComponent.normalRange, high = _a.high, low = _a.low;
            // todo double check with product team if this is inclusive on both ends
            // meaning it would be abnormal if it is strictly greater or strictly less than (but not equal)
            if (entryNum > high || entryNum < low)
                setIsAbnormal(true);
            if (entryNum <= high && entryNum >= low)
                setIsAbnormal(false);
        }
    };
    return (<react_hook_form_1.Controller name={testItemComponent.observationDefinitionId} control={control} rules={{ required: 'Please enter a value' }} defaultValue="" render={function (_a) {
            var field = _a.field;
            return (<material_1.TextField disabled={!!disabled} {...field} onChange={function (e) {
                    var value = e.target.value;
                    field.onChange(value);
                    assessAbnormality(value);
                }} type="text" error={isAbnormal} sx={{
                    width: '80%',
                    '& .Mui-disabled': {
                        color: isAbnormal ? 'error.dark' : '',
                        WebkitTextFillColor: isAbnormal ? theme.palette.error.dark : theme.palette.text.primary,
                    },
                    '& .MuiOutlinedInput-root': {
                        '&.Mui-disabled': {
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: isAbnormal ? 'error.dark' : '',
                            },
                        },
                    },
                }} size="small" InputProps={{
                    // inputComponent: InputMask as any,
                    inputProps: {
                        mask: Number,
                        radix: '.',
                        padFractionalZeros: true,
                    },
                }} defaultValue={''}/>);
        }}/>);
};
exports.ResultEntryNumericInput = ResultEntryNumericInput;
//# sourceMappingURL=ResultsEntryNumericInput.js.map