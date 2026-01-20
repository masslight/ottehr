"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvenanceForEncounter = createProvenanceForEncounter;
function createProvenanceForEncounter(encounterId, practitionerId, role, recorded) {
    if (recorded === void 0) { recorded = new Date().toISOString(); }
    var roleCoding = {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
        code: role,
        display: role === 'author' ? 'Author' : 'Verifier',
    };
    var roleConcept = {
        coding: [roleCoding],
    };
    return {
        resourceType: 'Provenance',
        target: [
            {
                reference: "Encounter/".concat(encounterId),
            },
        ],
        recorded: recorded,
        agent: [
            {
                role: [roleConcept],
                who: {
                    reference: "Practitioner/".concat(practitionerId),
                },
            },
        ],
    };
}
