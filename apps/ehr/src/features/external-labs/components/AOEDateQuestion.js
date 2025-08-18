"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AOEDateQuestion = void 0;
var x_date_pickers_1 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var react_hook_form_1 = require("react-hook-form");
var AOEDateQuestion = function (props) {
    var errors = (0, react_hook_form_1.useFormContext)().formState.errors;
    var questionText = props.questionText, linkId = props.linkId, _ = props.extension, required = props.required, isReadOnly = props.isReadOnly, field = props.field;
    return (<>
      <x_date_pickers_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
        <x_date_pickers_1.DatePicker {...field} label={questionText} format={'MM/dd/yyyy'} slotProps={{
            textField: {
                style: { width: '100%' },
                required: required,
                id: "date-".concat(linkId),
                error: !!errors[linkId],
            },
            actionBar: { actions: ['today'] },
        }} readOnly={isReadOnly}/>
      </x_date_pickers_1.LocalizationProvider>
    </>);
};
exports.AOEDateQuestion = AOEDateQuestion;
//# sourceMappingURL=AOEDateQuestion.js.map