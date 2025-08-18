"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponsibleInformationContainer = void 0;
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var InformationCard_1 = require("./InformationCard");
var ResponsibleInformationContainer = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    var questionnaireResponse = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['questionnaireResponse']).questionnaireResponse;
    var relationship = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('responsible-party-relationship', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString;
    var firstAndLastName = "\n    ".concat((_f = (_e = (_d = (0, utils_1.getQuestionnaireResponseByLinkId)('responsible-party-first-name', questionnaireResponse)) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString, ", ").concat((_j = (_h = (_g = (0, utils_1.getQuestionnaireResponseByLinkId)('responsible-party-last-name', questionnaireResponse)) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString);
    var dateOfBirth = (_m = (_l = (_k = (0, utils_1.getQuestionnaireResponseByLinkId)('responsible-party-date-of-birth', questionnaireResponse)) === null || _k === void 0 ? void 0 : _k.answer) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.valueDate;
    var birthSex = (_q = (_p = (_o = (0, utils_1.getQuestionnaireResponseByLinkId)('responsible-party-birth-sex', questionnaireResponse)) === null || _o === void 0 ? void 0 : _o.answer) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.valueString;
    var phone = (_t = (_s = (_r = (0, utils_1.getQuestionnaireResponseByLinkId)('responsible-party-number', questionnaireResponse)) === null || _r === void 0 ? void 0 : _r.answer) === null || _s === void 0 ? void 0 : _s[0]) === null || _t === void 0 ? void 0 : _t.valueString;
    return (<InformationCard_1.InformationCard title="Responsible party information" fields={[
            {
                label: 'Relationship',
                value: relationship,
            },
            {
                label: 'Full name',
                value: firstAndLastName,
            },
            {
                label: 'Date of birth',
                value: dateOfBirth && (0, utils_1.mdyStringFromISOString)(dateOfBirth),
            },
            {
                label: 'Birth sex',
                value: birthSex,
            },
            {
                label: 'Phone',
                value: phone,
            },
        ]}/>);
};
exports.ResponsibleInformationContainer = ResponsibleInformationContainer;
//# sourceMappingURL=ResponsibleInformationContainer.js.map