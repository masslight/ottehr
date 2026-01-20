"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var user_activation_types_1 = require("utils/lib/types/api/user-activation.types");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    if (input.secrets == null) {
        throw new Error('No secrets provided');
    }
    var parsedJSON = JSON.parse(input.body);
    var _a = user_activation_types_1.UserActivationZambdaInputSchema.parse(parsedJSON), mode = _a.mode, userId = _a.userId;
    console.log('parsed userId: ', JSON.stringify(userId));
    console.log('parsed mode: ', JSON.stringify(mode));
    return {
        userId: userId,
        mode: mode,
        secrets: input.secrets,
    };
}
