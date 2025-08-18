"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MusculoskeletalForm = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../../components/RoundedButton");
var components_1 = require("../../../../components");
var useExamObservations_1 = require("../../../../hooks/useExamObservations");
var StatelessExamCheckbox_1 = require("./StatelessExamCheckbox");
var MusculoskeletalForm = function () {
    var _a = (0, useExamObservations_1.useExamObservations)(utils_1.musculoskeletalFields), fields = _a.value, update = _a.update, isLoading = _a.isLoading;
    var abnormalFields = fields.filter(function (field) { return field.value; });
    var _b = (0, react_1.useState)(abnormalFields.length > 0), value = _b[0], setValue = _b[1];
    var _c = (0, react_1.useState)([]), savedFields = _c[0], setSavedFields = _c[1];
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: {
            side: 'left',
            bodyPart: null,
            finger: null,
            toe: null,
            abnormal: null,
        },
    });
    var control = methods.control, handleSubmit = methods.handleSubmit, watch = methods.watch, reset = methods.reset;
    var onAdd = function (data) {
        var arr = [];
        arr.push(data.abnormal);
        arr.push(data.side);
        arr.push(data.bodyPart);
        switch (data.bodyPart) {
            case 'finger':
                arr.push(data.finger);
                break;
            case 'toe':
                arr.push(data.toe);
                break;
        }
        var fieldName = arr.join('-');
        var field = fields.find(function (field) { return field.field === fieldName; });
        update(__assign(__assign({}, field), { value: true }));
        reset();
    };
    var onRemove = function (name) {
        var field = fields.find(function (field) { return field.field === name; });
        update(__assign(__assign({}, field), { value: false }));
    };
    var onBooleanChange = function (value) {
        setValue(value);
        if (value) {
            if (savedFields.length > 0) {
                update(savedFields.map(function (field) { return (__assign(__assign({}, field), { value: true })); }));
            }
        }
        else {
            setSavedFields(abnormalFields);
            if (abnormalFields.length > 0) {
                update(abnormalFields.map(function (field) { return (__assign(__assign({}, field), { value: false })); }));
            }
        }
    };
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
        }}>
      <StatelessExamCheckbox_1.StatelessExamCheckbox abnormal label="Abnormal" checked={value} onChange={onBooleanChange} disabled={isLoading}/>

      {abnormalFields.length > 0 && (<material_1.Box sx={{ width: '100%' }}>
          <components_1.ActionsList data={abnormalFields} getKey={function (value) { return value.field; }} renderItem={function (value) { return <material_1.Typography>{(0, utils_1.parseMusculoskeletalFieldToName)(value.field)}</material_1.Typography>; }} renderActions={function (value) { return <components_1.DeleteIconButton disabled={isLoading} onClick={function () { return onRemove(value.field); }}/>; }} divider gap={0.5}/>
        </material_1.Box>)}

      {value && (<react_hook_form_1.FormProvider {...methods}>
          <material_1.Box sx={{
                p: 2,
                backgroundColor: colors_1.otherColors.formCardBg,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                borderRadius: 2,
            }}>
            <react_hook_form_1.Controller name="side" control={control} rules={{
                required: true,
            }} render={function (_a) {
                var _b = _a.field, onChange = _b.onChange, value = _b.value;
                return (<material_1.RadioGroup value={value} onChange={onChange} row>
                  {utils_1.musculoskeletalSideOptions.map(function (singleOption) { return (<material_1.FormControlLabel key={singleOption.value} value={singleOption.value} label={singleOption.label} control={<material_1.Radio size="small"/>}/>); })}
                </material_1.RadioGroup>);
            }}/>
            <react_hook_form_1.Controller name="bodyPart" control={control} rules={{
                required: true,
            }} render={function (_a) {
                var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
                return (<material_1.Autocomplete options={Object.keys(utils_1.musculoskeletalBodyPartOptions)} getOptionLabel={function (option) {
                        return utils_1.musculoskeletalBodyPartOptions[option];
                    }} renderInput={function (params) { return (<material_1.TextField {...params} helperText={error ? error.message : null} error={!!error} size="small" label="Body part"/>); }} onChange={function (_e, data) { return onChange(data); }} value={value}/>);
            }}/>
            {watch('bodyPart') === 'finger' && (<react_hook_form_1.Controller name="finger" control={control} rules={{
                    required: true,
                }} render={function (_a) {
                    var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
                    return (<material_1.Autocomplete options={Object.keys(utils_1.musculoskeletalFingerOptions)} getOptionLabel={function (option) {
                            return utils_1.musculoskeletalFingerOptions[option];
                        }} renderInput={function (params) { return (<material_1.TextField {...params} helperText={error ? error.message : null} error={!!error} size="small" label="Finger"/>); }} onChange={function (_e, data) { return onChange(data); }} value={value}/>);
                }}/>)}
            {watch('bodyPart') === 'toe' && (<react_hook_form_1.Controller name="toe" control={control} rules={{
                    required: true,
                }} render={function (_a) {
                    var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
                    return (<material_1.Autocomplete options={Object.keys(utils_1.musculoskeletalToeOptions)} getOptionLabel={function (option) {
                            return utils_1.musculoskeletalToeOptions[option];
                        }} renderInput={function (params) { return (<material_1.TextField {...params} helperText={error ? error.message : null} error={!!error} size="small" label="Toe"/>); }} onChange={function (_e, data) { return onChange(data); }} value={value}/>);
                }}/>)}
            <react_hook_form_1.Controller name="abnormal" control={control} rules={{
                required: true,
            }} render={function (_a) {
                var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
                return (<material_1.Autocomplete options={Object.keys(utils_1.musculoskeletalAbnormalOptions)} getOptionLabel={function (option) {
                        return utils_1.musculoskeletalAbnormalOptions[option];
                    }} renderInput={function (params) { return (<material_1.TextField {...params} helperText={error ? error.message : null} error={!!error} size="small" label="Abnormal"/>); }} onChange={function (_e, data) { return onChange(data); }} value={value}/>);
            }}/>
            <RoundedButton_1.RoundedButton onClick={handleSubmit(onAdd)} disabled={isLoading}>
              Add
            </RoundedButton_1.RoundedButton>
          </material_1.Box>
        </react_hook_form_1.FormProvider>)}
    </material_1.Box>);
};
exports.MusculoskeletalForm = MusculoskeletalForm;
//# sourceMappingURL=MusculoskeletalForm.js.map