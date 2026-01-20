"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), patientId = _a.patientId, search = _a.search, labOrgIdsString = _a.labOrgIdsString;
    if (!patientId && !search) {
        throw new Error('patientId or a search value must be passed as a parameter');
    }
    return {
        patientId: patientId,
        search: search,
        labOrgIdsString: labOrgIdsString,
        secrets: input.secrets,
    };
}
