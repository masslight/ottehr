"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    var _a;
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _b = JSON.parse(input.body), contextRelatedReference = _b.contextRelatedReference, searchParams = _b.searchParams;
    var missingResources = [];
    if (!contextRelatedReference)
        missingResources.push('contextRelatedReference');
    if (searchParams === undefined)
        missingResources.push('searchParams');
    if (missingResources.length) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingResources);
    }
    // not supporting contained resources for the moment
    if (!((_a = contextRelatedReference.reference) === null || _a === void 0 ? void 0 : _a.match(/\w+\/[\d\w-]+/))) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("contextRelatedReference reference is an unexpected format or undefined: ".concat(JSON.stringify(contextRelatedReference.reference)));
    }
    if (!searchParams.some(function (param) { return param.name === 'type'; })) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("searchParams should include a label type in name=type ".concat(JSON.stringify(searchParams)));
    }
    return {
        contextRelatedReference: contextRelatedReference,
        searchParams: searchParams,
        secrets: input.secrets,
    };
}
