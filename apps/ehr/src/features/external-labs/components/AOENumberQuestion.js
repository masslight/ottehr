"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AOENumberQuestion = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var InputMask_1 = require("../../../components/InputMask");
var AOENumberQuestion = function (props) {
    var _a;
    var errors = (0, react_hook_form_1.useFormContext)().formState.errors;
    // Note: the extension will tell you the necessary number validation. See Oystehr docs for full explanation
    var questionText = props.questionText, linkId = props.linkId, extension = props.extension, required = props.required, isReadOnly = props.isReadOnly, idString = props.idString, field = props.field;
    // splitting out the RHF passed ref here so it gets passed correctly to the styled component
    var fieldRef = field.ref, otherField = __rest(field, ["ref"]);
    var numberType = (_a = extension.find(function (extensionTemp) {
        return extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/formatted-input-requirement';
    })) === null || _a === void 0 ? void 0 : _a.valueString;
    if (!numberType) {
        throw new Error('numberType is not defined');
    }
    var maxNumber = +numberType.replaceAll('#', '9'); // replace #s with 9s, example ###.## -> 999.99
    if (!maxNumber) {
        throw new Error('maxNumber is not a number');
    }
    // if numberType is ###.## then `decimals` will be 2
    var decimals = null;
    if (numberType === null || numberType === void 0 ? void 0 : numberType.includes('.')) {
        decimals = numberType === null || numberType === void 0 ? void 0 : numberType.split('.')[1].length;
    }
    return (<material_1.TextField type="text" placeholder={numberType.replace(/#/g, '0')} {...otherField} inputRef={fieldRef} id={idString} label={questionText} sx={{ width: '100%' }} size="medium" required={required} error={!!errors[linkId]} InputProps={{
            inputComponent: InputMask_1.default,
            inputProps: {
                mask: Number,
                radix: '.',
                min: -maxNumber,
                max: maxNumber,
                padFractionalZeros: true,
                scale: decimals,
                // step: decimals ? `0.${'0'.padStart(decimals - 1, '0')}1` : null,
                readOnly: isReadOnly,
            },
        }}/>);
};
exports.AOENumberQuestion = AOENumberQuestion;
//# sourceMappingURL=AOENumberQuestion.js.map