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
    var _a;
    console.group('validateRequestParameters');
    if (!input.body) {
        throw new Error('No request body provided');
    }
    if (!((_a = input.headers) === null || _a === void 0 ? void 0 : _a.Authorization)) {
        throw new Error('Authorization header is required');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    var parsedJSON = JSON.parse(input.body);
    var validatedParams = (0, shared_1.safeValidate)(utils_1.CreateDischargeSummaryInputSchema, parsedJSON);
    console.groupEnd();
    console.debug('validateRequestParameters success');
    return __assign(__assign({}, validatedParams), { secrets: input.secrets, userToken: userToken });
}
