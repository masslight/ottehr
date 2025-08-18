"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicInformation = BasicInformation;
var material_1 = require("@mui/material");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var DatePicker_1 = require("@mui/x-date-pickers/DatePicker");
var LocalizationProvider_1 = require("@mui/x-date-pickers/LocalizationProvider");
var luxon_1 = require("luxon");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../constants/data-test-ids");
var InputMask_1 = require("../InputMask");
function BasicInformation(_a) {
    var _b;
    var control = _a.control, existingUser = _a.existingUser, isActive = _a.isActive;
    var fieldsDisabled = isActive === false;
    return (<>
      <material_1.FormLabel sx={{ mb: 1, fontWeight: '600 !important' }}>Employee information</material_1.FormLabel>
      <react_hook_form_1.Controller name="firstName" control={control} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value;
            return (<material_1.TextField label="First name" required disabled={fieldsDisabled} data-testid={data_test_ids_1.dataTestIds.employeesPage.firstName} value={value || ''} onChange={onChange} sx={{ marginTop: 2, marginBottom: 1, width: '100%' }} margin="dense"/>);
        }}/>
      <react_hook_form_1.Controller name="middleName" control={control} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value;
            return (<material_1.TextField label="Middle name" data-testid={data_test_ids_1.dataTestIds.employeesPage.middleName} value={value || ''} disabled={fieldsDisabled} onChange={onChange} sx={{ marginTop: 2, marginBottom: 1, width: '100%' }} margin="dense"/>);
        }}/>
      <react_hook_form_1.Controller name="lastName" control={control} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value;
            return (<material_1.TextField label="Last name" data-testid={data_test_ids_1.dataTestIds.employeesPage.lastName} required disabled={fieldsDisabled} value={value || ''} onChange={onChange} sx={{ marginBottom: 2, width: '100%' }} margin="dense"/>);
        }}/>
      <react_hook_form_1.Controller name="birthDate" control={control} rules={{
            validate: function (value) {
                if (value) {
                    var date = luxon_1.DateTime.fromISO(value);
                    if (!date.isValid) {
                        return 'Please enter a valid birth date';
                    }
                    if (date > luxon_1.DateTime.now()) {
                        return 'Birth date cannot be in the future';
                    }
                }
                return true;
            },
        }} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
            return (<LocalizationProvider_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
            <DatePicker_1.DatePicker label="Birth date" onChange={onChange} disabled={fieldsDisabled} slotProps={{
                    textField: {
                        style: { width: '100%' },
                        helperText: (error === null || error === void 0 ? void 0 : error.message) ? error === null || error === void 0 ? void 0 : error.message : null,
                        error: (error === null || error === void 0 ? void 0 : error.message) !== undefined,
                        inputProps: {
                            'data-testid': data_test_ids_1.dataTestIds.employeesPage.birthDate,
                        },
                    },
                }} value={value || null}/>
          </LocalizationProvider_1.LocalizationProvider>);
        }}/>
      <material_1.TextField label="Email" data-testid={data_test_ids_1.dataTestIds.employeesPage.email} value={(_b = existingUser === null || existingUser === void 0 ? void 0 : existingUser.email) !== null && _b !== void 0 ? _b : ''} sx={{ marginBottom: 2, width: '100%' }} margin="dense" disabled={fieldsDisabled} InputProps={{
            readOnly: true,
            disabled: true,
        }}/>
      <react_hook_form_1.Controller name="phoneNumber" control={control} rules={{
            pattern: {
                value: utils_1.phoneRegex,
                message: '{Phone number must be} 10 digits',
            },
        }} render={function (_a) {
            var _b;
            var _c = _a.field, onChange = _c.onChange, value = _c.value, error = _a.fieldState.error;
            return (<material_1.TextField label="Phone" data-testid={data_test_ids_1.dataTestIds.employeesPage.phone} value={value || ''} disabled={fieldsDisabled} onChange={onChange} error={(error === null || error === void 0 ? void 0 : error.message) !== undefined} inputProps={{ mask: '(000) 000-0000' }} InputProps={{
                    inputComponent: InputMask_1.default,
                }} helperText={(_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : ''} FormHelperTextProps={{
                    sx: { ml: 0, mt: 1 },
                }} sx={{ marginBottom: 2, width: '100%' }} margin="dense"/>);
        }}/>
      <react_hook_form_1.Controller name="faxNumber" control={control} rules={{
            pattern: {
                value: utils_1.phoneRegex,
                message: 'Fax number must be 10 digits in the format (xxx) xxx-xxxx and a valid number',
            },
        }} render={function (_a) {
            var _b;
            var _c = _a.field, onChange = _c.onChange, value = _c.value, error = _a.fieldState.error;
            return (<material_1.TextField label="Fax" data-testid={data_test_ids_1.dataTestIds.employeesPage.fax} value={value || ''} onChange={onChange} disabled={fieldsDisabled} error={(error === null || error === void 0 ? void 0 : error.message) !== undefined} sx={{ marginBottom: 2, width: '100%' }} inputProps={{ mask: '(000) 000-0000' }} InputProps={{
                    inputComponent: InputMask_1.default,
                }} helperText={(_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : ''} FormHelperTextProps={{
                    sx: { ml: 0, mt: 1 },
                }} margin="dense"/>);
        }}/>
      <react_hook_form_1.Controller name="addressLine1" control={control} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value;
            return (<material_1.TextField label="Address line 1" data-testid={data_test_ids_1.dataTestIds.employeesPage.addressLine1} value={value || ''} disabled={fieldsDisabled} onChange={onChange} sx={{ marginBottom: 2, width: '100%' }} margin="dense"/>);
        }}/>
      <react_hook_form_1.Controller name="addressLine2" control={control} render={function (_a) {
            var _b;
            var _c = _a.field, onChange = _c.onChange, value = _c.value, error = _a.fieldState.error;
            return (<material_1.TextField label="Address line 2" data-testid={data_test_ids_1.dataTestIds.employeesPage.addressLine2} value={value || ''} onChange={onChange} disabled={fieldsDisabled} error={(error === null || error === void 0 ? void 0 : error.message) !== undefined} helperText={(_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : ''} FormHelperTextProps={{
                    sx: { ml: 0, mt: 1 },
                }} sx={{ marginBottom: 2, width: '100%' }} margin="dense"/>);
        }}/>
      <react_hook_form_1.Controller name="addressCity" control={control} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value;
            return (<material_1.TextField label="City" data-testid={data_test_ids_1.dataTestIds.employeesPage.addressCity} value={value || ''} disabled={fieldsDisabled} onChange={onChange} sx={{ marginBottom: 2, width: '100%' }} margin="dense"/>);
        }}/>
      <react_hook_form_1.Controller name="addressState" control={control} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value;
            return (<material_1.TextField label="State" data-testid={data_test_ids_1.dataTestIds.employeesPage.addressState} value={value || ''} disabled={fieldsDisabled} onChange={onChange} sx={{ marginBottom: 2, width: '100%' }} margin="dense"/>);
        }}/>
      <react_hook_form_1.Controller name="addressZip" control={control} rules={{
            pattern: {
                value: utils_1.zipRegex,
                message: 'Zip code must be 5 digits',
            },
        }} render={function (_a) {
            var _b;
            var _c = _a.field, onChange = _c.onChange, value = _c.value, error = _a.fieldState.error;
            return (<material_1.TextField label="Zip" data-testid={data_test_ids_1.dataTestIds.employeesPage.addressZip} error={(error === null || error === void 0 ? void 0 : error.message) !== undefined} value={value || ''} onChange={onChange} disabled={fieldsDisabled} helperText={(_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : ''} FormHelperTextProps={{
                    sx: { ml: 0, mt: 1 },
                }} inputProps={{ mask: '00000' }} InputProps={{
                    inputComponent: InputMask_1.default,
                }} sx={{ marginBottom: 2, width: '100%' }} margin="dense"/>);
        }}/>
    </>);
}
//# sourceMappingURL=BasicInformation.js.map