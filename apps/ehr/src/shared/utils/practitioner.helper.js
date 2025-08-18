"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPractitionerMissingFields = void 0;
var utils_1 = require("utils");
var getPractitionerMissingFields = function (practitioner) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var missingFields = [];
    if (!practitioner)
        return [];
    if (!(practitioner === null || practitioner === void 0 ? void 0 : practitioner.birthDate)) {
        missingFields.push('birth date');
    }
    if (!((_b = (_a = practitioner === null || practitioner === void 0 ? void 0 : practitioner.telecom) === null || _a === void 0 ? void 0 : _a.find(function (telecom) { return telecom.system === 'phone'; })) === null || _b === void 0 ? void 0 : _b.value)) {
        missingFields.push('phone');
    }
    if (!((_d = (_c = practitioner === null || practitioner === void 0 ? void 0 : practitioner.telecom) === null || _c === void 0 ? void 0 : _c.find(function (telecom) { return telecom.system === 'fax'; })) === null || _d === void 0 ? void 0 : _d.value)) {
        missingFields.push('fax');
    }
    if (!((_e = practitioner === null || practitioner === void 0 ? void 0 : practitioner.address) === null || _e === void 0 ? void 0 : _e.find(function (address) { var _a; return (_a = address.line) === null || _a === void 0 ? void 0 : _a.length; }))) {
        missingFields.push('Address line 1');
    }
    if (!((_f = practitioner === null || practitioner === void 0 ? void 0 : practitioner.address) === null || _f === void 0 ? void 0 : _f.find(function (address) { return address.city; }))) {
        missingFields.push('City');
    }
    if (!((_g = practitioner === null || practitioner === void 0 ? void 0 : practitioner.address) === null || _g === void 0 ? void 0 : _g.find(function (address) { return address.state; }))) {
        missingFields.push('State');
    }
    if (!((_h = practitioner === null || practitioner === void 0 ? void 0 : practitioner.address) === null || _h === void 0 ? void 0 : _h.find(function (address) { return address.postalCode; }))) {
        missingFields.push('Zip code');
    }
    if (!(0, utils_1.getPractitionerNPIIdentifier)(practitioner)) {
        missingFields.push('NPI');
    }
    return missingFields;
};
exports.getPractitionerMissingFields = getPractitionerMissingFields;
//# sourceMappingURL=practitioner.helper.js.map