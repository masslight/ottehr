"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitalsComponent = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../../hooks");
var state_1 = require("../../../../../state");
var utils_2 = require("../../../../../utils");
var NumberInput_1 = require("../NumberInput");
var VitalsComponent = function (props) {
    var _a;
    var _b, _c, _d;
    var name = props.name, label = props.label, validate = props.validate;
    var _e = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'appointment',
        'questionnaireResponse',
    ]), appointment = _e.appointment, questionnaireResponse = _e.questionnaireResponse;
    var defaultValue = (_d = (_c = (_b = (0, utils_1.getQuestionnaireResponseByLinkId)(name, questionnaireResponse)) === null || _b === void 0 ? void 0 : _b.answer) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.valueString;
    var _f = (0, react_hook_form_1.useForm)({
        defaultValues: (_a = {},
            _a[name] = (defaultValue === 'N/A' ? '' : defaultValue) || '',
            _a),
    }), control = _f.control, handleSubmit = _f.handleSubmit, watch = _f.watch;
    var mutate = (0, state_1.useUpdatePaperwork)().mutate;
    var _g = (0, hooks_1.useDebounce)(1000), debounce = _g.debounce, clear = _g.clear;
    var onSubmit = (0, react_1.useCallback)(function (value) {
        debounce(function () {
            var _a;
            mutate({
                appointmentID: appointment.id,
                paperwork: (_a = {},
                    _a[name] = value[name] || 'N/A',
                    _a),
            }, {
                onSuccess: function () {
                    (0, utils_2.updateQuestionnaireResponse)(questionnaireResponse, name, value[name] || 'N/A');
                },
            });
        });
    }, [questionnaireResponse, debounce, mutate, appointment, name]);
    (0, react_1.useEffect)(function () {
        var subscription = watch(function () { return handleSubmit(onSubmit)(); });
        return function () { return subscription.unsubscribe(); };
    }, [handleSubmit, watch, onSubmit]);
    return (<react_hook_form_1.Controller name={name} control={control} rules={{
            validate: function (value) {
                var result = validate(value);
                if (result) {
                    clear();
                    return result;
                }
                return;
            },
        }} render={function (_a) {
            var _b = _a.field, value = _b.value, onChange = _b.onChange, error = _a.fieldState.error;
            return (<NumberInput_1.NumberInput helperText={error ? error.message : null} error={!!error} label={label} value={value} onChange={onChange} sx={{ flex: 1 }}/>);
        }}/>);
};
exports.VitalsComponent = VitalsComponent;
//# sourceMappingURL=VitalsComponent.js.map