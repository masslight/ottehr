"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AOEYesNoQuestion = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var radioStyles = {
    '&.Mui-disabled': {
        color: 'primary.main',
    },
    '& .MuiSvgIcon-root': {
        color: 'primary.main',
    },
};
var labelStyles = {
    '&.Mui-disabled .MuiTypography-root': {
        color: colors_1.otherColors.tableRow,
    },
    '&.MuiFormControlLabel-root.Mui-disabled .MuiTypography-root': {
        color: colors_1.otherColors.tableRow,
    },
};
// cSpell:disable-next AOEYes
var AOEYesNoQuestion = function (props) {
    var _ = (0, react_hook_form_1.useFormContext)().formState.errors;
    var questionText = props.questionText, linkId = props.linkId, required = props.required, isReadOnly = props.isReadOnly, field = props.field;
    var labelId = "boolean-".concat(linkId, "-label");
    return (<>
      <material_1.FormLabel id={labelId}>{questionText}</material_1.FormLabel>
      <material_1.RadioGroup {...field} row aria-labelledby={labelId} name={"".concat(labelId, "-row-radio-buttons-group")}>
        <material_1.FormControlLabel value="true" control={<material_1.Radio disabled={isReadOnly} inputProps={{ required: required }} sx={radioStyles}/>} label="Yes" sx={labelStyles}/>
        <material_1.FormControlLabel value="false" control={<material_1.Radio disabled={isReadOnly} inputProps={{ required: required }} sx={radioStyles}/>} label="No" sx={labelStyles}/>
      </material_1.RadioGroup>
    </>);
};
exports.AOEYesNoQuestion = AOEYesNoQuestion;
//# sourceMappingURL=AOEYesNoQuestion.js.map