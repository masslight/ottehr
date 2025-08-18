"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosisController = void 0;
var react_hook_form_1 = require("react-hook-form");
var AssessmentTab_1 = require("../../../../../telemed/features/appointment/AssessmentTab");
var DiagnosisController = function (props) {
    var name = props.name;
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<react_hook_form_1.Controller name={name} control={control} rules={{ required: true }} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
            return (<AssessmentTab_1.DiagnosesField onChange={onChange} value={value} disableForPrimary={false} error={error} label="Diagnosis" placeholder="Search diagnosis code"/>);
        }}/>);
};
exports.DiagnosisController = DiagnosisController;
//# sourceMappingURL=DiagnosisController.js.map