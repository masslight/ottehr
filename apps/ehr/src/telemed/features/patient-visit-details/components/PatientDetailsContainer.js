"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientDetailsContainer = void 0;
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var InformationCard_1 = require("./InformationCard");
var PatientDetailsContainer = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7;
    var _8 = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['patient', 'questionnaireResponse']), patient = _8.patient, questionnaireResponse = _8.questionnaireResponse;
    var ethnicity = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-ethnicity', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString;
    var race = (_f = (_e = (_d = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-race', questionnaireResponse)) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString;
    var pronouns = (_j = (_h = (_g = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-pronouns', questionnaireResponse)) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString;
    var pcpNumber = (_m = (_l = (_k = (0, utils_1.getQuestionnaireResponseByLinkId)('pcp-number', questionnaireResponse)) === null || _k === void 0 ? void 0 : _k.answer) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.valueString;
    var pcpAddress = (_q = (_p = (_o = (0, utils_1.getQuestionnaireResponseByLinkId)('pcp-address', questionnaireResponse)) === null || _o === void 0 ? void 0 : _o.answer) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.valueString;
    var pcpPractice = (_t = (_s = (_r = (0, utils_1.getQuestionnaireResponseByLinkId)('pcp-practice', questionnaireResponse)) === null || _r === void 0 ? void 0 : _r.answer) === null || _s === void 0 ? void 0 : _s[0]) === null || _t === void 0 ? void 0 : _t.valueString;
    var pcpFirstName = (_w = (_v = (_u = (0, utils_1.getQuestionnaireResponseByLinkId)('pcp-first', questionnaireResponse)) === null || _u === void 0 ? void 0 : _u.answer) === null || _v === void 0 ? void 0 : _v[0]) === null || _w === void 0 ? void 0 : _w.valueString;
    var pcpLastName = (_z = (_y = (_x = (0, utils_1.getQuestionnaireResponseByLinkId)('pcp-last', questionnaireResponse)) === null || _x === void 0 ? void 0 : _x.answer) === null || _y === void 0 ? void 0 : _y[0]) === null || _z === void 0 ? void 0 : _z.valueString;
    var pcpFirstAndLastName = pcpFirstName && pcpLastName ? "".concat(pcpLastName, ", ").concat(pcpFirstName) : undefined;
    var howDidYouHearAboutUs = (_1 = (_0 = patient === null || patient === void 0 ? void 0 : patient.extension) === null || _0 === void 0 ? void 0 : _0.find(function (e) { return e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/point-of-discovery'; })) === null || _1 === void 0 ? void 0 : _1.valueString;
    var preferredLanguage = (_4 = (_3 = (_2 = (0, utils_1.getQuestionnaireResponseByLinkId)('preferred-language', questionnaireResponse)) === null || _2 === void 0 ? void 0 : _2.answer) === null || _3 === void 0 ? void 0 : _3[0]) === null || _4 === void 0 ? void 0 : _4.valueString;
    var requireRelayService = (_7 = (_6 = (_5 = (0, utils_1.getQuestionnaireResponseByLinkId)('relay-phone', questionnaireResponse)) === null || _5 === void 0 ? void 0 : _5.answer) === null || _6 === void 0 ? void 0 : _6[0]) === null || _7 === void 0 ? void 0 : _7.valueString;
    return (<InformationCard_1.InformationCard title="Patient details" fields={[
            {
                label: "Patient's ethnicity",
                value: ethnicity,
            },
            {
                label: "Patient's race",
                value: race,
            },
            {
                label: 'Preferred pronouns',
                value: pronouns,
            },
            {
                label: 'PCP first and last name',
                value: pcpFirstAndLastName,
            },
            {
                label: 'PCP Practice name',
                value: pcpPractice,
            },
            {
                label: 'PCP address',
                value: pcpAddress,
            },
            {
                label: 'PCP phone number',
                value: pcpNumber,
            },
            {
                label: 'How did you hear about us?',
                value: howDidYouHearAboutUs,
            },
            {
                label: 'Preferred language',
                value: preferredLanguage,
            },
            {
                label: 'Do you require a Hearing Impaired Relay Service? (711)',
                value: requireRelayService,
            },
        ]}/>);
};
exports.PatientDetailsContainer = PatientDetailsContainer;
//# sourceMappingURL=PatientDetailsContainer.js.map