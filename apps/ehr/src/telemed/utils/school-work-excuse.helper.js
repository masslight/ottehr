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
exports.mapValuesToExcuse = exports.getDefaultExcuseFormValues = exports.mapExcuseFieldsToLabels = exports.noteExcuseFields = exports.dateExcuseFields = exports.schoolExcuseFields = exports.workExcuseFields = exports.mapExcuseTypeToFields = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
exports.mapExcuseTypeToFields = {
    workTemplate: ['headerNote', 'workFields', 'footerNote'],
    workFree: ['headerNote'],
    schoolTemplate: ['headerNote', 'schoolFields', 'footerNote'],
    schoolFree: ['headerNote'],
};
exports.workExcuseFields = [
    'wereWithThePatientAtTheTimeOfTheVisit',
    'areNeededAtHomeToCareForChildDuringThisIllness',
    'workExcusedFromWorkFromTo',
    'workExcusedFromWorkOn',
];
exports.schoolExcuseFields = [
    'excusedFromSchoolFromTo',
    'excusedFromSchoolOn',
    'excusedFromSchoolUntilFeverFreeFor24Hours',
    'excusedFromSchoolUntilOnAntibioticsFor24Hours',
    'ableToReturnToSchoolWithoutRestriction',
    'ableToReturnToGymActivitiesWithoutRestriction',
    'ableToReturnToSchoolWhenThereNoLongerIsAnyEyeDischarge',
    'excusedFromGymActivitiesFromTo',
    'ableToReturnToSchoolWithTheFollowingRestrictions',
    'dominantHandIsInjuredPleaseAllowAccommodations',
    'needsExtraTimeBetweenClassesAssistantOrBookBuddy',
    'otherRestrictions',
    'allowedUseOfCrutchesAceWrapSplintAndElevatorAsNecessary',
    'allowedUseOfElevatorAsNecessary',
    'unableToParticipateInGymActivitiesUntilClearedByAPhysician',
    'schoolExcusedFromWorkFromTo',
    'schoolExcusedFromWorkOn',
    'ableToReturnToWorkWithTheFollowingRestrictions',
    'other',
];
exports.dateExcuseFields = [
    'schoolExcusedFromWorkFromDate',
    'schoolExcusedFromWorkToDate',
    'schoolExcusedFromWorkOnDate',
    'workExcusedFromWorkFromDate',
    'workExcusedFromWorkToDate',
    'workExcusedFromWorkOnDate',
    'excusedFromSchoolFromDate',
    'excusedFromSchoolToDate',
    'excusedFromSchoolOnDate',
    'excusedFromGymActivitiesFromDate',
    'excusedFromGymActivitiesToDate',
];
exports.noteExcuseFields = [
    'parentName',
    'headerNote',
    'footerNote',
    'otherRestrictionsNote',
    'ableToReturnToWorkWithTheFollowingRestrictionsNote',
    'otherNote',
];
exports.mapExcuseFieldsToLabels = {
    wereWithThePatientAtTheTimeOfTheVisit: 'were with the patient at the time of the visit',
    areNeededAtHomeToCareForChildDuringThisIllness: 'are needed at home to care for child during this illness',
    schoolExcusedFromWorkFromTo: 'excused from work from - to',
    schoolExcusedFromWorkOn: 'excused from work on',
    workExcusedFromWorkFromTo: 'are excused from work from - to',
    workExcusedFromWorkOn: 'are excused from work on',
    excusedFromSchoolFromTo: 'excused from school from - to',
    excusedFromSchoolOn: 'excused from school on',
    excusedFromSchoolUntilFeverFreeFor24Hours: 'excused from school until fever free for 24 hours',
    excusedFromSchoolUntilOnAntibioticsFor24Hours: 'excused from school until on antibiotics for 24 hours',
    ableToReturnToSchoolWithoutRestriction: 'able to return to school without restriction',
    ableToReturnToGymActivitiesWithoutRestriction: 'able to return to gym/activities without restriction',
    ableToReturnToSchoolWhenThereNoLongerIsAnyEyeDischarge: 'able to return to school when there no longer is any eye discharge',
    excusedFromGymActivitiesFromTo: 'excused from gym/activities from - to',
    ableToReturnToSchoolWithTheFollowingRestrictions: 'able to return to school with the following restrictions:',
    dominantHandIsInjuredPleaseAllowAccommodations: 'dominant hand is injured, please allow accommodations',
    needsExtraTimeBetweenClassesAssistantOrBookBuddy: 'needs extra time between classes, assistant or book buddy',
    otherRestrictions: 'other',
    allowedUseOfCrutchesAceWrapSplintAndElevatorAsNecessary: 'allowed use of crutches, ace wrap, splint and elevator as necessary',
    allowedUseOfElevatorAsNecessary: 'allowed use of elevator as necessary',
    unableToParticipateInGymActivitiesUntilClearedByAPhysician: 'unable to participate in gym activities until cleared by a physician',
    ableToReturnToWorkWithTheFollowingRestrictions: 'able to return to work with the following restrictions',
    other: 'other',
};
var mapCompositeExcuseFieldsToLabels = {
    schoolExcusedFromWorkFromTo: function (values) {
        return "excused from work from ".concat(values.schoolExcusedFromWorkFromDate.toFormat('MM/dd/yyyy'), " to ").concat(values.schoolExcusedFromWorkToDate.toFormat('MM/dd/yyyy'));
    },
    schoolExcusedFromWorkOn: function (values) {
        return "excused from work on ".concat(values.schoolExcusedFromWorkOnDate.toFormat('MM/dd/yyyy'));
    },
    workExcusedFromWorkFromTo: function (values) {
        return "excused from work from ".concat(values.workExcusedFromWorkFromDate.toFormat('MM/dd/yyyy'), " to ").concat(values.workExcusedFromWorkToDate.toFormat('MM/dd/yyyy'));
    },
    workExcusedFromWorkOn: function (values) {
        return "excused from work on ".concat(values.workExcusedFromWorkOnDate.toFormat('MM/dd/yyyy'));
    },
    excusedFromSchoolFromTo: function (values) {
        return "excused from school from ".concat(values.excusedFromSchoolFromDate.toFormat('MM/dd/yyyy'), " to ").concat(values.excusedFromSchoolToDate.toFormat('MM/dd/yyyy'));
    },
    excusedFromSchoolOn: function (values) {
        return "excused from school on ".concat(values.excusedFromSchoolOnDate.toFormat('MM/dd/yyyy'));
    },
    excusedFromGymActivitiesFromTo: function (values) {
        return "excused from gym/activities from ".concat(values.excusedFromGymActivitiesFromDate.toFormat('MM/dd/yyyy'), " to ").concat(values.excusedFromGymActivitiesToDate.toFormat('MM/dd/yyyy'));
    },
    otherRestrictions: function (values) { return values.otherRestrictionsNote; },
    other: function (values) { return values.otherNote; },
};
var getDefaultExcuseFormValues = function (params) {
    var defaultFormValues = __assign(__assign(__assign(__assign(__assign({}, exports.noteExcuseFields.reduce(function (prev, curr) {
        var _a;
        return (__assign(__assign({}, prev), (_a = {}, _a[curr] = '', _a)));
    }, {})), exports.dateExcuseFields.reduce(function (prev, curr) {
        var _a;
        return (__assign(__assign({}, prev), (_a = {}, _a[curr] = null, _a)));
    }, {})), exports.schoolExcuseFields.reduce(function (prev, curr) {
        var _a;
        return (__assign(__assign({}, prev), (_a = {}, _a[curr] = false, _a)));
    }, {})), exports.workExcuseFields.reduce(function (prev, curr) {
        var _a;
        return (__assign(__assign({}, prev), (_a = {}, _a[curr] = false, _a)));
    }, {})), { schoolExcusedFromWorkFromDate: luxon_1.DateTime.now(), schoolExcusedFromWorkOnDate: luxon_1.DateTime.now(), workExcusedFromWorkFromDate: luxon_1.DateTime.now(), workExcusedFromWorkOnDate: luxon_1.DateTime.now(), excusedFromSchoolFromDate: luxon_1.DateTime.now(), excusedFromSchoolOnDate: luxon_1.DateTime.now(), excusedFromGymActivitiesFromDate: luxon_1.DateTime.now() });
    var currentDate = luxon_1.DateTime.now().toFormat('MM/dd/yyyy');
    if (params.parentName) {
        defaultFormValues.parentName = params.parentName;
    }
    var headerNoteName = params.isSchool
        ? "".concat(params.patientName || '{Patient name}', ", the child of ").concat(params.parentName || '{Parent/Guardian name}', ",")
        : "".concat(params.patientName || '{Patient name}', ",");
    var headerNoteEnding = !params.isSchool && params.isTemplate ? 'They:' : 'They are:';
    defaultFormValues.headerNote = "To whom it may concern:\n".concat(headerNoteName, " was treated by ").concat(utils_1.PROJECT_NAME, " on ").concat(currentDate, ". ").concat(headerNoteEnding);
    if (params.isTemplate) {
        if (params.phoneNumber) {
            defaultFormValues.footerNote = "For any questions, please do not hesitate to call ".concat(params.phoneNumber, ".\n");
        }
        defaultFormValues.footerNote += "Sincerely,\n".concat(params.providerName || '{Provider name}', ", ").concat(params.suffix || 'Medical Doctor');
    }
    return defaultFormValues;
};
exports.getDefaultExcuseFormValues = getDefaultExcuseFormValues;
var mapValuesToExcuse = function (values, params) {
    var excuse = {
        type: params.isSchool ? 'school' : 'work',
        documentHeader: params.isSchool
            ? "School note for ".concat(params.patientName || 'Unknown')
            : "Work note for ".concat(values.parentName),
        parentGuardianName: values.parentName || 'Unknown',
        headerNote: values.headerNote,
        footerNote: values.footerNote,
        providerDetails: {
            credentials: params.suffix || '',
            name: params.providerName || 'Unknown',
        },
    };
    if (params.isTemplate) {
        excuse.bulletItems = [];
        var subFields_1 = {
            ableToReturnToSchoolWithTheFollowingRestrictions: [
                'dominantHandIsInjuredPleaseAllowAccommodations',
                'needsExtraTimeBetweenClassesAssistantOrBookBuddy',
                'otherRestrictions',
            ],
        };
        var currentSubFields_1;
        var excuseFields = params.isSchool ? exports.schoolExcuseFields : exports.workExcuseFields;
        excuseFields.forEach(function (field) {
            if (!values[field]) {
                return;
            }
            var func = mapCompositeExcuseFieldsToLabels[field];
            var str = func ? func(values) : exports.mapExcuseFieldsToLabels[field];
            if (subFields_1[field]) {
                currentSubFields_1 = subFields_1[field];
            }
            if (currentSubFields_1 === null || currentSubFields_1 === void 0 ? void 0 : currentSubFields_1.includes(field)) {
                var currentItem = excuse.bulletItems.at(-1);
                if (!currentItem.subItems) {
                    currentItem.subItems = [];
                }
                currentItem.subItems.push({
                    text: str,
                });
            }
            else {
                excuse.bulletItems.push({
                    text: str,
                });
            }
        });
        if (excuse.bulletItems.length === 0) {
            delete excuse.bulletItems;
        }
    }
    return excuse;
};
exports.mapValuesToExcuse = mapValuesToExcuse;
//# sourceMappingURL=school-work-excuse.helper.js.map