"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateExcuseDialog = void 0;
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var useEvolveUser_1 = require("../../../../../hooks/useEvolveUser");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var utils_2 = require("../../../../utils");
var school_work_excuse_helper_1 = require("../../../../utils/school-work-excuse.helper");
var ControlledExcuseCheckbox_1 = require("./ControlledExcuseCheckbox");
var ControlledExcuseDatePicker_1 = require("./ControlledExcuseDatePicker");
var ControlledExcuseTextField_1 = require("./ControlledExcuseTextField");
var GenerateExcuseDialogContainer_1 = require("./GenerateExcuseDialogContainer");
var GenerateExcuseDialog = function (props) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    var open = props.open, onClose = props.onClose, type = props.type, generate = props.generate;
    var fields = utils_2.mapExcuseTypeToFields[type];
    var isSchool = ['schoolTemplate', 'schoolFree'].includes(type);
    var isTemplate = ['schoolTemplate', 'workTemplate'].includes(type);
    var _q = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'patient',
        'chartData',
        'setPartialChartData',
        'questionnaireResponse',
    ]), patient = _q.patient, chartData = _q.chartData, setPartialChartData = _q.setPartialChartData, questionnaireResponse = _q.questionnaireResponse;
    var user = (0, useEvolveUser_1.default)();
    var responsibleParty = {
        firstName: (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('responsible-party-first-name', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString,
        lastName: (_f = (_e = (_d = (0, utils_1.getQuestionnaireResponseByLinkId)('responsible-party-last-name', questionnaireResponse)) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString,
        relationship: (_j = (_h = (_g = (0, utils_1.getQuestionnaireResponseByLinkId)('responsible-party-relationship', questionnaireResponse)) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString,
    };
    var fullParentName = responsibleParty.firstName &&
        responsibleParty.lastName &&
        ['Parent', 'Legal Guardian'].includes((_k = responsibleParty.relationship) !== null && _k !== void 0 ? _k : '')
        ? "".concat(responsibleParty.firstName, " ").concat(responsibleParty.lastName)
        : '';
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: (0, utils_2.getDefaultExcuseFormValues)({
            isSchool: isSchool,
            isTemplate: isTemplate,
            patientName: (0, utils_2.getPatientName)(patient === null || patient === void 0 ? void 0 : patient.name).firstLastName,
            parentName: fullParentName,
            providerName: user === null || user === void 0 ? void 0 : user.userName,
            suffix: (_p = (_o = (_m = (_l = user === null || user === void 0 ? void 0 : user.profileResource) === null || _l === void 0 ? void 0 : _l.name) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.suffix) === null || _p === void 0 ? void 0 : _p.join(' '),
            phoneNumber: utils_1.PATIENT_SUPPORT_PHONE_NUMBER,
        }),
    });
    var handleSubmit = methods.handleSubmit, getValues = methods.getValues, setValue = methods.setValue;
    var onSubmit = function (values) {
        var excuse = (0, utils_2.mapValuesToExcuse)(values, {
            type: type,
            isSchool: isSchool,
            isTemplate: isTemplate,
            patientName: (0, utils_2.getPatientName)(patient === null || patient === void 0 ? void 0 : patient.name).firstLastName,
            providerName: user === null || user === void 0 ? void 0 : user.userName,
            suffix: (user === null || user === void 0 ? void 0 : user.profileResource) ? (0, utils_1.getAllPractitionerCredentials)(user === null || user === void 0 ? void 0 : user.profileResource).join(' ') : undefined,
        });
        generate({ newSchoolWorkNote: excuse }, {
            onSuccess: function (data) {
                var _a;
                var savedExcuses = (_a = data === null || data === void 0 ? void 0 : data.chartData) === null || _a === void 0 ? void 0 : _a.schoolWorkNotes;
                if (savedExcuses) {
                    setPartialChartData({
                        schoolWorkNotes: __spreadArray(__spreadArray([], ((chartData === null || chartData === void 0 ? void 0 : chartData.schoolWorkNotes) || []), true), savedExcuses, true),
                    });
                }
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while generating excuse. Please try again.', {
                    variant: 'error',
                });
            },
        });
        onClose();
    };
    return (<GenerateExcuseDialogContainer_1.GenerateExcuseDialogContainer open={open} onSubmit={handleSubmit(onSubmit)} onClose={onClose} label={isSchool ? 'School Excuse' : 'Work excuse'}>
      <react_hook_form_1.FormProvider {...methods}>
        <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
        }}>
          {fields.includes('headerNote') && (<ControlledExcuseTextField_1.ControlledExcuseTextField name="headerNote" label="Note" fullWidth multiline required/>)}

          {isTemplate && (<material_1.FormControl>
              <material_1.FormLabel>
                <material_1.Typography variant="subtitle2">Select whatever applies</material_1.Typography>
              </material_1.FormLabel>
              <material_1.FormGroup>
                {fields.includes('workFields') && (<>
                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="wereWithThePatientAtTheTimeOfTheVisit" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['wereWithThePatientAtTheTimeOfTheVisit']}/>
                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="areNeededAtHomeToCareForChildDuringThisIllness" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['areNeededAtHomeToCareForChildDuringThisIllness']}/>
                    <material_1.Box sx={{ display: 'flex' }}>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="workExcusedFromWorkFromTo" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['workExcusedFromWorkFromTo']}/>

                      <material_1.Box sx={{ display: 'flex', gap: 2 }}>
                        <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="workExcusedFromWorkFromDate" validate={function (value) {
                    if (getValues('workExcusedFromWorkFromTo') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                        <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="workExcusedFromWorkToDate" validate={function (value) {
                    if (getValues('workExcusedFromWorkFromTo') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                      </material_1.Box>
                    </material_1.Box>

                    <material_1.Box>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="workExcusedFromWorkOn" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['workExcusedFromWorkOn']}/>

                      <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="workExcusedFromWorkOnDate" validate={function (value) {
                    if (getValues('workExcusedFromWorkOn') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                    </material_1.Box>
                  </>)}

                {fields.includes('schoolFields') && (<>
                    <material_1.Box sx={{ display: 'flex' }}>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="excusedFromSchoolFromTo" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['excusedFromSchoolFromTo']}/>
                      <material_1.Box sx={{ display: 'flex', gap: 2 }}>
                        <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="excusedFromSchoolFromDate" validate={function (value) {
                    if (getValues('excusedFromSchoolFromTo') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                        <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="excusedFromSchoolToDate" validate={function (value) {
                    if (getValues('excusedFromSchoolFromTo') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                      </material_1.Box>
                    </material_1.Box>

                    <material_1.Box>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="excusedFromSchoolOn" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['excusedFromSchoolOn']}/>
                      <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="excusedFromSchoolOnDate" validate={function (value) {
                    if (getValues('excusedFromSchoolOn') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                    </material_1.Box>

                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="excusedFromSchoolUntilFeverFreeFor24Hours" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['excusedFromSchoolUntilFeverFreeFor24Hours']}/>
                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="excusedFromSchoolUntilOnAntibioticsFor24Hours" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['excusedFromSchoolUntilOnAntibioticsFor24Hours']}/>
                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="ableToReturnToSchoolWithoutRestriction" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['ableToReturnToSchoolWithoutRestriction']}/>
                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="ableToReturnToGymActivitiesWithoutRestriction" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['ableToReturnToGymActivitiesWithoutRestriction']}/>
                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="ableToReturnToSchoolWhenThereNoLongerIsAnyEyeDischarge" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['ableToReturnToSchoolWhenThereNoLongerIsAnyEyeDischarge']}/>

                    <material_1.Box sx={{ display: 'flex' }}>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="excusedFromGymActivitiesFromTo" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['excusedFromGymActivitiesFromTo']}/>

                      <material_1.Box sx={{ display: 'flex', gap: 2 }}>
                        <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="excusedFromGymActivitiesFromDate" validate={function (value) {
                    if (getValues('excusedFromGymActivitiesFromTo') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                        <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="excusedFromGymActivitiesToDate" validate={function (value) {
                    if (getValues('excusedFromGymActivitiesFromTo') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                      </material_1.Box>
                    </material_1.Box>

                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="ableToReturnToSchoolWithTheFollowingRestrictions" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['ableToReturnToSchoolWithTheFollowingRestrictions']}/>

                    <material_1.Box sx={{ display: 'flex', flexDirection: 'column', ml: 5 }}>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="dominantHandIsInjuredPleaseAllowAccommodations" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['dominantHandIsInjuredPleaseAllowAccommodations']} onChange={function (newValue) {
                    return newValue && setValue('ableToReturnToSchoolWithTheFollowingRestrictions', true);
                }}/>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="needsExtraTimeBetweenClassesAssistantOrBookBuddy" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['needsExtraTimeBetweenClassesAssistantOrBookBuddy']} onChange={function (newValue) {
                    return newValue && setValue('ableToReturnToSchoolWithTheFollowingRestrictions', true);
                }}/>

                      <material_1.Box>
                        <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="otherRestrictions" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['otherRestrictions']} onChange={function (newValue) {
                    return newValue && setValue('ableToReturnToSchoolWithTheFollowingRestrictions', true);
                }}/>

                        <ControlledExcuseTextField_1.ControlledExcuseTextField name="otherRestrictionsNote" placeholder="Please specify" validate={function (value) {
                    if (getValues('otherRestrictions') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                      </material_1.Box>
                    </material_1.Box>

                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="allowedUseOfCrutchesAceWrapSplintAndElevatorAsNecessary" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['allowedUseOfCrutchesAceWrapSplintAndElevatorAsNecessary']}/>
                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="allowedUseOfElevatorAsNecessary" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['allowedUseOfElevatorAsNecessary']}/>
                    <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="unableToParticipateInGymActivitiesUntilClearedByAPhysician" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['unableToParticipateInGymActivitiesUntilClearedByAPhysician']}/>

                    <material_1.Box sx={{ display: 'flex' }}>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="schoolExcusedFromWorkFromTo" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['schoolExcusedFromWorkFromTo']}/>

                      <material_1.Box sx={{ display: 'flex', gap: 2 }}>
                        <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="schoolExcusedFromWorkFromDate" validate={function (value) {
                    if (getValues('schoolExcusedFromWorkFromTo') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                        <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="schoolExcusedFromWorkToDate" validate={function (value) {
                    if (getValues('schoolExcusedFromWorkFromTo') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                      </material_1.Box>
                    </material_1.Box>

                    <material_1.Box>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="schoolExcusedFromWorkOn" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['schoolExcusedFromWorkOn']}/>

                      <ControlledExcuseDatePicker_1.ControlledExcuseDatePicker name="schoolExcusedFromWorkOnDate" validate={function (value) {
                    if (getValues('schoolExcusedFromWorkOn') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                    </material_1.Box>

                    <material_1.Box>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="ableToReturnToWorkWithTheFollowingRestrictions" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['ableToReturnToWorkWithTheFollowingRestrictions']}/>

                      <ControlledExcuseTextField_1.ControlledExcuseTextField name="ableToReturnToWorkWithTheFollowingRestrictionsNote" placeholder="Please specify" validate={function (value) {
                    if (getValues('ableToReturnToWorkWithTheFollowingRestrictions') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                    </material_1.Box>
                    <material_1.Box>
                      <ControlledExcuseCheckbox_1.ControlledExcuseCheckbox name="other" label={school_work_excuse_helper_1.mapExcuseFieldsToLabels['other']}/>

                      <ControlledExcuseTextField_1.ControlledExcuseTextField name="otherNote" placeholder="Please specify" validate={function (value) {
                    if (getValues('other') && !value) {
                        return 'Field is required';
                    }
                    return;
                }}/>
                    </material_1.Box>
                  </>)}
              </material_1.FormGroup>
            </material_1.FormControl>)}

          {fields.includes('footerNote') && (<ControlledExcuseTextField_1.ControlledExcuseTextField name="footerNote" label="Note" fullWidth multiline required/>)}
        </material_1.Box>
      </react_hook_form_1.FormProvider>
    </GenerateExcuseDialogContainer_1.GenerateExcuseDialogContainer>);
};
exports.GenerateExcuseDialog = GenerateExcuseDialog;
//# sourceMappingURL=GenerateExcuseDialog.js.map