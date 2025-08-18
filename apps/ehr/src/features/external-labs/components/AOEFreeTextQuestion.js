"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AOEFreeTextQuestion = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var AOEFreeTextQuestion = function (props) {
    // free text field
    var errors = (0, react_hook_form_1.useFormContext)().formState.errors;
    var questionText = props.questionText, linkId = props.linkId, required = props.required, isReadOnly = props.isReadOnly, field = props.field;
    return (<material_1.TextField {...field} id={"free-text-".concat(linkId)} label={questionText} sx={{ width: '100%' }} required={required} error={!!errors[linkId]} 
    // max length for labs input is 150 chararacters https://github.com/masslight/ottehr/issues/2467
    inputProps={{ readOnly: isReadOnly, maxLength: 150 }}/>);
};
exports.AOEFreeTextQuestion = AOEFreeTextQuestion;
//# sourceMappingURL=AOEFreeTextQuestion.js.map