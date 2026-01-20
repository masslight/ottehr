"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExamObservationComments = exports.createAdditionalQuestions = void 0;
exports.getAllExamFieldsMetadata = getAllExamFieldsMetadata;
exports.createExamObservations = createExamObservations;
var utils_1 = require("utils");
var createAdditionalQuestions = function (questionnaireResponse) {
    var questionnaireFields = utils_1.patientScreeningQuestionsConfig.fields.filter(function (field) { return field.existsInQuestionnaire; });
    return questionnaireFields
        .filter(function (field) {
        var _a, _b;
        var response = (0, utils_1.getQuestionnaireResponseByLinkId)(field.fhirField, questionnaireResponse);
        var valueString = (_b = (_a = response === null || response === void 0 ? void 0 : response.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueString;
        return valueString !== undefined;
    })
        .map(function (field) {
        var _a, _b;
        if (field.type !== 'radio') {
            throw Error('Only radio fields are supported. No options found for field: ' + field.fhirField);
        }
        var response = (0, utils_1.getQuestionnaireResponseByLinkId)(field.fhirField, questionnaireResponse);
        var valueString = (_b = (_a = response === null || response === void 0 ? void 0 : response.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueString;
        var hasOnlyYesNoOptions = field.options &&
            field.options.length === 2 &&
            field.options.every(function (opt) {
                var lowerCaseValueString = opt.fhirValue.toLowerCase();
                return lowerCaseValueString === 'yes' || lowerCaseValueString === 'no';
            });
        if (!hasOnlyYesNoOptions) {
            throw Error('Only radio fields with Yes/No options are supported. No options found for field: ' + field.fhirField);
        }
        var value = (0, utils_1.convertToBoolean)(valueString);
        if (typeof value !== 'boolean') {
            throw Error('Invalid value for field: ' + field.fhirField);
        }
        return {
            field: field.fhirField,
            value: value,
        };
    });
};
exports.createAdditionalQuestions = createAdditionalQuestions;
function getAllExamFieldsMetadata(isInPersonAppointment) {
    var config = utils_1.examConfig[isInPersonAppointment ? 'inPerson' : 'telemed'].default.components;
    var observations = [];
    var extractObservationsFromComponents = function (components, section) {
        Object.entries(components).forEach(function (_a) {
            var fieldName = _a[0], component = _a[1];
            if (component.type === 'checkbox') {
                observations.push({
                    field: fieldName,
                    value: component.defaultValue || false,
                    label: component.label,
                    code: component.code,
                    bodySite: component.bodySite,
                });
            }
            else if (component.type === 'dropdown') {
                Object.entries(component.components).forEach(function (_a) {
                    var optionName = _a[0], option = _a[1];
                    observations.push({
                        field: optionName,
                        value: option.defaultValue || false,
                        label: option.label,
                        code: option.code,
                        bodySite: option.bodySite,
                    });
                });
            }
            else if (component.type === 'column') {
                extractObservationsFromComponents(component.components, section);
            }
            else if (component.type === 'form') {
                Object.entries(component.components).forEach(function (_a) {
                    var elementName = _a[0], element = _a[1];
                    observations.push({
                        field: elementName,
                        value: element.defaultValue || false,
                        label: element.label,
                        code: element.code,
                        bodySite: element.bodySite,
                    });
                });
            }
            else if (component.type === 'multi-select') {
                observations.push({
                    field: fieldName,
                    value: component.defaultValue || false,
                    label: component.label,
                    code: component.code,
                    bodySite: component.bodySite,
                });
                Object.entries(component.options).forEach(function (_a) {
                    var optionName = _a[0], option = _a[1];
                    observations.push({
                        field: optionName,
                        value: option.defaultValue || false,
                        label: option.label,
                        code: option.code,
                        bodySite: option.bodySite,
                    });
                });
            }
        });
    };
    Object.values(config).forEach(function (examItem) {
        extractObservationsFromComponents(examItem.components.normal, 'normal');
        extractObservationsFromComponents(examItem.components.abnormal, 'abnormal');
    });
    return observations;
}
function createExamObservations(isInPersonAppointment) {
    var config = utils_1.examConfig[isInPersonAppointment ? 'inPerson' : 'telemed'].default.components;
    var observations = [];
    var extractObservationsFromComponents = function (components, section) {
        Object.entries(components).forEach(function (_a) {
            var fieldName = _a[0], component = _a[1];
            if (component.type === 'checkbox') {
                if (component.defaultValue === true) {
                    observations.push({
                        field: fieldName,
                        value: true,
                        label: component.label,
                        code: component.code,
                        bodySite: component.bodySite,
                    });
                }
            }
            else if (component.type === 'dropdown') {
                Object.entries(component.components).forEach(function (_a) {
                    var optionName = _a[0], option = _a[1];
                    if (option.defaultValue === true) {
                        observations.push({
                            field: optionName,
                            value: true,
                            label: option.label,
                            code: option.code,
                            bodySite: option.bodySite,
                        });
                    }
                });
            }
            else if (component.type === 'column') {
                extractObservationsFromComponents(component.components, section);
            }
            else if (component.type === 'form') {
                Object.entries(component.components).forEach(function (_a) {
                    var elementName = _a[0], element = _a[1];
                    if (element.defaultValue === true) {
                        observations.push({
                            field: elementName,
                            value: true,
                            label: element.label,
                            code: element.code,
                            bodySite: element.bodySite,
                        });
                    }
                });
            }
            else if (component.type === 'multi-select') {
                if (component.defaultValue === true) {
                    observations.push({
                        field: fieldName,
                        value: true,
                        label: component.label,
                        code: component.code,
                        bodySite: component.bodySite,
                    });
                }
                Object.entries(component.options).forEach(function (_a) {
                    var optionName = _a[0], option = _a[1];
                    if (option.defaultValue === true) {
                        observations.push({
                            field: optionName,
                            value: true,
                            label: option.label,
                            code: option.code,
                            bodySite: option.bodySite,
                        });
                    }
                });
            }
        });
    };
    Object.values(config).forEach(function (examItem) {
        extractObservationsFromComponents(examItem.components.normal, 'normal');
        extractObservationsFromComponents(examItem.components.abnormal, 'abnormal');
    });
    return observations;
}
var createExamObservationComments = function (isInPersonAppointment) {
    var config = utils_1.examConfig[isInPersonAppointment ? 'inPerson' : 'telemed'].default.components;
    var comments = [];
    Object.values(config).forEach(function (examItem) {
        Object.keys(examItem.components.comment).forEach(function (fieldName) {
            comments.push({ field: fieldName, label: examItem.components.comment[fieldName].label });
        });
    });
    return comments;
};
exports.createExamObservationComments = createExamObservationComments;
