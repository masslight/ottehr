"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicalDecisionField = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var MedicalDecisionField = function (_a) {
    var _b, _c;
    var loading = _a.loading, setIsUpdating = _a.setIsUpdating;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: {
            medicalDecision: ((_b = chartData === null || chartData === void 0 ? void 0 : chartData.medicalDecision) === null || _b === void 0 ? void 0 : _b.text) || '',
        },
    });
    var control = methods.control;
    var _d = (0, hooks_1.useDebounceNotesField)('medicalDecision'), onValueChange = _d.onValueChange, isLoading = _d.isLoading;
    (0, react_1.useEffect)(function () {
        setIsUpdating(isLoading);
    }, [isLoading, setIsUpdating]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (((_a = chartData === null || chartData === void 0 ? void 0 : chartData.medicalDecision) === null || _a === void 0 ? void 0 : _a.text) && !methods.getValues('medicalDecision')) {
            methods.setValue('medicalDecision', chartData.medicalDecision.text);
        }
    }, [(_c = chartData === null || chartData === void 0 ? void 0 : chartData.medicalDecision) === null || _c === void 0 ? void 0 : _c.text, methods]);
    return (<react_hook_form_1.Controller name="medicalDecision" control={control} render={function (_a) {
            var _b = _a.field, value = _b.value, onChange = _b.onChange;
            return (<material_1.TextField data-testid={data_test_ids_1.dataTestIds.assessmentCard.medicalDecisionField} value={value} onChange={function (e) {
                    onChange(e);
                    onValueChange(e.target.value);
                }} size="small" label="Medical Decision Making *" fullWidth multiline disabled={loading}/>);
        }}/>);
};
exports.MedicalDecisionField = MedicalDecisionField;
//# sourceMappingURL=MedicalDecisionField.js.map