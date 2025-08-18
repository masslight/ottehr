"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitalsTemperature = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var utils_2 = require("utils");
var getSelectors_1 = require("../../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../../hooks");
var state_1 = require("../../../../../state");
var utils_3 = require("../../../../../utils");
var NumberInput_1 = require("../NumberInput");
var VitalsTemperature = function (props) {
    var _a, _b;
    var validate = props.validate;
    var _c = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'appointment',
        'questionnaireResponse',
    ]), appointment = _c.appointment, questionnaireResponse = _c.questionnaireResponse;
    var defaultValue = (_b = (_a = (0, utils_2.getQuestionnaireResponseByLinkId)('vitals-temperature', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0].valueString;
    var _d = (0, react_hook_form_1.useForm)({
        defaultValues: {
            'vitals-temperature': (defaultValue === 'N/A' ? '' : defaultValue) || '',
        },
    }), control = _d.control, handleSubmit = _d.handleSubmit, watch = _d.watch, setValue = _d.setValue, getValues = _d.getValues;
    var mutate = (0, state_1.useUpdatePaperwork)().mutate;
    var _e = (0, hooks_1.useDebounce)(1000), debounce = _e.debounce, clear = _e.clear;
    var _f = (0, react_1.useState)((0, utils_1.convertTemperature)(getValues('vitals-temperature'), 'fahrenheit')), f = _f[0], setF = _f[1];
    var onSubmit = (0, react_1.useCallback)(function (value) {
        debounce(function () {
            mutate({
                appointmentID: appointment.id,
                paperwork: {
                    'vitals-temperature': value['vitals-temperature'] || 'N/A',
                },
            }, {
                onSuccess: function () {
                    (0, utils_3.updateQuestionnaireResponse)(questionnaireResponse, 'vitals-temperature', value['vitals-temperature'] || 'N/A');
                },
            });
        });
    }, [debounce, mutate, appointment, questionnaireResponse]);
    (0, react_1.useEffect)(function () {
        var subscription = watch(function () { return handleSubmit(onSubmit)(); });
        return function () { return subscription.unsubscribe(); };
    }, [handleSubmit, watch, onSubmit]);
    return (<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1.5 }}>
      <react_hook_form_1.Controller name="vitals-temperature" control={control} rules={{
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
            return (<NumberInput_1.NumberInput helperText={error ? error.message : null} error={!!error} label="Temp, C" value={value} onChange={function (e) {
                    onChange(e);
                    setF((0, utils_1.convertTemperature)(e.target.value, 'fahrenheit'));
                }}/>);
        }}/>
      <material_1.Typography>/</material_1.Typography>
      <NumberInput_1.NumberInput label="Temp, F" value={f} onChange={function (e) {
            setF(e.target.value);
            setValue('vitals-temperature', (0, utils_1.convertTemperature)(e.target.value, 'celsius'));
        }}/>
    </material_1.Box>);
};
exports.VitalsTemperature = VitalsTemperature;
//# sourceMappingURL=VitalsTemperature.js.map