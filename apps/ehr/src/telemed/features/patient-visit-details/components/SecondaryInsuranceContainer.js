"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecondaryInsuranceContainer = void 0;
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var InformationCard_1 = require("./InformationCard");
var SecondaryInsuranceContainer = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8;
    var questionnaireResponse = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['questionnaireResponse']).questionnaireResponse;
    var insuranceCarrier = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('insurance-carrier-2', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString;
    var memberId = (_f = (_e = (_d = (0, utils_1.getQuestionnaireResponseByLinkId)('insurance-member-id-2', questionnaireResponse)) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString;
    var policyHolderFirstName = (_j = (_h = (_g = (0, utils_1.getQuestionnaireResponseByLinkId)('policy-holder-last-name-2', questionnaireResponse)) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString;
    var policyHolderLastName = (_m = (_l = (_k = (0, utils_1.getQuestionnaireResponseByLinkId)('policy-holder-first-name-2', questionnaireResponse)) === null || _k === void 0 ? void 0 : _k.answer) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.valueString;
    var policyHolderFirstAndLastName = policyHolderFirstName && policyHolderLastName ? "".concat(policyHolderFirstName, ", ").concat(policyHolderLastName) : undefined;
    var policyHolderDateOfBirth = (_q = (_p = (_o = (0, utils_1.getQuestionnaireResponseByLinkId)('policy-holder-date-of-birth-2', questionnaireResponse)) === null || _o === void 0 ? void 0 : _o.answer) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.valueDate;
    var policyHolderBirthSex = (_t = (_s = (_r = (0, utils_1.getQuestionnaireResponseByLinkId)('policy-holder-birth-sex-2', questionnaireResponse)) === null || _r === void 0 ? void 0 : _r.answer) === null || _s === void 0 ? void 0 : _s[0]) === null || _t === void 0 ? void 0 : _t.valueString;
    var policyHolderAddress = (_w = (_v = (_u = (0, utils_1.getQuestionnaireResponseByLinkId)('policy-holder-address-2', questionnaireResponse)) === null || _u === void 0 ? void 0 : _u.answer) === null || _v === void 0 ? void 0 : _v[0]) === null || _w === void 0 ? void 0 : _w.valueString;
    var policyHolderCity = (_z = (_y = (_x = (0, utils_1.getQuestionnaireResponseByLinkId)('policy-holder-city-2', questionnaireResponse)) === null || _x === void 0 ? void 0 : _x.answer) === null || _y === void 0 ? void 0 : _y[0]) === null || _z === void 0 ? void 0 : _z.valueString;
    var policyHolderState = (_2 = (_1 = (_0 = (0, utils_1.getQuestionnaireResponseByLinkId)('policy-holder-state-2', questionnaireResponse)) === null || _0 === void 0 ? void 0 : _0.answer) === null || _1 === void 0 ? void 0 : _1[0]) === null || _2 === void 0 ? void 0 : _2.valueString;
    var policyHolderZip = (_5 = (_4 = (_3 = (0, utils_1.getQuestionnaireResponseByLinkId)('policy-holder-zip-2', questionnaireResponse)) === null || _3 === void 0 ? void 0 : _3.answer) === null || _4 === void 0 ? void 0 : _4[0]) === null || _5 === void 0 ? void 0 : _5.valueString;
    var policyHolderCityStateZip = policyHolderCity && policyHolderState && policyHolderZip
        ? "".concat(policyHolderCity, ", ").concat(policyHolderState, ", ").concat(policyHolderZip)
        : undefined;
    var patientRelationshipToInsured = (_8 = (_7 = (_6 = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-relationship-to-insured-2', questionnaireResponse)) === null || _6 === void 0 ? void 0 : _6.answer) === null || _7 === void 0 ? void 0 : _7[0]) === null || _8 === void 0 ? void 0 : _8.valueString;
    return (<InformationCard_1.InformationCard title="Secondary insurance information" fields={[
            {
                label: 'Insurance Carrier',
                value: insuranceCarrier,
            },
            {
                label: 'Member ID',
                value: memberId,
            },
            {
                label: "Policy holder's name",
                value: policyHolderFirstAndLastName,
            },
            {
                label: "Policy holder's date of birth",
                value: policyHolderDateOfBirth && (0, utils_1.mdyStringFromISOString)(policyHolderDateOfBirth),
            },
            {
                label: "Policy holder's sex",
                value: policyHolderBirthSex,
            },
            {
                label: 'Street address',
                value: policyHolderAddress,
            },
            {
                label: 'City, State, ZIP',
                value: policyHolderCityStateZip,
            },
            {
                label: "Patient's relationship to insured",
                value: patientRelationshipToInsured,
            },
        ]}/>);
};
exports.SecondaryInsuranceContainer = SecondaryInsuranceContainer;
//# sourceMappingURL=SecondaryInsuranceContainer.js.map