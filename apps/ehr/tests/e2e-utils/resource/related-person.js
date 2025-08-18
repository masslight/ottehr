"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRelatedPerson = createRelatedPerson;
function createRelatedPerson(_a) {
    var patientId = _a.patientId, _b = _a.phoneNumber, phoneNumber = _b === void 0 ? '+12144985545' : _b, _c = _a.relationshipCode, relationshipCode = _c === void 0 ? 'user-relatedperson' : _c, _d = _a.relationshipSystem, relationshipSystem = _d === void 0 ? 'https://fhir.zapehr.com/r4/StructureDefinitions/relationship' : _d;
    return {
        resourceType: 'RelatedPerson',
        patient: {
            reference: "Patient/".concat(patientId),
        },
        telecom: [
            {
                system: 'phone',
                value: phoneNumber,
            },
            {
                system: 'sms',
                value: phoneNumber,
            },
        ],
        relationship: [
            {
                coding: [
                    {
                        system: relationshipSystem,
                        code: relationshipCode,
                    },
                ],
            },
        ],
    };
}
//# sourceMappingURL=related-person.js.map