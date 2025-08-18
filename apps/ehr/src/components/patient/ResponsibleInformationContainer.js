"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponsibleInformationContainer = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var utils_2 = require("utils");
var form_1 = require("../../components/form");
var constants_1 = require("../../constants");
var constants_2 = require("../../constants");
var data_test_ids_1 = require("../../constants/data-test-ids");
var InputMask_1 = require("../InputMask");
var layout_1 = require("../layout");
var FormFields = constants_2.FormFields.responsibleParty;
var ResponsibleInformationContainer = function () {
    var _a = (0, react_hook_form_1.useFormContext)(), control = _a.control, watch = _a.watch, getValues = _a.getValues, setValue = _a.setValue;
    var selfSelected = watch(FormFields.relationship.key) === 'Self';
    (0, react_1.useEffect)(function () {
        var _a;
        var fieldMap = (_a = {},
            _a[FormFields.firstName.key] = constants_2.FormFields.patientSummary.firstName.key,
            _a[FormFields.lastName.key] = constants_2.FormFields.patientSummary.lastName.key,
            _a[FormFields.birthDate.key] = constants_2.FormFields.patientSummary.birthDate.key,
            _a[FormFields.birthSex.key] = constants_2.FormFields.patientSummary.birthSex.key,
            _a[FormFields.phone.key] = constants_2.FormFields.patientContactInformation.phone.key,
            _a[FormFields.addressLine1.key] = constants_2.FormFields.patientContactInformation.streetAddress.key,
            _a[FormFields.addressLine2.key] = constants_2.FormFields.patientContactInformation.addressLine2.key,
            _a[FormFields.city.key] = constants_2.FormFields.patientContactInformation.city.key,
            _a[FormFields.state.key] = constants_2.FormFields.patientContactInformation.state.key,
            _a[FormFields.zip.key] = constants_2.FormFields.patientContactInformation.zip.key,
            _a);
        if (selfSelected) {
            Object.entries(fieldMap).forEach(function (_a) {
                var responsiblePartyKey = _a[0], patientKey = _a[1];
                var patientValue = getValues(patientKey);
                var responsiblePartyValue = getValues(responsiblePartyKey);
                if (patientValue !== responsiblePartyValue) {
                    setValue(responsiblePartyKey, patientValue);
                }
            });
        }
        var subscription = watch(function (_, _a) {
            var name = _a.name;
            if (!selfSelected || !name)
                return;
            var matched = Object.entries(fieldMap).find(function (_a) {
                var patientKey = _a[1];
                return patientKey === name;
            });
            if (matched) {
                var responsiblePartyKey = matched[0], patientKey = matched[1];
                var patientValue = getValues(patientKey);
                var responsiblePartyValue = getValues(responsiblePartyKey);
                if (patientValue !== responsiblePartyValue) {
                    setValue(responsiblePartyKey, patientValue);
                }
            }
        });
        return function () { return subscription.unsubscribe(); };
    }, [selfSelected, watch, setValue, getValues]);
    return (<layout_1.Section title="Responsible party information" dataTestId={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.id}>
      <layout_1.Row label={FormFields.relationship.label} dataTestId={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.relationshipDropdown} required>
        <form_1.FormSelect name={FormFields.relationship.key} control={control} options={constants_1.RELATIONSHIP_OPTIONS} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value) { return constants_1.RELATIONSHIP_OPTIONS.some(function (option) { return option.value === value; }); },
        }}/>
      </layout_1.Row>
      <layout_1.Row label={FormFields.firstName.label} required inputId={FormFields.firstName.key}>
        <form_1.FormTextField name={FormFields.firstName.key} data-testid={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.firstName} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }} id={FormFields.firstName.key} disabled={selfSelected}/>
      </layout_1.Row>
      <layout_1.Row label={FormFields.lastName.label} required inputId={FormFields.lastName.key}>
        <form_1.FormTextField data-testid={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.lastName} name={FormFields.lastName.key} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }} id={FormFields.lastName.key} disabled={selfSelected}/>
      </layout_1.Row>
      <layout_1.Row label={FormFields.birthDate.label} required>
        <form_1.BasicDatePicker name={FormFields.birthDate.key} control={control} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value) {
                if (!value)
                    return true;
                var bdDateTime = luxon_1.DateTime.fromFormat(value, utils_1.DOB_DATE_FORMAT);
                return bdDateTime.isValid || 'Date is invalid';
            },
        }} defaultValue={''} disabled={selfSelected} dataTestId={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.dateOfBirthDropdown} component="Field"/>
      </layout_1.Row>
      <layout_1.Row label={FormFields.birthSex.label} dataTestId={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.birthSexDropdown} required>
        <form_1.FormSelect name={FormFields.birthSex.key} control={control} options={constants_1.SEX_OPTIONS} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }} required={true} disabled={selfSelected}/>
      </layout_1.Row>
      <layout_1.Row label={FormFields.phone.label} inputId={FormFields.phone.key}>
        <form_1.FormTextField id={FormFields.phone.key} name={FormFields.phone.key} data-testid={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.phoneInput} control={control} inputProps={{ mask: '(000) 000-0000' }} InputProps={{
            inputComponent: InputMask_1.default,
        }} rules={{
            validate: function (value) {
                if (!value)
                    return true;
                return ((0, utils_1.isPhoneNumberValid)(value) ||
                    'Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number');
            },
        }} disabled={selfSelected}/>
      </layout_1.Row>
      <layout_1.Row label={FormFields.addressLine1.label} required inputId={FormFields.addressLine1.key}>
        <form_1.FormTextField data-testid={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.addressLine1} name={FormFields.addressLine1.key} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }} id={FormFields.addressLine1.key} disabled={selfSelected}/>
      </layout_1.Row>
      <layout_1.Row label={FormFields.addressLine2.label} inputId={FormFields.addressLine2.key}>
        <form_1.FormTextField data-testid={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.addressLine2} name={FormFields.addressLine2.key} control={control} id={FormFields.addressLine2.key} disabled={selfSelected}/>
      </layout_1.Row>
      <layout_1.Row label="City, State, ZIP" required>
        <material_1.Box sx={{ display: 'flex', gap: 2 }}>
          <form_1.FormTextField name={FormFields.city.key} control={control} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }} data-testid={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.city} disabled={selfSelected}/>
          <react_hook_form_1.Controller name={FormFields.state.key} control={control} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }} render={function (_a) {
            var value = _a.field.value, error = _a.fieldState.error;
            return (<material_1.Autocomplete options={constants_2.STATE_OPTIONS.map(function (option) { return option.value; })} value={value !== null && value !== void 0 ? value : ''} data-testid={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.state} onChange={function (_, newValue) {
                    if (newValue) {
                        setValue(FormFields.state.key, newValue);
                    }
                    else {
                        setValue(FormFields.state.key, '');
                    }
                }} disableClearable fullWidth renderInput={function (params) { return (<material_1.TextField {...params} variant="standard" error={!!error} required helperText={error === null || error === void 0 ? void 0 : error.message}/>); }} disabled={selfSelected}/>);
        }}/>
          <form_1.FormTextField name={FormFields.zip.key} control={control} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value) { return (0, utils_2.isPostalCodeValid)(value) || 'Must be 5 digits'; },
        }} data-testid={data_test_ids_1.dataTestIds.responsiblePartyInformationContainer.zip} disabled={selfSelected}/>
        </material_1.Box>
      </layout_1.Row>
    </layout_1.Section>);
};
exports.ResponsibleInformationContainer = ResponsibleInformationContainer;
//# sourceMappingURL=ResponsibleInformationContainer.js.map