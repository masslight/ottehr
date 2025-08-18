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
exports.getHospitalizations = exports.getAllergies = exports.getResources = exports.extractUrlsFromAppointmentData = exports.getQuestionnaireResponseValues = exports.getEncounterValues = exports.getLocationValues = exports.getExtensionValue = exports.getPatientValues = exports.getAppointmentValues = exports.extractResourceValues = exports.getBooleanAnswer = exports.getStringAnswer = exports.getAnswer = void 0;
var utils_1 = require("utils");
var constants_1 = require("./constants");
var getAnswer = function (questionnaireResponse, linkId, valueKey) {
    var _a, _b, _c;
    var answer = (_c = (_b = (_a = questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.item) === null || _a === void 0 ? void 0 : _a.flatMap(function (item) { return item.item || [item]; }).find(function (item) { return item.linkId === linkId; })) === null || _b === void 0 ? void 0 : _b.answer) === null || _c === void 0 ? void 0 : _c[0];
    if (answer && valueKey in answer) {
        return answer[valueKey];
    }
    return undefined;
};
exports.getAnswer = getAnswer;
var getStringAnswer = function (questionnaireResponse, linkId) { return (0, exports.getAnswer)(questionnaireResponse, linkId, 'valueString'); };
exports.getStringAnswer = getStringAnswer;
var getBooleanAnswer = function (questionnaireResponse, linkId) { return (0, exports.getAnswer)(questionnaireResponse, linkId, 'valueBoolean'); };
exports.getBooleanAnswer = getBooleanAnswer;
var extractResourceValues = function (resource, keys) {
    if (!resource)
        return {};
    return keys.reduce(function (acc, key) {
        if (resource[key] !== undefined) {
            acc[key] = resource[key];
        }
        return acc;
    }, {});
};
exports.extractResourceValues = extractResourceValues;
var getAppointmentValues = function (appointment) {
    var _a;
    var values = (0, exports.extractResourceValues)(appointment, ['id', 'start', 'end', 'status', 'description']);
    return __assign(__assign({}, values), { appointmentType: (_a = appointment === null || appointment === void 0 ? void 0 : appointment.appointmentType) === null || _a === void 0 ? void 0 : _a.text });
};
exports.getAppointmentValues = getAppointmentValues;
var getPatientValues = function (patient) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    var values = (0, exports.extractResourceValues)(patient, ['id', 'gender', 'birthDate']);
    if (!patient)
        return values;
    return __assign(__assign({}, values), { firstName: (_c = (_b = (_a = patient.name) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.given) === null || _c === void 0 ? void 0 : _c[0], lastName: (_e = (_d = patient.name) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.family, address: __assign(__assign({}, (_f = patient.address) === null || _f === void 0 ? void 0 : _f[0]), { street1: (_j = (_h = (_g = patient.address) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.line) === null || _j === void 0 ? void 0 : _j[0], street2: (_m = (_l = (_k = patient.address) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.line) === null || _m === void 0 ? void 0 : _m[1] }), email: (_p = (_o = patient.telecom) === null || _o === void 0 ? void 0 : _o.find(function (telecom) { return telecom.system === 'email'; })) === null || _p === void 0 ? void 0 : _p.value, phone: (_r = (_q = patient.telecom) === null || _q === void 0 ? void 0 : _q.find(function (telecom) { return telecom.system === 'phone'; })) === null || _r === void 0 ? void 0 : _r.value, ethnicity: (0, exports.getExtensionValue)(patient, '/ethnicity'), race: (0, exports.getExtensionValue)(patient, '/race'), weight: (_t = (_s = patient.extension) === null || _s === void 0 ? void 0 : _s.find(function (extension) { return extension.url === constants_1.WEIGHT_EXTENSION_URL; })) === null || _t === void 0 ? void 0 : _t.valueString, weightLastUpdated: (_v = (_u = patient.extension) === null || _u === void 0 ? void 0 : _u.find(function (extension) { return extension.url === constants_1.WEIGHT_LAST_UPDATED_EXTENSION_URL; })) === null || _v === void 0 ? void 0 : _v.valueString });
};
exports.getPatientValues = getPatientValues;
var getExtensionValue = function (patient, extensionUrl) {
    var _a, _b, _c, _d, _e;
    return (_e = (_d = (_c = (_b = (_a = patient === null || patient === void 0 ? void 0 : patient.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) { return extension.url.includes(extensionUrl); })) === null || _b === void 0 ? void 0 : _b.valueCodeableConcept) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.display;
};
exports.getExtensionValue = getExtensionValue;
var getLocationValues = function (location) {
    var _a, _b, _c, _d, _e, _f;
    var values = (0, exports.extractResourceValues)(location, ['id', 'name']);
    if (!location)
        return __assign(__assign({}, values), { address: {} });
    return __assign(__assign({}, values), { address: __assign(__assign({}, location.address), { street1: (_b = (_a = location.address) === null || _a === void 0 ? void 0 : _a.line) === null || _b === void 0 ? void 0 : _b[0], street2: (_d = (_c = location.address) === null || _c === void 0 ? void 0 : _c.line) === null || _d === void 0 ? void 0 : _d[1] }), phone: (_f = (_e = location.telecom) === null || _e === void 0 ? void 0 : _e.find(function (telecom) { return telecom.system === 'phone'; })) === null || _f === void 0 ? void 0 : _f.value });
};
exports.getLocationValues = getLocationValues;
var getEncounterValues = function (encounter) {
    return (0, exports.extractResourceValues)(encounter, ['id', 'status']);
};
exports.getEncounterValues = getEncounterValues;
var getQuestionnaireResponseValues = function (questionnaireResponse) {
    if (!questionnaireResponse)
        return {};
    var questionnaireResponseKeys = {
        willBe18: 'patient-will-be-18',
        isNewPatient: 'is-new-qrs-patient',
        firstName: 'patient-first-name',
        lastName: 'patient-last-name',
        birthDateYear: 'patient-dob-year',
        birthDateMonth: 'patient-dob-month',
        birthDateDay: 'patient-dob-day',
        birthSex: 'patient-birth-sex',
        addressStreet1: 'patient-street-address',
        addressStreet2: 'patient-street-address-2',
        addressCity: 'patient-city',
        addressState: 'patient-state',
        addressZip: 'patient-zip',
        fillingOutAs: 'patient-filling-out-as',
        guardianEmail: 'guardian-email',
        guardianNumber: 'guardian-number',
        ethnicity: 'patient-ethnicity',
        race: 'patient-race',
        pronouns: 'patient-pronouns',
        customPronouns: 'patient-pronouns-custom',
    };
    var result = {};
    for (var _i = 0, _a = Object.entries(questionnaireResponseKeys); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], linkId = _b[1];
        var stringValue = (0, exports.getStringAnswer)(questionnaireResponse, linkId);
        var booleanValue = (0, exports.getBooleanAnswer)(questionnaireResponse, linkId);
        result[key] = (stringValue !== null && stringValue !== void 0 ? stringValue : booleanValue);
    }
    if (result.birthDateYear && result.birthDateMonth && result.birthDateDay) {
        result.birthDate = "".concat(result.birthDateYear, "-").concat(result.birthDateMonth, "-").concat(result.birthDateDay);
    }
    return result;
};
exports.getQuestionnaireResponseValues = getQuestionnaireResponseValues;
var extractUrlsFromAppointmentData = function (resourceBundle, documentCode) {
    return resourceBundle
        .filter(function (resource) {
        var _a, _b;
        return resource.resourceType === 'DocumentReference' &&
            resource.status === 'current' &&
            ((_b = (_a = resource.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code) === documentCode;
    })
        .flatMap(function (documentReference) {
        return documentReference.content
            .map(function (content) { return content.attachment.url; })
            .filter(function (url) { return url !== undefined; });
    });
};
exports.extractUrlsFromAppointmentData = extractUrlsFromAppointmentData;
var getResources = function (resourceBundle) {
    var _a, _b, _c, _d;
    if (!resourceBundle)
        return {};
    var findResources = function (resourceType) {
        return resourceBundle.filter(function (resource) { return resource.resourceType === resourceType; });
    };
    var locations = findResources('Location');
    var virtualLocation = locations === null || locations === void 0 ? void 0 : locations.find(utils_1.isLocationVirtual);
    var physicalLocation = locations === null || locations === void 0 ? void 0 : locations.find(function (location) { return !(0, utils_1.isLocationVirtual)(location); });
    return {
        appointment: (_a = findResources('Appointment')) === null || _a === void 0 ? void 0 : _a[0],
        patient: (_b = findResources('Patient')) === null || _b === void 0 ? void 0 : _b[0],
        location: physicalLocation,
        locationVirtual: virtualLocation,
        encounter: (_c = findResources('Encounter')) === null || _c === void 0 ? void 0 : _c[0],
        questionnaireResponse: (_d = findResources('QuestionnaireResponse')) === null || _d === void 0 ? void 0 : _d[0],
    };
};
exports.getResources = getResources;
var getAllergies = function (questionnaireResponse) {
    var _a, _b, _c;
    var knownAllergies = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('allergies', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueArray;
    return knownAllergies
        ? knownAllergies.map(function (answer) { return answer['allergies-form-agent-substance']; }).join(', ')
        : undefined;
};
exports.getAllergies = getAllergies;
var getHospitalizations = function (questionnaireResponse) {
    var _a, _b, _c;
    var knownHospitalizations = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('hospitalization', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueArray;
    return knownHospitalizations ? knownHospitalizations.map(function (item) { return item.display; }) : undefined;
};
exports.getHospitalizations = getHospitalizations;
//# sourceMappingURL=extractors.js.map