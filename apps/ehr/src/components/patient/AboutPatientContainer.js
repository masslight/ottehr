"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AboutPatientContainer = void 0;
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var constants_1 = require("../../constants");
var constants_2 = require("../../constants");
var data_test_ids_1 = require("../../constants/data-test-ids");
var form_1 = require("../form");
var layout_1 = require("../layout");
var FormFields = constants_2.FormFields.patientSummary;
var AboutPatientContainer = function () {
    var control = (0, react_hook_form_1.useFormContext)().control;
    return (<layout_1.Section title="Patient information">
      <layout_1.Row label="Last name" inputId={FormFields.lastName.key} required>
        <form_1.FormTextField name={FormFields.lastName.key} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }} id={FormFields.lastName.key} data-testid={data_test_ids_1.dataTestIds.patientInformationContainer.patientLastName}/>
      </layout_1.Row>
      <layout_1.Row label="First name" inputId={FormFields.firstName.key} required>
        <form_1.FormTextField name={FormFields.firstName.key} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }} id={FormFields.firstName.key} data-testid={data_test_ids_1.dataTestIds.patientInformationContainer.patientFirstName}/>
      </layout_1.Row>
      <layout_1.Row label="Middle name" inputId={FormFields.middleName.key}>
        <form_1.FormTextField name={FormFields.middleName.key} control={control} id={FormFields.middleName.key} data-testid={data_test_ids_1.dataTestIds.patientInformationContainer.patientMiddleName}/>
      </layout_1.Row>
      <layout_1.Row label="Suffix" inputId={FormFields.suffix.key}>
        <form_1.FormTextField name={FormFields.suffix.key} control={control} id={FormFields.suffix.key} data-testid={data_test_ids_1.dataTestIds.patientInformationContainer.patientSuffix}/>
      </layout_1.Row>
      <layout_1.Row label="Preferred name" inputId={FormFields.preferredName.key}>
        <form_1.FormTextField name={FormFields.preferredName.key} control={control} id={FormFields.preferredName.key} data-testid={data_test_ids_1.dataTestIds.patientInformationContainer.patientPreferredName}/>
      </layout_1.Row>
      <layout_1.Row label="Date of birth" inputId={FormFields.birthDate.key} required>
        <form_1.BasicDatePicker id={FormFields.birthDate.key} name={FormFields.birthDate.key} control={control} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }} dataTestId={data_test_ids_1.dataTestIds.patientInformationContainer.patientDateOfBirth} component="Field"/>
      </layout_1.Row>
      <layout_1.Row label="Preferred pronouns">
        <form_1.FormSelect name={FormFields.pronouns.key} control={control} options={constants_1.PRONOUN_OPTIONS} data-testid={data_test_ids_1.dataTestIds.patientInformationContainer.patientPreferredPronouns}/>
      </layout_1.Row>
      <layout_1.Row label="Birth sex" required>
        <form_1.FormSelect name={FormFields.birthSex.key} control={control} options={constants_1.SEX_OPTIONS} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }} data-testid={data_test_ids_1.dataTestIds.patientInformationContainer.patientBirthSex}/>
      </layout_1.Row>
    </layout_1.Section>);
};
exports.AboutPatientContainer = AboutPatientContainer;
//# sourceMappingURL=AboutPatientContainer.js.map