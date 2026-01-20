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
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
function validateRequestParameters(input) {
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var parsed = JSON.parse(input.body);
    var validatedParameters = (0, shared_1.safeValidate)(utils_1.GetOrUploadPatientProfilePhotoInputSchema, parsed);
    console.groupEnd();
    console.log('validateRequestParameters success');
    return __assign(__assign({}, validatedParameters), { secrets: input.secrets });
}
