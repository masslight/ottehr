"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    console.log("input: ".concat(JSON.stringify(input)));
    if (!input.body)
        throw utils_1.MISSING_REQUEST_BODY;
    if (input.secrets == null)
        throw utils_1.MISSING_REQUEST_SECRETS;
    var parsedJSON = JSON.parse(input.body);
    var patientId = utils_1.GetPatientAndResponsiblePartyInfoEndpointInputSchema.parse(parsedJSON).patientId;
    return {
        patientId: patientId,
        secrets: input.secrets,
    };
}
