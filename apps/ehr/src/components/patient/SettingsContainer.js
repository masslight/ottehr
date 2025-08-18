"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsContainer = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var constants_1 = require("../../constants");
var data_test_ids_1 = require("../../constants/data-test-ids");
var patient_store_1 = require("../../state/patient.store");
var form_1 = require("../form");
var layout_1 = require("../layout");
var SettingsContainer = function () {
    var _a, _b, _c, _d, _e, _f, _g;
    var patient = (0, patient_store_1.usePatientStore)().patient;
    var _h = (0, react_hook_form_1.useFormContext)(), control = _h.control, watch = _h.watch, setValue = _h.setValue;
    if (!patient)
        return null;
    var releaseOfInfo = (_b = (_a = patient === null || patient === void 0 ? void 0 : patient.extension) === null || _a === void 0 ? void 0 : _a.find(function (e) { return e.url === utils_1.PATIENT_RELEASE_OF_INFO_URL; })) === null || _b === void 0 ? void 0 : _b.valueBoolean;
    var rxHistoryConsentStatus = (_d = (_c = patient === null || patient === void 0 ? void 0 : patient.extension) === null || _c === void 0 ? void 0 : _c.find(function (e) { return e.url === utils_1.PATIENT_RX_HISTORY_CONSENT_STATUS_URL; })) === null || _d === void 0 ? void 0 : _d.valueString;
    var deceasedNote = (_f = (_e = patient === null || patient === void 0 ? void 0 : patient.extension) === null || _e === void 0 ? void 0 : _e.find(function (e) { return e.url === utils_1.PATIENT_DECEASED_NOTE_URL; })) === null || _f === void 0 ? void 0 : _f.valueString;
    var deceased = watch(utils_1.patientFieldPaths.deceased);
    var deceasedDate = watch(utils_1.patientFieldPaths.deceasedDate);
    return (<layout_1.Section title="User settings">
      <layout_1.Row label="Release of info" required>
        <react_hook_form_1.Controller name={utils_1.patientFieldPaths.releaseOfInfo} control={control} defaultValue={releaseOfInfo === undefined ? '' : String(releaseOfInfo)} rules={{ required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE }} render={function (_a) {
            var field = _a.field, error = _a.fieldState.error;
            return (<material_1.Box sx={{ width: '100%' }}>
              <material_1.Select data-testid={data_test_ids_1.dataTestIds.userSettingsContainer.releaseOfInfoDropdown} {...field} value={field.value || ''} variant="standard" sx={{ width: '100%' }}>
                {[
                    { value: true, label: 'Yes, Release Allowed' },
                    { value: false, label: 'No, Release Not Allowed' },
                ].map(function (option) { return (<material_1.MenuItem key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </material_1.MenuItem>); })}
              </material_1.Select>
              {error && <material_1.FormHelperText error={true}>{error === null || error === void 0 ? void 0 : error.message}</material_1.FormHelperText>}
            </material_1.Box>);
        }}/>
      </layout_1.Row>
      <layout_1.Row label="Rx History Consent" required>
        <form_1.FormSelect data-testid={data_test_ids_1.dataTestIds.userSettingsContainer.RxHistoryConsentDropdown} name={utils_1.patientFieldPaths.rxHistoryConsentStatus} control={control} defaultValue={rxHistoryConsentStatus} options={constants_1.RX_HISTORY_CONSENT_OPTIONS} rules={{
            required: utils_1.REQUIRED_FIELD_ERROR_MESSAGE,
            validate: function (value) { return constants_1.RX_HISTORY_CONSENT_OPTIONS.some(function (option) { return option.value === value; }); },
        }}/>
      </layout_1.Row>
      <material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '5px',
        }}>
        <react_hook_form_1.Controller name={utils_1.patientFieldPaths.active} control={control} defaultValue={(_g = patient === null || patient === void 0 ? void 0 : patient.active) !== null && _g !== void 0 ? _g : true} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, field = __rest(_b, ["onChange", "value"]);
            return (<material_1.FormControlLabel control={<material_1.Checkbox {...field} checked={!value} onChange={function (e) {
                        var newActiveValue = !e.target.checked;
                        onChange(newActiveValue);
                    }}/>} label={<material_1.Typography>Inactive</material_1.Typography>}/>);
        }}/>
      </material_1.Box>
      <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
        <material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '5px',
        }}>
          <react_hook_form_1.Controller name={utils_1.patientFieldPaths.deceased} control={control} defaultValue={(patient === null || patient === void 0 ? void 0 : patient.deceasedBoolean) || Boolean(patient === null || patient === void 0 ? void 0 : patient.deceasedDateTime)} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, field = __rest(_b, ["onChange", "value"]);
            return (<material_1.FormControlLabel control={<material_1.Checkbox {...field} checked={value} onChange={function (e) {
                        var isChecked = e.target.checked;
                        onChange(isChecked);
                        if (!isChecked) {
                            if (deceasedDate) {
                                setValue(utils_1.patientFieldPaths.deceasedDate, '');
                            }
                        }
                        else {
                            setValue('deceasedDateType', 'unknown');
                        }
                    }}/>} label={<material_1.Typography>Deceased</material_1.Typography>}/>);
        }}/>
        </material_1.Box>
        {deceased && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 3 }}>
            <material_1.FormControl>
              <react_hook_form_1.Controller name="deceasedDateType" control={control} defaultValue={(patient === null || patient === void 0 ? void 0 : patient.deceasedDateTime) ? 'known' : 'unknown'} render={function (_a) {
                var field = _a.field;
                return (<material_1.RadioGroup {...field} value={field.value} onChange={function (e) {
                        field.onChange(e);
                        /*
                        const isDateKnown = e.target.value === 'known';
                        if (isDateKnown) {
                          updatePatientField(patientFieldPaths.deceasedDate, '');
                        } else {
                          updatePatientField(patientFieldPaths.deceasedDate, '');
                          updatePatientField(patientFieldPaths.deceased, true);
                          setValue(patientFieldPaths.deceasedDate, '');
                        }*/
                    }}>
                    <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <material_1.FormControlLabel value="known" control={<material_1.Radio />} label={<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <material_1.Typography sx={{ flex: 'none' }}>Deceased Date</material_1.Typography>
                            <form_1.BasicDatePicker name={utils_1.patientFieldPaths.deceasedDate} control={control} rules={{ required: field.value === 'known' ? utils_1.REQUIRED_FIELD_ERROR_MESSAGE : false }} disabled={field.value === 'unknown'} variant="outlined" defaultValue={patient === null || patient === void 0 ? void 0 : patient.deceasedDateTime} onChange={function (dateStr) {
                            var _a, _b;
                            var isoDateTime = (_b = (_a = (0, utils_1.createLocalDateTime)(dateStr)) === null || _a === void 0 ? void 0 : _a.toISO) === null || _b === void 0 ? void 0 : _b.call(_a);
                            if (isoDateTime) {
                                /*
                                updatePatientField(patientFieldPaths.deceased, '');
                                updatePatientField(patientFieldPaths.deceasedDate, isoDateTime);
                                */
                            }
                        }}/>
                          </material_1.Box>}/>
                    </material_1.Box>
                    <material_1.FormControlLabel value="unknown" control={<material_1.Radio />} label={<material_1.Typography>Date Unknown</material_1.Typography>}/>
                  </material_1.RadioGroup>);
            }}/>
            </material_1.FormControl>
            <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', gap: '5px' }}>
              <react_hook_form_1.Controller name={utils_1.patientFieldPaths.deceasedNote} control={control} defaultValue={deceasedNote || ''} render={function (_a) {
                var field = _a.field;
                return (<material_1.TextField {...field} value={field.value} onChange={function (e) {
                        field.onChange(e);
                        // handleChange(e);
                    }} label="Note" fullWidth InputLabelProps={{
                        shrink: true,
                        sx: {
                            fontWeight: 'bold',
                        },
                    }}/>);
            }}/>
            </material_1.Box>
          </material_1.Box>)}
      </material_1.Box>
    </layout_1.Section>);
};
exports.SettingsContainer = SettingsContainer;
//# sourceMappingURL=SettingsContainer.js.map