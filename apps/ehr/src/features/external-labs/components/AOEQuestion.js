"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AOEQuestion = void 0;
// cSpell:ignore AOEYes
var material_1 = require("@mui/material");
var material_2 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var AOEDateQuestion_1 = require("./AOEDateQuestion");
var AOEFreeTextQuestion_1 = require("./AOEFreeTextQuestion");
var AOEListQuestion_1 = require("./AOEListQuestion");
var AOEMultiSelectListQuestion_1 = require("./AOEMultiSelectListQuestion");
var AOENumberQuestion_1 = require("./AOENumberQuestion");
var AOEYesNoQuestion_1 = require("./AOEYesNoQuestion");
var AOEQuestion = function (questionProps) {
    var _a = (0, react_hook_form_1.useFormContext)(), control = _a.control, errors = _a.formState.errors;
    var question = questionProps.question, answer = questionProps.answer;
    var linkId = question.linkId, text = question.text, type = question.type, required = question.required, extension = question.extension, answerOption = question.answerOption;
    var questionIsList = type === 'choice' && answerOption && extension === undefined;
    var questionIsMultiSelectList = type === 'choice' && answerOption && (extension === null || extension === void 0 ? void 0 : extension.some(function (ext) { return ext.valueString === 'multi-select list'; }));
    var defaultValue = undefined;
    if (questionIsMultiSelectList) {
        if (!answer) {
            defaultValue = [];
        }
        else {
            defaultValue = answer;
        }
    }
    else {
        defaultValue = answer === null || answer === void 0 ? void 0 : answer.join(',');
    }
    // keep components in a controlled state
    if ((questionIsList || type === 'text' || type === 'boolean') && defaultValue === undefined) {
        defaultValue = '';
    }
    if (!text) {
        throw new Error('question text is not defined');
    }
    return (
    // Athena TODO: consider Stack instead of grid...
    <material_1.Grid item xs={12}>
      <react_hook_form_1.Controller name={linkId} control={control} defaultValue={defaultValue} render={function (_a) {
            var field = _a.field;
            return (<>
            <material_2.FormControl fullWidth required={required} error={!!errors[linkId]}>
              {questionIsList && (<AOEListQuestion_1.AOEListQuestion questionText={text} linkId={linkId} answerOption={answerOption} required={required || false} isReadOnly={questionProps.isReadOnly} field={field}/>)}
              {questionIsMultiSelectList && (<AOEMultiSelectListQuestion_1.AOEMultiSelectListQuestion questionText={text} linkId={linkId} answerOption={answerOption} required={required || false} isReadOnly={questionProps.isReadOnly} field={field}/>)}
              {type === 'text' && (<AOEFreeTextQuestion_1.AOEFreeTextQuestion questionText={text} linkId={linkId} required={required || false} isReadOnly={questionProps.isReadOnly} field={field}/>)}
              {type === 'date' && extension && (<AOEDateQuestion_1.AOEDateQuestion questionText={text} linkId={linkId} extension={extension} required={required || false} isReadOnly={questionProps.isReadOnly} field={field}/>)}
              {type === 'integer' && extension && (<AOENumberQuestion_1.AOENumberQuestion questionText={text} linkId={linkId} extension={extension} required={required || false} isReadOnly={questionProps.isReadOnly} idString={"integer-".concat(linkId)} field={field}/>)}
              {type === 'decimal' && extension && (<AOENumberQuestion_1.AOENumberQuestion questionText={text} linkId={linkId} extension={extension} required={required || false} isReadOnly={questionProps.isReadOnly} idString={"decimal-".concat(linkId)} field={field}/>)}
              {type === 'boolean' && (<AOEYesNoQuestion_1.AOEYesNoQuestion questionText={text} linkId={linkId} required={required || false} isReadOnly={questionProps.isReadOnly} field={field}/>)}
              {/* {!!errors[questionText] && <FormHelperText>{errors[questionText]}</FormHelperText>} */}
            </material_2.FormControl>
          </>);
        }}/>
    </material_1.Grid>);
};
exports.AOEQuestion = AOEQuestion;
//# sourceMappingURL=AOEQuestion.js.map