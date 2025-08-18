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
exports.RashesForm = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../../components/RoundedButton");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var components_1 = require("../../../../components");
var useExamObservations_1 = require("../../../../hooks/useExamObservations");
var StatelessExamCheckbox_1 = require("./StatelessExamCheckbox");
var RashesForm = function () {
    var _a = (0, useExamObservations_1.useExamObservations)(utils_1.rashesFields), fields = _a.value, update = _a.update, isLoading = _a.isLoading;
    var _b = (0, useExamObservations_1.useExamObservations)('no-rashes'), noRashesField = _b.value, updateNoRashes = _b.update, isNoRashesLoading = _b.isLoading;
    var abnormalFields = fields.filter(function (field) { return field.value; });
    var _c = (0, react_1.useState)([]), savedFields = _c[0], setSavedFields = _c[1];
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: {
            rashes: null,
            description: '',
        },
    });
    var control = methods.control, handleSubmit = methods.handleSubmit, reset = methods.reset;
    var onAdd = function (data) {
        var field = fields.find(function (field) { return field.field === data.rashes; });
        update(__assign(__assign({}, field), { value: true, note: data.description || undefined }));
        reset();
    };
    var onRemove = function (name) {
        var field = fields.find(function (field) { return field.field === name; });
        update(__assign(__assign({}, field), { value: false }));
    };
    (0, react_1.useEffect)(function () {
        if (!noRashesField.value) {
            if (savedFields.length > 0) {
                update(savedFields.map(function (field) { return (__assign(__assign({}, field), { value: true })); }));
            }
        }
        else {
            if (abnormalFields.length > 0) {
                setSavedFields(abnormalFields);
                update(abnormalFields.map(function (field) { return (__assign(__assign({}, field), { value: false, note: undefined })); }));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [noRashesField.value]);
    var onBooleanChange = function (value) {
        updateNoRashes(__assign(__assign({}, noRashesField), { value: !value }));
    };
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
        }}>
      <material_1.Box data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesCheckbox}>
        <StatelessExamCheckbox_1.StatelessExamCheckbox abnormal label="Rashes" checked={!noRashesField.value} onChange={onBooleanChange} disabled={isNoRashesLoading}/>
      </material_1.Box>

      {abnormalFields.length > 0 && (<material_1.Box sx={{ width: '100%' }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesAbnormalSubsection}>
          <components_1.ActionsList data={abnormalFields} getKey={function (value) { return value.field; }} itemDataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashElementInSubsection} renderItem={function (value) { return <material_1.Typography>{(0, utils_1.parseRashesFieldToName)(value.field, fields)}</material_1.Typography>; }} renderActions={function (value) { return <components_1.DeleteIconButton disabled={isLoading} onClick={function () { return onRemove(value.field); }}/>; }} divider gap={0.5}/>
        </material_1.Box>)}

      {!noRashesField.value && (<react_hook_form_1.FormProvider {...methods}>
          <material_1.Box sx={{
                p: 2,
                backgroundColor: colors_1.otherColors.formCardBg,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                borderRadius: 2,
            }}>
            <react_hook_form_1.Controller name="rashes" control={control} rules={{
                required: true,
            }} render={function (_a) {
                var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
                return (<material_1.Autocomplete options={Object.keys(utils_1.rashesOptions)} getOptionLabel={function (option) { return utils_1.rashesOptions[option]; }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesDropdown} renderInput={function (params) { return (<material_1.TextField {...params} helperText={error ? error.message : null} error={!!error} size="small" label="Rashes"/>); }} onChange={function (_e, data) { return onChange(data); }} value={value}/>);
            }}/>
            <react_hook_form_1.Controller name="description" control={control} rules={{
                required: false,
            }} render={function (_a) {
                var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
                return (<material_1.TextField helperText={error ? error.message : null} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesDescription} error={!!error} size="small" label="Description" value={value} onChange={onChange} multiline/>);
            }}/>
            <RoundedButton_1.RoundedButton onClick={handleSubmit(onAdd)} disabled={isLoading} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabRashesAddButton}>
              Add
            </RoundedButton_1.RoundedButton>
          </material_1.Box>
        </react_hook_form_1.FormProvider>)}
    </material_1.Box>);
};
exports.RashesForm = RashesForm;
//# sourceMappingURL=RashesForm.js.map