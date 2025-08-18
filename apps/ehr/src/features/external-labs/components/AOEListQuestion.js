"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AOEListQuestion = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var AOEListQuestion = function (props) {
    // single select dropdown
    var errors = (0, react_hook_form_1.useFormContext)().formState.errors;
    var questionText = props.questionText, linkId = props.linkId, answerOption = props.answerOption, isReadOnly = props.isReadOnly, field = props.field;
    var labelId = "select-".concat(linkId, "-label");
    return (<>
      <material_1.InputLabel id={labelId}>{questionText}</material_1.InputLabel>
      <material_1.Select {...field} labelId={labelId} id={"select-".concat(linkId)} label={questionText} error={!!errors[linkId]} readOnly={isReadOnly}>
        {answerOption.map(function (option, idx) { return (<material_1.MenuItem key={idx} value={option.valueString}>
            {option.valueString}
          </material_1.MenuItem>); })}
      </material_1.Select>
    </>);
};
exports.AOEListQuestion = AOEListQuestion;
//# sourceMappingURL=AOEListQuestion.js.map