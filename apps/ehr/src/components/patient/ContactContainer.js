"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactContainer = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var constants_1 = require("../../constants");
var constants_2 = require("../../constants");
var data_test_ids_1 = require("../../constants/data-test-ids");
var form_1 = require("../form");
var InputMask_1 = require("../InputMask");
var layout_1 = require("../layout");
var FormFields = constants_2.FormFields.patientContactInformation;
var ContactContainer = function () {
    var _a = (0, react_hook_form_1.useFormContext)(), control = _a.control, setValue = _a.setValue;
    return (<layout_1.Section title="Contact information">
      <layout_1.Row label="Street address" inputId={FormFields.streetAddress.key} required>
        <form_1.FormTextField name={FormFields.streetAddress.key} data-testid={data_test_ids_1.dataTestIds.contactInformationContainer.streetAddress} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }} id={FormFields.streetAddress.key}/>
      </layout_1.Row>
      <layout_1.Row label="Address line 2" inputId={FormFields.addressLine2.key}>
        <form_1.FormTextField name={FormFields.addressLine2.key} control={control} id={FormFields.addressLine2.key} data-testid={data_test_ids_1.dataTestIds.contactInformationContainer.addressLineOptional}/>
      </layout_1.Row>
      <layout_1.Row label="City, State, ZIP" required>
        <material_1.Box sx={{ display: 'flex', gap: 2 }}>
          <form_1.FormTextField name={FormFields.city.key} control={control} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }} data-testid={data_test_ids_1.dataTestIds.contactInformationContainer.city}/>
          <react_hook_form_1.Controller name={FormFields.state.key} control={control} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }} render={function (_a) {
            var value = _a.field.value, error = _a.fieldState.error;
            return (<material_1.Autocomplete options={constants_1.STATE_OPTIONS.map(function (option) { return option.value; })} value={value !== null && value !== void 0 ? value : ''} data-testid={data_test_ids_1.dataTestIds.contactInformationContainer.state} onChange={function (_, newValue) {
                    if (newValue) {
                        setValue(FormFields.state.key, newValue);
                    }
                    else {
                        setValue(FormFields.state.key, '');
                    }
                }} disableClearable fullWidth renderInput={function (params) { return (<material_1.TextField {...params} variant="standard" error={!!error} required helperText={error === null || error === void 0 ? void 0 : error.message}/>); }}/>);
        }}/>
          <form_1.FormTextField name={FormFields.zip.key} control={control} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value) { return (0, utils_1.isPostalCodeValid)(value) || 'Must be 5 digits'; },
        }} data-testid={data_test_ids_1.dataTestIds.contactInformationContainer.zip}/>
        </material_1.Box>
      </layout_1.Row>
      <layout_1.Row label="Patient email" required={true}>
        <form_1.FormTextField id={FormFields.email.key} name={FormFields.email.key} data-testid={data_test_ids_1.dataTestIds.contactInformationContainer.patientEmail} control={control} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            pattern: {
                value: utils_1.emailRegex,
                message: 'Must be in the format "email@example.com"',
            },
        }}/>
      </layout_1.Row>
      <layout_1.Row label="Patient mobile" required={true}>
        <form_1.FormTextField id={FormFields.phone.key} name={FormFields.phone.key} control={control} inputProps={{ mask: '(000) 000-0000' }} InputProps={{
            inputComponent: InputMask_1.default,
        }} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value) {
                return (0, utils_1.isPhoneNumberValid)(value) ||
                    'Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number';
            },
        }} data-testid={data_test_ids_1.dataTestIds.contactInformationContainer.patientMobile}/>
      </layout_1.Row>
    </layout_1.Section>);
};
exports.ContactContainer = ContactContainer;
//# sourceMappingURL=ContactContainer.js.map