"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddInsuranceModal = void 0;
var icons_material_1 = require("@mui/icons-material");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var react_query_1 = require("react-query");
var data_test_ids_1 = require("src/constants/data-test-ids");
var utils_1 = require("utils");
var constants_1 = require("../../constants");
var constants_2 = require("../../constants");
var qr_structure_1 = require("../../helpers/qr-structure");
var useGetPatient_1 = require("../../hooks/useGetPatient");
var patient_store_1 = require("../../state/patient.store");
var form_1 = require("../form");
var FormFields = constants_2.FormFields.insurance[0];
var AddInsuranceModal = function (_a) {
    var _b;
    var _c;
    var open = _a.open, patientId = _a.patientId, questionnaire = _a.questionnaire, priorityOptions = _a.priorityOptions, onClose = _a.onClose;
    var theme = (0, material_1.useTheme)();
    var methods = (0, react_hook_form_1.useForm)({
        mode: 'onBlur',
        defaultValues: (_b = {},
            _b[FormFields.insurancePriority.key] = ((_c = priorityOptions[0]) === null || _c === void 0 ? void 0 : _c.value) || 'Primary',
            _b[FormFields.insuranceCarrier.key] = null,
            _b[FormFields.memberId.key] = '',
            _b[FormFields.firstName.key] = '',
            _b[FormFields.middleName.key] = '',
            _b[FormFields.lastName.key] = '',
            _b[FormFields.birthDate.key] = '',
            _b[FormFields.birthSex.key] = '',
            _b[FormFields.relationship.key] = '',
            _b[FormFields.streetAddress.key] = '',
            _b[FormFields.addressLine2.key] = '',
            _b[FormFields.city.key] = '',
            _b[FormFields.state.key] = null,
            _b[FormFields.zip.key] = '',
            _b[FormFields.additionalInformation.key] = '',
            _b),
    });
    var control = methods.control, formState = methods.formState, handleSubmit = methods.handleSubmit, setValue = methods.setValue;
    var errors = formState.errors, defaultValues = formState.defaultValues;
    var insurancePlans = (0, patient_store_1.usePatientStore)().insurancePlans;
    var queryClient = (0, react_query_1.useQueryClient)();
    var submitQR = (0, useGetPatient_1.useUpdatePatientAccount)(function () {
        void queryClient.invalidateQueries('patient-account-get');
    });
    var onSubmit = function (data) {
        // send the data to a zambda
        var questionnaireResponse = (0, qr_structure_1.structureQuestionnaireResponse)(questionnaire, data, patientId);
        submitQR.mutate(questionnaireResponse);
    };
    (0, react_1.useEffect)(function () {
        if (!open) {
            methods.reset();
        }
    }, [open, methods]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (priorityOptions.length === 1 && ((_a = priorityOptions[0]) === null || _a === void 0 ? void 0 : _a.value)) {
            methods.setValue(FormFields.insurancePriority.key, priorityOptions[0].value);
        }
    }, [priorityOptions, methods]);
    (0, react_1.useEffect)(function () {
        if (!open && !submitQR.isIdle) {
            submitQR.reset();
        }
        else if (open && submitQR.isSuccess) {
            onClose();
        }
    }, [open, submitQR, onClose]);
    return (<material_1.Dialog open={open} onClose={onClose} PaperProps={{ sx: { p: 2, maxWidth: 'none' } }} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.id}>
      <material_1.DialogTitle variant="h5" color="secondary.main" sx={{
            width: '100%',
            fontSize: '24px',
            color: theme.palette.primary.dark,
            fontWeight: '600 !important',
        }}>
        Add Insurance
        <material_1.IconButton aria-label="Close" onClick={onClose} sx={{
            position: 'absolute',
            right: 8,
            top: 8,
        }}>
          <icons_material_1.Close />
        </material_1.IconButton>
      </material_1.DialogTitle>
      <react_hook_form_1.FormProvider {...methods}>
        <material_1.DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <material_1.Grid container spacing={2} columns={9} sx={{ pt: 1 }}>
            <material_1.Grid item xs={3}>
              <form_1.LabeledField label="Type" required error={!!errors[FormFields.insurancePriority.key]}>
                <form_1.FormSelect data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.type} name={FormFields.insurancePriority.key} variant="outlined" control={control} options={priorityOptions} defaultValue={(defaultValues === null || defaultValues === void 0 ? void 0 : defaultValues.insurancePriority) || 'Primary'} disabled={priorityOptions.length === 1} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={3}>
              <form_1.LabeledField label="Insurance carrier" required error={!!errors[FormFields.insuranceCarrier.key]}>
                <react_hook_form_1.Controller name={FormFields.insuranceCarrier.key} control={control} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value) {
                return insurancePlans.some(function (option) { return "Organization/".concat(option.id) === (value === null || value === void 0 ? void 0 : value.reference); });
            },
        }} render={function (_a) {
            var value = _a.field.value, error = _a.fieldState.error;
            var isLoading = insurancePlans.length === 0;
            var selectedOption = insurancePlans.find(function (option) { return "Organization/".concat(option.id) === (value === null || value === void 0 ? void 0 : value.reference); });
            return (<material_1.Autocomplete options={insurancePlans} loading={isLoading} loadingText={'Loading...'} value={selectedOption !== null && selectedOption !== void 0 ? selectedOption : {}} isOptionEqualToValue={function (option, value) {
                    return (option === null || option === void 0 ? void 0 : option.id) === (value === null || value === void 0 ? void 0 : value.id);
                }} getOptionLabel={function (option) { return option.name || ''; }} onChange={function (_, newValue) {
                    if (newValue) {
                        setValue(FormFields.insuranceCarrier.key, { reference: "Organization/".concat(newValue.id), display: newValue.name }, { shouldDirty: true });
                    }
                    else {
                        setValue(FormFields.insuranceCarrier.key, null);
                    }
                }} disableClearable fullWidth renderInput={function (params) { return (<material_1.TextField {...params} variant="outlined" error={!!error} required helperText={error === null || error === void 0 ? void 0 : error.message} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.insuranceCarrier}/>); }}/>);
        }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={3} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.memberId}>
              <form_1.LabeledField label="Member ID" required error={!!errors[FormFields.memberId.key]}>
                <form_1.FormTextField variant="outlined" name={FormFields.memberId.key} control={control} defaultValue={''} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={3} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersFirstName}>
              <form_1.LabeledField label="Policy holder's first name" required error={!!errors[FormFields.firstName.key]}>
                <form_1.FormTextField variant="outlined" name={FormFields.firstName.key} control={control} defaultValue={''} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={3} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersMiddleName}>
              <form_1.LabeledField label="Policy holder's middle name">
                <form_1.FormTextField InputLabelProps={{
            shrink: true,
            sx: {
                fontWeight: 'bold',
            },
        }} variant="outlined" name={FormFields.middleName.key} control={control} defaultValue={''}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={3} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersLastName}>
              <form_1.LabeledField label="Policy holder's last name" required error={!!errors[FormFields.lastName.key]}>
                <form_1.FormTextField variant="outlined" name={FormFields.lastName.key} control={control} defaultValue={''} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={3}>
              <form_1.LabeledField label="Policy holder's date of birth" required error={!!errors[FormFields.birthDate.key]}>
                <form_1.BasicDatePicker name={FormFields.birthDate.key} variant="outlined" control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }} defaultValue={''} dataTestId={data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersDateOfBirth} component="Field"/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={3} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersSex}>
              <form_1.LabeledField label="Policy holder's sex" required error={!!errors[FormFields.birthSex.key]}>
                <form_1.FormSelect variant="outlined" name={FormFields.birthSex.key} control={control} defaultValue={''} options={constants_1.SEX_OPTIONS} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={3} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.relationship}>
              <form_1.LabeledField label="Patient’s relationship to insured" required error={!!errors[FormFields.relationship.key]}>
                <form_1.FormSelect variant="outlined" name={FormFields.relationship.key} control={control} defaultValue={''} options={constants_1.RELATIONSHIP_TO_INSURED_OPTIONS} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={3} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.streetAddress}>
              <form_1.LabeledField label="Street address" required error={!!errors[FormFields.streetAddress.key]}>
                <form_1.FormTextField placeholder="No., Street" variant="outlined" name={FormFields.streetAddress.key} control={control} defaultValue={''} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={3} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.addressLine2}>
              <form_1.LabeledField label="Address line 2">
                <form_1.FormTextField placeholder="No., Street" variant="outlined" name={FormFields.addressLine2.key} control={control} defaultValue={''}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={1} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.city}>
              <form_1.LabeledField label="City" required error={!!errors[FormFields.city.key]}>
                <form_1.FormTextField variant="outlined" name={FormFields.city.key} control={control} defaultValue={''} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={1}>
              <form_1.LabeledField label="State" required error={!!errors[FormFields.state.key]}>
                <react_hook_form_1.Controller name={FormFields.state.key} control={control} defaultValue={null} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value) { return !value || constants_1.STATE_OPTIONS.some(function (option) { return option.value === value; }); },
        }} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
            return (<material_1.Autocomplete data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.state} options={constants_1.STATE_OPTIONS} value={(constants_1.STATE_OPTIONS.find(function (option) { return option.value === value; }) || null)} getOptionLabel={function (option) { return option.label || ''; }} isOptionEqualToValue={function (option, value) { return (option === null || option === void 0 ? void 0 : option.value) === (value === null || value === void 0 ? void 0 : value.value) || (!option && !value); }} onChange={function (_, newValue) {
                    onChange((newValue === null || newValue === void 0 ? void 0 : newValue.value) || null);
                }} disableClearable renderInput={function (params) { return (<material_1.TextField {...params} required error={!!error} placeholder="Select" helperText={error === null || error === void 0 ? void 0 : error.message}/>); }}/>);
        }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={1} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.zip}>
              <form_1.LabeledField label="ZIP" required error={!!errors[FormFields.zip.key]}>
                <form_1.FormTextField variant="outlined" name={FormFields.zip.key} control={control} defaultValue={''} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value) { return (0, utils_1.isPostalCodeValid)(value) || 'Must be 5 digits'; },
        }}/>
              </form_1.LabeledField>
            </material_1.Grid>
            <material_1.Grid item xs={9} data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.additionalInformation}>
              <form_1.LabeledField label="Additional insurance information">
                <form_1.FormTextField variant="outlined" name={FormFields.additionalInformation.key} control={control} defaultValue={''}/>
              </form_1.LabeledField>
            </material_1.Grid>
          </material_1.Grid>
        </material_1.DialogContent>
      </react_hook_form_1.FormProvider>
      <material_1.DialogActions sx={{ p: 3, justifyContent: 'space-between' }}>
        <material_1.Button variant="outlined" color="primary" sx={{
            borderRadius: 25,
            textTransform: 'none',
            fontSize: 15,
            fontWeight: 'bold',
        }} onClick={onClose}>
          Cancel
        </material_1.Button>
        <lab_1.LoadingButton data-testid={data_test_ids_1.dataTestIds.addInsuranceDialog.addInsuranceButton} variant="contained" color="primary" sx={{
            borderRadius: 25,
            textTransform: 'none',
            fontSize: 15,
            fontWeight: 'bold',
        }} onClick={handleSubmit(onSubmit)}>
          Add Insurance
        </lab_1.LoadingButton>
      </material_1.DialogActions>
    </material_1.Dialog>);
};
exports.AddInsuranceModal = AddInsuranceModal;
//# sourceMappingURL=AddInsuranceModal.js.map