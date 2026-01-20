"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConsentFormsSection = exports.composeConsentFormsData = void 0;
var utils_1 = require("utils");
var composeConsentFormsData = function (_a) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    var encounter = _a.encounter, consents = _a.consents, questionnaireResponse = _a.questionnaireResponse, timezone = _a.timezone;
    if (!questionnaireResponse) {
        return {
            isSigned: false,
            signature: '',
            fullName: '',
            relationship: '',
            date: '',
            ip: '',
            consentIsAttested: false,
        };
    }
    var firstConsent = consents && consents.length > 0 ? consents[0] : undefined;
    var date = (0, utils_1.formatDateForDisplay)(firstConsent === null || firstConsent === void 0 ? void 0 : firstConsent.dateTime, timezone);
    var flattenedPaperwork = (0, utils_1.flattenQuestionnaireAnswers)(questionnaireResponse.item || []);
    var signature = (_e = (_d = (_c = (_b = flattenedPaperwork.find(function (item) { return item.linkId === 'signature'; })) === null || _b === void 0 ? void 0 : _b.answer) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.valueString) !== null && _e !== void 0 ? _e : '';
    var isSigned = !!signature;
    var fullName = (_j = (_h = (_g = (_f = flattenedPaperwork.find(function (question) { return question.linkId === 'full-name'; })) === null || _f === void 0 ? void 0 : _f.answer) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.valueString) !== null && _j !== void 0 ? _j : '';
    var relationship = (_o = (_m = (_l = (_k = flattenedPaperwork.find(function (question) { return question.linkId === 'consent-form-signer-relationship'; })) === null || _k === void 0 ? void 0 : _k.answer) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.valueString) !== null && _o !== void 0 ? _o : '';
    var ip = (_r = (_q = (_p = questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.extension) === null || _p === void 0 ? void 0 : _p.find(function (e) { return e.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address'; })) === null || _q === void 0 ? void 0 : _q.valueString) !== null && _r !== void 0 ? _r : '';
    var consentIsAttested = (0, utils_1.getAttestedConsentFromEncounter)(encounter) ? true : false;
    return {
        isSigned: isSigned,
        signature: signature,
        fullName: fullName,
        relationship: relationship,
        date: date,
        ip: ip,
        consentIsAttested: consentIsAttested,
    };
};
exports.composeConsentFormsData = composeConsentFormsData;
var createConsentFormsSection = function () { return ({
    title: 'Completed consent forms',
    dataSelector: function (data) { return data.consentForms; },
    render: function (client, data, styles) {
        client.drawLabelValueRow('Consent Forms signed?', data.isSigned ? 'Signed' : 'Not signed', styles.textStyles.regular, styles.textStyles.regular, {
            drawDivider: true,
            dividerMargin: 8,
        });
        if (data.isSigned) {
            client.drawLabelValueRow('Signature', data.signature, styles.textStyles.regular, styles.textStyles.regular, {
                drawDivider: true,
                dividerMargin: 8,
            });
            client.drawLabelValueRow('Full name', data.fullName, styles.textStyles.regular, styles.textStyles.regular, {
                drawDivider: true,
                dividerMargin: 8,
            });
            client.drawLabelValueRow("Relationship to the patient", data.relationship, styles.textStyles.regular, styles.textStyles.regular, {
                drawDivider: true,
                dividerMargin: 8,
            });
            client.drawLabelValueRow("Date", data.date, styles.textStyles.regular, styles.textStyles.regular, {
                drawDivider: true,
                dividerMargin: 8,
            });
            client.drawLabelValueRow("IP", data.ip, styles.textStyles.regular, styles.textStyles.regular, {
                drawDivider: true,
                dividerMargin: 8,
            });
        }
        client.drawLabelValueRow('I verify that patient consent has been obtained', data.consentIsAttested ? 'Yes' : 'No', styles.textStyles.regular, styles.textStyles.regular, {
            spacing: 16,
        });
    },
}); };
exports.createConsentFormsSection = createConsentFormsSection;
