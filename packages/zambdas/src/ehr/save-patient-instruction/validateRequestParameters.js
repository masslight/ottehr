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
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var data = JSON.parse(input.body);
    if (input.headers.Authorization === undefined) {
        throw utils_1.MISSING_AUTH_TOKEN;
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    return __assign(__assign({}, data), { secrets: input.secrets, userToken: userToken });
}
