"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimaryCareContainer = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var constants_1 = require("../../constants");
var data_test_ids_1 = require("../../constants/data-test-ids");
var form_1 = require("../form");
var InputMask_1 = require("../InputMask");
var layout_1 = require("../layout");
var FormFields = constants_1.FormFields.primaryCarePhysician;
var PrimaryCareContainer = function () {
    var _a = (0, react_hook_form_1.useFormContext)(), control = _a.control, watch = _a.watch, setValue = _a.setValue;
    var isActive = watch(FormFields.active.key, true);
    return (<layout_1.Section title="Primary care physician">
      <react_hook_form_1.Controller name={FormFields.active.key} control={control} render={function (_a) {
            var value = _a.field.value;
            return (<material_1.FormControlLabel control={<material_1.Checkbox data-testid={data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.pcpCheckbox} checked={!value} onClick={function (e) {
                        var checked = e.target.checked;
                        setValue(FormFields.active.key, !checked, { shouldDirty: true });
                    }}/>} label={<material_1.Typography>Patient doesn't have a PCP at this time</material_1.Typography>}/>);
        }}/>
      <material_1.Box sx={{ display: isActive ? 'contents' : 'none' }}>
        <layout_1.Row label="First name" inputId={FormFields.firstName.key} required={isActive}>
          <form_1.FormTextField name={FormFields.firstName.key} control={control} rules={{
            validate: function (value) {
                if (isActive && !value)
                    return utils_1.REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
            },
        }} id={FormFields.firstName.key} data-testid={data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.firstName}/>
        </layout_1.Row>
        <layout_1.Row label="Last name" inputId={FormFields.lastName.key} required={isActive}>
          <form_1.FormTextField name={FormFields.lastName.key} control={control} rules={{
            validate: function (value) {
                if (isActive && !value)
                    return utils_1.REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
            },
        }} id={FormFields.lastName.key} data-testid={data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.lastName}/>
        </layout_1.Row>
        <layout_1.Row label="Practice name" inputId={FormFields.practiceName.key} required={isActive}>
          <form_1.FormTextField name={FormFields.practiceName.key} control={control} rules={{
            validate: function (value) {
                if (isActive && !value)
                    return utils_1.REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
            },
        }} id={FormFields.practiceName.key} data-testid={data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.practiceName}/>
        </layout_1.Row>
        <layout_1.Row label="Address" inputId={FormFields.address.key} required={isActive}>
          <form_1.FormTextField name={FormFields.address.key} control={control} rules={{
            validate: function (value) {
                if (isActive && !value)
                    return utils_1.REQUIRED_FIELD_ERROR_MESSAGE;
                return true;
            },
        }} id={FormFields.address.key} data-testid={data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.address}/>
        </layout_1.Row>
        <layout_1.Row label="Mobile" inputId={FormFields.phone.key} required={isActive}>
          <form_1.FormTextField data-testid={data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile} name={FormFields.phone.key} control={control} rules={{
            validate: function (value) {
                if (!isActive)
                    return true;
                if (!value)
                    return utils_1.REQUIRED_FIELD_ERROR_MESSAGE;
                return ((0, utils_1.isPhoneNumberValid)(value) ||
                    'Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number');
            },
        }} id={FormFields.phone.key} inputProps={{ mask: '(000) 000-0000' }} InputProps={{
            inputComponent: InputMask_1.default,
        }}/>
        </layout_1.Row>
      </material_1.Box>
    </layout_1.Section>);
};
exports.PrimaryCareContainer = PrimaryCareContainer;
//# sourceMappingURL=PrimaryCareContainer.js.map