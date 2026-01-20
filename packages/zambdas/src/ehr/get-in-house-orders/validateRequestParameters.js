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
    var _a;
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var params;
    try {
        params = JSON.parse(input.body);
    }
    catch (_b) {
        throw new Error('Invalid JSON in request body');
    }
    var searchBy = params.searchBy, visitDate = params.visitDate, _c = params.itemsPerPage, itemsPerPage = _c === void 0 ? utils_1.DEFAULT_IN_HOUSE_LABS_ITEMS_PER_PAGE : _c, _d = params.pageIndex, pageIndex = _d === void 0 ? 0 : _d;
    if (!(searchBy === null || searchBy === void 0 ? void 0 : searchBy.field) || !(searchBy === null || searchBy === void 0 ? void 0 : searchBy.value)) {
        throw new Error("Missing searchBy field or value: ".concat(JSON.stringify(searchBy)));
    }
    if (searchBy.field === 'encounterIds' && !Array.isArray(searchBy.value)) {
        throw new Error('Invalid encounterIds. Must be an array');
    }
    if (searchBy.field === 'encounterId' && typeof searchBy.value !== 'string') {
        throw new Error('Invalid encounterId. Must be a string');
    }
    if (searchBy.field === 'patientId' && typeof searchBy.value !== 'string') {
        throw new Error('Invalid patientId. Must be a string');
    }
    if (searchBy.field === 'serviceRequestId' && typeof searchBy.value !== 'string') {
        throw new Error('Invalid serviceRequestId. Must be a string');
    }
    if (visitDate && typeof visitDate !== 'string') {
        throw new Error('Invalid visitDate. Must be a string');
    }
    var validFields = ['encounterId', 'patientId', 'serviceRequestId', 'encounterIds'];
    if (!validFields.includes(searchBy.field)) {
        throw new Error("Invalid searchBy field. Must be one of: ".concat(validFields.join(', ')));
    }
    if (typeof itemsPerPage !== 'number' || isNaN(itemsPerPage) || itemsPerPage < 1) {
        throw new Error('Invalid parameter: itemsPerPage must be a number greater than 0');
    }
    if (typeof pageIndex !== 'number' || isNaN(pageIndex) || pageIndex < 0) {
        throw new Error('Invalid parameter: pageIndex must be a number greater than or equal to 0');
    }
    if (!((_a = input.headers) === null || _a === void 0 ? void 0 : _a.Authorization)) {
        throw new Error('Authorization header is required');
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    if (!userToken) {
        throw new Error('Invalid Authorization header format');
    }
    return __assign(__assign({}, params), { secrets: input.secrets, userToken: userToken });
}
