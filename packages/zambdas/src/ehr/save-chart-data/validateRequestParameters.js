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
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    if (input.headers.Authorization === undefined) {
        throw new Error('Authorization token is not provided in headers');
    }
    var data = JSON.parse(input.body);
    if (data.encounterId === undefined) {
        throw new Error('These fields are required: "encounterId"');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    return __assign(__assign({}, data), { secrets: input.secrets, userToken: userToken });
}
