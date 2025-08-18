"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitalsBloodPressure = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../../hooks");
var state_1 = require("../../../../../state");
var utils_2 = require("../../../../../utils");
var NumberInput_1 = require("../NumberInput");
var VitalsBloodPressure = function (props) {
    var _a, _b, _c, _d;
    var validate = props.validate;
    var _e = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'appointment',
        'questionnaireResponse',
    ]), appointment = _e.appointment, questionnaireResponse = _e.questionnaireResponse;
    var defaultValue = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('vitals-bp', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString;
    var _f = (0, react_hook_form_1.useForm)({
        defaultValues: {
            'vitals-bp': (defaultValue === 'N/A' ? '' : defaultValue) || '',
        },
    }), control = _f.control, handleSubmit = _f.handleSubmit, watch = _f.watch, setValue = _f.setValue, getValues = _f.getValues;
    var mutate = (0, state_1.useUpdatePaperwork)().mutate;
    var _g = (0, hooks_1.useDebounce)(1000), debounce = _g.debounce, clear = _g.clear;
    var _h = (0, react_1.useState)((_d = getValues('vitals-bp')) !== null && _d !== void 0 ? _d : '/'), _bp = _h[0], setBp = _h[1];
    var onSubmit = (0, react_1.useCallback)(function (value) {
        debounce(function () {
            mutate({
                appointmentID: appointment.id,
                paperwork: {
                    'vitals-bp': value['vitals-bp'] || 'N/A',
                },
            }, {
                onSuccess: function () {
                    (0, utils_2.updateQuestionnaireResponse)(questionnaireResponse, 'vitals-bp', value['vitals-bp'] || 'N/A');
                },
            });
        });
    }, [debounce, mutate, appointment, questionnaireResponse]);
    (0, react_1.useEffect)(function () {
        var subscription = watch(function () { return handleSubmit(onSubmit)(); });
        return function () { return subscription.unsubscribe(); };
    }, [handleSubmit, watch, onSubmit]);
    return (<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1.5 }}>
      <react_hook_form_1.Controller name="vitals-bp" control={control} rules={{
            validate: function (value) {
                var result = validate(value);
                if (result) {
                    clear();
                    return result;
                }
                return;
            },
        }} render={function (_a) {
            var _b, _c, _d, _e;
            var _f = _a.field, value = _f.value, onChange = _f.onChange, error = _a.fieldState.error;
            var _g = value.split('/'), systolic = _g[0], diastolic = _g[1];
            var systolicError = (_b = error === null || error === void 0 ? void 0 : error.message) === null || _b === void 0 ? void 0 : _b.startsWith('Systolic ');
            var systolicErrorMessage = systolicError && ((_c = error === null || error === void 0 ? void 0 : error.message) === null || _c === void 0 ? void 0 : _c.split('Systolic ')[1]);
            var diastolicError = (_d = error === null || error === void 0 ? void 0 : error.message) === null || _d === void 0 ? void 0 : _d.startsWith('Diastolic ');
            var diastolicErrorMessage = diastolicError && ((_e = error === null || error === void 0 ? void 0 : error.message) === null || _e === void 0 ? void 0 : _e.split('Diastolic ')[1]);
            return (<>
              <NumberInput_1.NumberInput helperText={error && systolicError ? systolicErrorMessage : null} error={!!systolicError} label="BP Systolic, mmHg" value={systolic} onChange={function (e) {
                    var newBp = "".concat(e.target.value, "/").concat(diastolic);
                    onChange(e);
                    setBp(newBp);
                    setValue('vitals-bp', newBp);
                }}/>
              <material_1.Typography>/</material_1.Typography>
              <NumberInput_1.NumberInput helperText={error && diastolicError ? diastolicErrorMessage : null} error={!!diastolicError} label="BP Diastolic, mmHg" value={diastolic} onChange={function (e) {
                    var newBp = "".concat(systolic, "/").concat(e.target.value);
                    onChange(e);
                    setBp(newBp);
                    setValue('vitals-bp', newBp);
                }}/>
            </>);
        }}/>
    </material_1.Box>);
};
exports.VitalsBloodPressure = VitalsBloodPressure;
//# sourceMappingURL=VitalsBloodPressure.js.map