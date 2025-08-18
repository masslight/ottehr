"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientDetailsContainer = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var constants_1 = require("../../constants");
var constants_2 = require("../../constants");
var data_test_ids_1 = require("../../constants/data-test-ids");
var form_1 = require("../form");
var layout_1 = require("../layout");
var ShowMoreButton_1 = require("./ShowMoreButton");
var FormFields = constants_2.FormFields.patientDetails;
var PatientDetailsContainer = function (_a) {
    var _b;
    var patient = _a.patient;
    var theme = (0, material_1.useTheme)();
    var _c = (0, react_hook_form_1.useFormContext)(), control = _c.control, watch = _c.watch;
    var _d = (0, react_1.useState)(false), showAllPreviousNames = _d[0], setShowAllPreviousNames = _d[1];
    if (!patient)
        return null;
    var previousNames = ((_b = patient.name) === null || _b === void 0 ? void 0 : _b.filter(function (name) { return name.use === 'old'; }).reverse()) || [];
    var genderIdentityCurrentValue = watch(FormFields.genderIdentity.key);
    var isNonBinaryGender = genderIdentityCurrentValue === 'Non-binary gender identity';
    return (<layout_1.Section title="Patient details">
      <layout_1.Row label="Previous name">
        {previousNames.length > 0 ? (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, width: '100%' }}>
            <material_1.Box sx={{ width: '100%' }}>
              <material_1.Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <material_1.Typography component="span">{formatFullName(previousNames[0])}</material_1.Typography>
                {previousNames.length > 1 && (<ShowMoreButton_1.default isOpen={showAllPreviousNames} onClick={function () { return setShowAllPreviousNames(!showAllPreviousNames); }}/>)}
              </material_1.Box>
              <material_1.Divider />
            </material_1.Box>
            {showAllPreviousNames &&
                previousNames.length > 1 &&
                previousNames.slice(1).map(function (name, index) { return (<material_1.Box key={index} sx={{ width: '100%' }}>
                  <material_1.Typography sx={{ pb: 0.5 }}>{formatFullName(name)}</material_1.Typography>
                  <material_1.Divider />
                </material_1.Box>); })}
          </material_1.Box>) : (<material_1.Typography color="text.secondary">No previous names</material_1.Typography>)}
      </layout_1.Row>
      <layout_1.Row label="Patient's ethnicity" dataTestId={data_test_ids_1.dataTestIds.patientDetailsContainer.patientsEthnicity} required>
        <form_1.FormSelect name={FormFields.ethnicity.key} control={control} options={constants_1.ETHNICITY_OPTIONS} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }}/>
      </layout_1.Row>
      <layout_1.Row label="Patient's race" dataTestId={data_test_ids_1.dataTestIds.patientDetailsContainer.patientsRace} required>
        <form_1.FormSelect name={FormFields.race.key} control={control} options={constants_1.RACE_OPTIONS} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
        }}/>
      </layout_1.Row>
      <layout_1.Row label="Sexual orientation" dataTestId={data_test_ids_1.dataTestIds.patientDetailsContainer.sexualOrientation}>
        <form_1.FormSelect name={FormFields.sexualOrientation.key} control={control} options={constants_1.SEXUAL_ORIENTATION_OPTIONS}/>
      </layout_1.Row>
      <layout_1.Row label="Gender identity" dataTestId={data_test_ids_1.dataTestIds.patientDetailsContainer.genderIdentity}>
        <form_1.FormSelect name={FormFields.genderIdentity.key} control={control} options={constants_1.GENDER_IDENTITY_OPTIONS}/>
      </layout_1.Row>
      {isNonBinaryGender && (<material_1.Box sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '5px',
            }}>
          <material_1.Box sx={{ display: 'flex', alignItems: 'center', alignSelf: 'end', flex: '0 1 70%' }}>
            <form_1.FormTextField name={FormFields.genderIdentityDetails.key} data-testid={data_test_ids_1.dataTestIds.patientDetailsContainer.pleaseSpecifyField} control={control} rules={{
                validate: function (value) {
                    if (!value && isNonBinaryGender)
                        return utils_1.REQUIRED_FIELD_ERROR_MESSAGE;
                    return true;
                },
            }}/>
          </material_1.Box>
        </material_1.Box>)}
      <layout_1.Row label="How did you hear about us?" dataTestId={data_test_ids_1.dataTestIds.patientDetailsContainer.howDidYouHearAboutUs}>
        <form_1.FormSelect name={FormFields.pointOfDiscovery.key} control={control} options={constants_1.POINT_OF_DISCOVERY_OPTIONS}/>
      </layout_1.Row>
      <material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '5px',
        }}>
        <material_1.Box sx={{ display: 'flex', alignItems: 'center', flex: '0 1 30%' }}>
          <material_1.Typography sx={{ color: theme.palette.primary.dark }}>Send marketing messages</material_1.Typography>
        </material_1.Box>
        <material_1.Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
          <react_hook_form_1.Controller name={FormFields.sendMarketing.key} control={control} render={function (_a) {
            var field = _a.field;
            return (<material_1.Select {...field} value={String(field.value) || ''} variant="standard" sx={{ width: '100%' }} onChange={function (e) {
                    var boolValue = e.target.value === 'true';
                    field.onChange(boolValue);
                }} data-testid={data_test_ids_1.dataTestIds.patientDetailsContainer.sendMarketingMessages}>
                {[
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                ].map(function (option) { return (<material_1.MenuItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </material_1.MenuItem>); })}
              </material_1.Select>);
        }}/>
        </material_1.Box>
      </material_1.Box>
      <material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '5px',
        }}>
        <material_1.Box sx={{ display: 'flex', alignItems: 'center', flex: '0 1 30%' }}>
          <material_1.Typography sx={{ color: theme.palette.primary.dark }}>Preferred language</material_1.Typography>
        </material_1.Box>
        <material_1.Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
          <react_hook_form_1.Controller name={FormFields.language.key} control={control} render={function (_a) {
            var field = _a.field;
            return (<material_1.Select {...field} value={field.value || ''} variant="standard" sx={{ width: '100%' }} data-testid={data_test_ids_1.dataTestIds.patientDetailsContainer.preferredLanguage}>
                {Object.entries(utils_1.LANGUAGE_OPTIONS).map(function (_a) {
                    var key = _a[0], value = _a[1];
                    return (<material_1.MenuItem key={value} value={value}>
                    {key}
                  </material_1.MenuItem>);
                })}
              </material_1.Select>);
        }}/>
        </material_1.Box>
      </material_1.Box>
      <material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '5px',
        }}>
        <material_1.Box sx={{ display: 'flex', alignItems: 'center', flex: '0 1 30%' }}>
          <material_1.Typography sx={{ color: theme.palette.primary.dark }}>CommonWell consent</material_1.Typography>
        </material_1.Box>
        <material_1.Box sx={{ display: 'flex', alignItems: 'center', flex: '1 1 70%' }}>
          <react_hook_form_1.Controller name={FormFields.commonWellConsent.key} control={control} render={function (_a) {
            var field = _a.field;
            return (<material_1.Select {...field} value={String(field.value) || ''} variant="standard" sx={{ width: '100%' }} onChange={function (e) {
                    var boolValue = e.target.value === 'true';
                    field.onChange(boolValue);
                }} data-testid={data_test_ids_1.dataTestIds.patientDetailsContainer.commonWellConsent}>
                {[
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                ].map(function (option) { return (<material_1.MenuItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </material_1.MenuItem>); })}
              </material_1.Select>);
        }}/>
        </material_1.Box>
      </material_1.Box>
    </layout_1.Section>);
};
exports.PatientDetailsContainer = PatientDetailsContainer;
var formatFullName = function (name) {
    var _a, _b;
    var components = [
        (_a = name.given) === null || _a === void 0 ? void 0 : _a.join(' '), // Combines all given names (first + middle)
        name.family,
        (_b = name.suffix) === null || _b === void 0 ? void 0 : _b.join(' '),
    ].filter(Boolean); // Remove any undefined/null values
    return components.join(' ');
};
//# sourceMappingURL=PatientDetailsContainer.js.map