"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactContainer = void 0;
var utils_1 = require("utils");
var CopyButton_1 = require("../../../../components/CopyButton");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var InformationCard_1 = require("./InformationCard");
var ContactContainer = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3;
    var questionnaireResponse = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['questionnaireResponse']).questionnaireResponse;
    var streetAddress = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-street-address', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0].valueString;
    var streetAddressLine2 = (_e = (_d = (_c = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-street-address-2', questionnaireResponse)) === null || _c === void 0 ? void 0 : _c.answer) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.valueString;
    var cityStateZipString = "\n    ".concat((_g = (_f = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-city', questionnaireResponse)) === null || _f === void 0 ? void 0 : _f.answer) === null || _g === void 0 ? void 0 : _g[0].valueString, ", ").concat((_j = (_h = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-state', questionnaireResponse)) === null || _h === void 0 ? void 0 : _h.answer) === null || _j === void 0 ? void 0 : _j[0].valueString, ", ").concat((_m = (_l = (_k = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-zip', questionnaireResponse)) === null || _k === void 0 ? void 0 : _k.answer) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.valueString, "\n  ");
    var fillingOutAs = (_p = (_o = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-filling-out-as', questionnaireResponse)) === null || _o === void 0 ? void 0 : _o.answer) === null || _p === void 0 ? void 0 : _p[0].valueString;
    var patientEmail = (_s = (_r = (_q = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-email', questionnaireResponse)) === null || _q === void 0 ? void 0 : _q.answer) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.valueString;
    var patientMobile = (_v = (_u = (_t = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-number', questionnaireResponse)) === null || _t === void 0 ? void 0 : _t.answer) === null || _u === void 0 ? void 0 : _u[0]) === null || _v === void 0 ? void 0 : _v.valueString;
    var guardianEmail = (_x = (_w = (0, utils_1.getQuestionnaireResponseByLinkId)('guardian-email', questionnaireResponse)) === null || _w === void 0 ? void 0 : _w.answer) === null || _x === void 0 ? void 0 : _x[0].valueString;
    var guardianMobile = (_0 = (_z = (_y = (0, utils_1.getQuestionnaireResponseByLinkId)('guardian-number', questionnaireResponse)) === null || _y === void 0 ? void 0 : _y.answer) === null || _z === void 0 ? void 0 : _z[0]) === null || _0 === void 0 ? void 0 : _0.valueString;
    var sendMarketingMessages = ((_3 = (_2 = (_1 = (0, utils_1.getQuestionnaireResponseByLinkId)('mobile-opt-in', questionnaireResponse)) === null || _1 === void 0 ? void 0 : _1.answer) === null || _2 === void 0 ? void 0 : _2[0]) === null || _3 === void 0 ? void 0 : _3.valueString) || 'No';
    return (<InformationCard_1.InformationCard title="Contact information" fields={[
            {
                label: 'Street address',
                value: streetAddress,
                button: <CopyButton_1.default text={streetAddress || ''}/>,
            },
            {
                label: 'Address line 2',
                value: streetAddressLine2,
                button: <CopyButton_1.default text={streetAddressLine2 || ''}/>,
            },
            {
                label: 'City, State, ZIP',
                value: cityStateZipString,
            },
            {
                label: 'I am filling out this info as',
                value: fillingOutAs,
            },
            {
                label: 'Patient email',
                value: patientEmail,
                button: <CopyButton_1.default text={patientEmail || ''}/>,
            },
            {
                label: 'Patient mobile',
                value: patientMobile,
                button: <CopyButton_1.default text={patientMobile || ''}/>,
            },
            {
                label: 'Parent/Guardian email',
                value: guardianEmail,
                button: <CopyButton_1.default text={guardianEmail || ''}/>,
            },
            {
                label: 'Parent/Guardian mobile',
                value: guardianMobile,
                button: <CopyButton_1.default text={guardianMobile || ''}/>,
            },
            {
                label: 'Send marketing messages',
                value: sendMarketingMessages,
            },
        ]}/>);
};
exports.ContactContainer = ContactContainer;
//# sourceMappingURL=ContactContainer.js.map