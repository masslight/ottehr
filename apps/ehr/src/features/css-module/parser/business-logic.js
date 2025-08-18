"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeight = exports.getPronouns = exports.getPatientInfoWithFallback = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var constants_1 = require("./constants");
var getPatientInfoWithFallback = function (patient, questionnaire) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    return ({
        firstName: (_a = patient.firstName) !== null && _a !== void 0 ? _a : questionnaire.firstName,
        lastName: (_b = patient.lastName) !== null && _b !== void 0 ? _b : questionnaire.lastName,
        birthDate: (_c = patient.birthDate) !== null && _c !== void 0 ? _c : questionnaire.birthDate,
        addressStreet1: (_e = (_d = patient.address) === null || _d === void 0 ? void 0 : _d.street1) !== null && _e !== void 0 ? _e : questionnaire.addressStreet1,
        addressStreet2: (_g = (_f = patient.address) === null || _f === void 0 ? void 0 : _f.street2) !== null && _g !== void 0 ? _g : questionnaire.addressStreet2,
        addressCity: (_j = (_h = patient.address) === null || _h === void 0 ? void 0 : _h.city) !== null && _j !== void 0 ? _j : questionnaire.addressCity,
        addressState: (_l = (_k = patient.address) === null || _k === void 0 ? void 0 : _k.state) !== null && _l !== void 0 ? _l : questionnaire.addressState,
        addressZip: (_o = (_m = patient.address) === null || _m === void 0 ? void 0 : _m.postalCode) !== null && _o !== void 0 ? _o : questionnaire.addressZip,
        race: (_p = patient.race) !== null && _p !== void 0 ? _p : questionnaire.race,
        ethnicity: (_q = patient.ethnicity) !== null && _q !== void 0 ? _q : questionnaire.ethnicity,
        email: (_r = patient.email) !== null && _r !== void 0 ? _r : questionnaire.guardianEmail,
        phone: (_s = patient.phone) !== null && _s !== void 0 ? _s : questionnaire.guardianNumber,
    });
};
exports.getPatientInfoWithFallback = getPatientInfoWithFallback;
var getPronouns = function (questionnaire) {
    var pronouns = questionnaire.pronouns;
    var customPronouns = questionnaire.customPronouns;
    var patientPronounsNotListedValues = ['My pronounces are not listed', 'My pronouns are not listed'];
    return patientPronounsNotListedValues.includes(pronouns !== null && pronouns !== void 0 ? pronouns : '') ? customPronouns : pronouns;
};
exports.getPronouns = getPronouns;
var getWeight = function (patientValues) {
    var weight = patientValues.weight, weightLastUpdated = patientValues.weightLastUpdated;
    if (weight && weightLastUpdated) {
        var weightInKg = Math.round(Number(weight) * constants_1.LBS_TO_KG_FACTOR * constants_1.WEIGHT_ROUNDING_PRECISION) / constants_1.WEIGHT_ROUNDING_PRECISION;
        var formattedDate = luxon_1.DateTime.fromFormat(weightLastUpdated, utils_1.DATE_FORMAT).toFormat(utils_1.DISPLAY_DATE_FORMAT);
        return "".concat(weightInKg, " kg (updated ").concat(formattedDate, ")");
    }
    return undefined;
};
exports.getWeight = getWeight;
//# sourceMappingURL=business-logic.js.map