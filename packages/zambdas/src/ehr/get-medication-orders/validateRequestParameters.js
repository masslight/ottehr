"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var parsedJSON = JSON.parse(input.body);
    var searchBy = utils_1.GetMedicationOrdersInputSchema.parse(parsedJSON).searchBy;
    console.log('parsed searchBy', JSON.stringify(searchBy));
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return {
        searchBy: searchBy,
        secrets: input.secrets,
    };
}
