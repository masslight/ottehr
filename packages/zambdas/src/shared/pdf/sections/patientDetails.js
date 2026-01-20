"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPatientDetailsSection = exports.composePatientDetailsData = void 0;
var utils_1 = require("utils");
var pdf_common_1 = require("../pdf-common");
var composePatientDetailsData = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16;
    var patient = _a.patient;
    var patientsEthnicity = (_g = (_f = (_e = (_d = (_c = (_b = patient.extension) === null || _b === void 0 ? void 0 : _b.find(function (e) { return e.url === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/ethnicity"); })) === null || _c === void 0 ? void 0 : _c.valueCodeableConcept) === null || _d === void 0 ? void 0 : _d.coding) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.display) !== null && _g !== void 0 ? _g : '';
    var patientsRace = (_o = (_m = (_l = (_k = (_j = (_h = patient.extension) === null || _h === void 0 ? void 0 : _h.find(function (e) { return e.url === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/race"); })) === null || _j === void 0 ? void 0 : _j.valueCodeableConcept) === null || _k === void 0 ? void 0 : _k.coding) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.display) !== null && _o !== void 0 ? _o : '';
    var howDidYouHearAboutUs = (_r = (_q = (_p = patient.extension) === null || _p === void 0 ? void 0 : _p.find(function (e) { return e.url === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/point-of-discovery"); })) === null || _q === void 0 ? void 0 : _q.valueString) !== null && _r !== void 0 ? _r : '';
    var preferredLanguage = (_v = (_u = (_t = (_s = patient.communication) === null || _s === void 0 ? void 0 : _s.find(function (lang) { return lang.preferred; })) === null || _t === void 0 ? void 0 : _t.language.coding) === null || _u === void 0 ? void 0 : _u[0].display) !== null && _v !== void 0 ? _v : '';
    var patientSendMarketing = (_y = (_x = (_w = patient.extension) === null || _w === void 0 ? void 0 : _w.find(function (e) { return e.url === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/send-marketing"); })) === null || _x === void 0 ? void 0 : _x.valueBoolean) !== null && _y !== void 0 ? _y : false;
    var patientCommonWellConsent = (_1 = (_0 = (_z = patient.extension) === null || _z === void 0 ? void 0 : _z.find(function (e) { return e.url === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/common-well-consent"); })) === null || _0 === void 0 ? void 0 : _0.valueBoolean) !== null && _1 !== void 0 ? _1 : false;
    var patientSexualOrientation = (_7 = (_6 = (_5 = (_4 = (_3 = (_2 = patient.extension) === null || _2 === void 0 ? void 0 : _2.find(function (e) { return e.url === utils_1.PATIENT_SEXUAL_ORIENTATION_URL; })) === null || _3 === void 0 ? void 0 : _3.valueCodeableConcept) === null || _4 === void 0 ? void 0 : _4.coding) === null || _5 === void 0 ? void 0 : _5[0]) === null || _6 === void 0 ? void 0 : _6.display) !== null && _7 !== void 0 ? _7 : '';
    var patientGenderIdentity = (_13 = (_12 = (_11 = (_10 = (_9 = (_8 = patient.extension) === null || _8 === void 0 ? void 0 : _8.find(function (e) { return e.url === utils_1.PATIENT_GENDER_IDENTITY_URL; })) === null || _9 === void 0 ? void 0 : _9.valueCodeableConcept) === null || _10 === void 0 ? void 0 : _10.coding) === null || _11 === void 0 ? void 0 : _11[0]) === null || _12 === void 0 ? void 0 : _12.display) !== null && _13 !== void 0 ? _13 : '';
    var patientGenderIdentityDetails = (_16 = (_15 = (_14 = patient.extension) === null || _14 === void 0 ? void 0 : _14.find(function (e) { return e.url === "".concat(utils_1.PRIVATE_EXTENSION_BASE_URL, "/individual-genderIdentity"); })) === null || _15 === void 0 ? void 0 : _15.valueString) !== null && _16 !== void 0 ? _16 : '';
    return {
        patientsEthnicity: patientsEthnicity,
        patientsRace: patientsRace,
        patientSexualOrientation: patientSexualOrientation,
        patientGenderIdentity: patientGenderIdentity,
        patientGenderIdentityDetails: patientGenderIdentityDetails,
        howDidYouHearAboutUs: howDidYouHearAboutUs,
        patientSendMarketing: patientSendMarketing,
        preferredLanguage: preferredLanguage,
        patientCommonWellConsent: patientCommonWellConsent,
    };
};
exports.composePatientDetailsData = composePatientDetailsData;
var createPatientDetailsSection = function () {
    return (0, pdf_common_1.createConfiguredSection)('patientDetails', function (shouldShow) { return ({
        title: 'Patient details',
        dataSelector: function (data) { return data.details; },
        render: function (client, details, styles) {
            if (shouldShow('patient-ethnicity')) {
                client.drawLabelValueRow('Ethnicity', details.patientsEthnicity, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-race')) {
                client.drawLabelValueRow('Race', details.patientsRace, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-sexual-orientation')) {
                client.drawLabelValueRow('Sexual orientation', details.patientSexualOrientation, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-gender-identity')) {
                client.drawLabelValueRow('Gender identity', details.patientGenderIdentity, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-gender-identity-details') && details.patientGenderIdentity === 'Other') {
                client.drawLabelValueRow('', details.patientGenderIdentityDetails, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('patient-point-of-discovery')) {
                client.drawLabelValueRow('How did you hear about us', details.howDidYouHearAboutUs, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('mobile-opt-in')) {
                client.drawLabelValueRow('Send marketing messages', details.patientSendMarketing ? 'Yes' : 'No', styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('preferred-language')) {
                client.drawLabelValueRow('Preferred language', details.preferredLanguage, styles.textStyles.regular, styles.textStyles.regular, {
                    drawDivider: true,
                    dividerMargin: 8,
                });
            }
            if (shouldShow('common-well-consent')) {
                client.drawLabelValueRow('CommonWell consent', details.patientCommonWellConsent ? 'Yes' : 'No', styles.textStyles.regular, styles.textStyles.regular, {
                    spacing: 16,
                });
            }
        },
    }); });
};
exports.createPatientDetailsSection = createPatientDetailsSection;
