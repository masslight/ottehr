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
exports.createPatient = createPatient;
function createPatient(_a) {
    var firstName = _a.firstName, lastName = _a.lastName, gender = _a.gender, birthDate = _a.birthDate, city = _a.city, line = _a.line, state = _a.state, postalCode = _a.postalCode, telecom = _a.telecom, _b = _a.relationship, relationship = _b === void 0 ? 'Parent/Guardian' : _b;
    var name = {
        given: [firstName],
        family: lastName,
    };
    var address = city || line || state || postalCode
        ? __assign(__assign(__assign(__assign({}, (city && { city: city })), (line && { line: [line] })), (state && { state: state })), (postalCode && { postalCode: postalCode })) : undefined;
    var relationshipCoding = {
        code: relationship,
        system: 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship',
        display: relationship,
    };
    var relationshipConcept = {
        coding: [relationshipCoding],
    };
    return {
        resourceType: 'Patient',
        name: [name],
        active: true,
        gender: gender,
        contact: [
            __assign(__assign({}, (address && { address: address })), { telecom: telecom, relationship: [relationshipConcept] }),
        ],
        address: address ? [address] : undefined,
        telecom: telecom,
        birthDate: birthDate,
        extension: [
            {
                url: 'https://fhir.zapehr.com/r4/StructureDefinitions/form-user',
                valueString: relationship,
            },
        ],
    };
}
//# sourceMappingURL=patient.js.map