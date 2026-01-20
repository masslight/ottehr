"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    // no complication
    var _a = JSON.parse(input.body), procedureType = _a.procedureType, diagnoses = _a.diagnoses, medicationUsed = _a.medicationUsed, bodySite = _a.bodySite, bodySide = _a.bodySide, technique = _a.technique, suppliesUsed = _a.suppliesUsed, procedureDetails = _a.procedureDetails, timeSpent = _a.timeSpent;
    return {
        procedureType: procedureType,
        diagnoses: diagnoses,
        medicationUsed: medicationUsed,
        bodySite: bodySite,
        bodySide: bodySide,
        technique: technique,
        suppliesUsed: suppliesUsed,
        procedureDetails: procedureDetails,
        timeSpent: timeSpent,
        secrets: input.secrets,
    };
}
