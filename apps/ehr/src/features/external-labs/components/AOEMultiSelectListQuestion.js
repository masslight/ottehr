"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AOEMultiSelectListQuestion = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var AOEMultiSelectListQuestion = function (props) {
    // multi select dropdown
    var errors = (0, react_hook_form_1.useFormContext)().formState.errors;
    var questionText = props.questionText, linkId = props.linkId, answerOption = props.answerOption, isReadOnly = props.isReadOnly, field = props.field;
    var labelId = "multi-select-".concat(linkId, "-label");
    return (<>
      <material_1.InputLabel id={labelId}>{questionText}</material_1.InputLabel>
      <material_1.Select {...field} labelId={labelId} id={"multi-select-".concat(linkId)} label={questionText} multiple error={!!errors[linkId]} input={<material_1.OutlinedInput id="select-multiple-chip" label={questionText}/>} // the label here has to match the label on the input and select otherwise the label won't size properly
     renderValue={function (selected) { return (<material_1.Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected === null || selected === void 0 ? void 0 : selected.map(function (value, idx) { return <material_1.Chip key={idx} label={value}/>; })}
          </material_1.Box>); }} readOnly={isReadOnly}>
        {answerOption.map(function (option, idx) { return (<material_1.MenuItem key={idx} value={option.valueString}>
            {option.valueString}
          </material_1.MenuItem>); })}
      </material_1.Select>
    </>);
};
exports.AOEMultiSelectListQuestion = AOEMultiSelectListQuestion;
//# sourceMappingURL=AOEMultiSelectListQuestion.js.map