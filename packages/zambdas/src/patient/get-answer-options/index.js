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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
var ZAMBDA_NAME = 'get-answer-options';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var secrets, getOptionsInput, oystehr, answerOptions, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                secrets = input.secrets;
                getOptionsInput = validateInput(input);
                console.log('get options input:', getOptionsInput);
                console.group('getAuth0Token');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _a.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _a.label = 3;
            case 3:
                console.groupEnd();
                console.debug('getAuth0Token success');
                console.group('createOystehrClient');
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets), (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets));
                console.groupEnd();
                console.debug('createOystehrClient success');
                return [4 /*yield*/, performEffect(getOptionsInput, oystehr)];
            case 4:
                answerOptions = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(answerOptions),
                    }];
            case 5:
                error_1 = _a.sent();
                console.log(error_1, error_1.issue);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 6: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var type, _a, resourceType_1, query, prependedIdentifier_1, paramsObject, offset_1, params, _i, paramsObject_1, _b, key, value, results, resources, error_2, mappedResults;
    var _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                type = input.type;
                if (!(type === 'query')) return [3 /*break*/, 5];
                _a = input.answerSource, resourceType_1 = _a.resourceType, query = _a.query, prependedIdentifier_1 = _a.prependedIdentifier;
                paramsObject = new URLSearchParams(query);
                offset_1 = 0;
                params = [
                    {
                        name: '_count',
                        value: '1000',
                    },
                    {
                        name: '_offset',
                        value: offset_1,
                    },
                ];
                for (_i = 0, paramsObject_1 = paramsObject; _i < paramsObject_1.length; _i++) {
                    _b = paramsObject_1[_i], key = _b[0], value = _b[1];
                    params.push({ name: key, value: value });
                }
                console.group('searchResources');
                results = [];
                console.group(params);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: resourceType_1,
                        params: params,
                    })];
            case 1:
                resources = _d.sent();
                results = results.concat(resources.unbundle());
                _d.label = 2;
            case 2:
                if (!((_c = resources.link) === null || _c === void 0 ? void 0 : _c.find(function (link) { return link.relation === 'next'; }))) return [3 /*break*/, 4];
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: resourceType_1,
                        params: params.map(function (param) {
                            if (param.name === '_offset') {
                                return __assign(__assign({}, param), { value: (offset_1 += 1000) });
                            }
                            return param;
                        }),
                    })];
            case 3:
                resources = _d.sent();
                results = results.concat(resources.unbundle());
                return [3 /*break*/, 2];
            case 4:
                console.groupEnd();
                mappedResults = results
                    .map(function (result) {
                    try {
                        return formatQueryResult(result, resourceType_1, prependedIdentifier_1);
                    }
                    catch (e) {
                        if ((0, utils_1.isApiError)(e)) {
                            error_2 = e;
                        }
                        return undefined;
                    }
                })
                    .filter(function (res) { return !!res; });
                if (mappedResults.length === 0 && error_2) {
                    throw error_2;
                }
                return [2 /*return*/, mappedResults.sort(function (r1, r2) {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                        var r1Val = (_e = (_c = (_b = (_a = r1.valueReference) === null || _a === void 0 ? void 0 : _a.display) === null || _b === void 0 ? void 0 : _b.split(' - ')[1]) !== null && _c !== void 0 ? _c : (_d = r1.valueReference) === null || _d === void 0 ? void 0 : _d.display) !== null && _e !== void 0 ? _e : '';
                        var r2Val = (_k = (_h = (_g = (_f = r2.valueReference) === null || _f === void 0 ? void 0 : _f.display) === null || _g === void 0 ? void 0 : _g.split(' - ')[1]) !== null && _h !== void 0 ? _h : (_j = r2.valueReference) === null || _j === void 0 ? void 0 : _j.display) !== null && _k !== void 0 ? _k : '';
                        return r1Val.localeCompare(r2Val);
                    })];
            case 5: 
            // todo: value sets
            return [2 /*return*/, []];
        }
    });
}); };
var formatQueryResult = function (result, resourceType, prependedIdentifier) {
    var _a, _b, _c;
    var name = resourceType === 'Organization' ? ((_a = result.alias) === null || _a === void 0 ? void 0 : _a[0]) || result.name : result.name;
    if (prependedIdentifier) {
        var identifierValue = (_c = (_b = result.identifier) === null || _b === void 0 ? void 0 : _b.find(function (id) {
            var _a, _b;
            return (id.system === prependedIdentifier ||
                ((_b = (_a = id.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.some(function (coding) { return coding.system === prependedIdentifier; })));
        })) === null || _c === void 0 ? void 0 : _c.value;
        if (identifierValue) {
            name = "".concat(identifierValue, " - ").concat(name);
        }
    }
    if (name && result.id && typeof name === 'string' && typeof result.id === 'string') {
        return {
            valueReference: {
                reference: "".concat(resourceType, "/").concat(result.id),
                display: name,
                type: resourceType === 'Organization' && result.name === 'Other' ? 'other' : undefined,
            },
        };
    }
    throw (0, utils_1.ANSWER_OPTION_FROM_RESOURCE_UNDEFINED)(resourceType);
};
var validateInput = function (input) {
    var body = input.body;
    if (!body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var _a = JSON.parse(body), answerSource = _a.answerSource, valueSet = _a.valueSet;
    if (answerSource) {
        var resourceType = answerSource.resourceType, query = answerSource.query;
        if (!resourceType) {
            throw (0, utils_1.MALFORMED_GET_ANSWER_OPTIONS_INPUT)('"answerSource" must contain a "resourceType" property');
        }
        if (!query) {
            throw (0, utils_1.MALFORMED_GET_ANSWER_OPTIONS_INPUT)('"answerSource" must contain a "query" property');
        }
        if (answerSource.prependedIdentifier && typeof answerSource.prependedIdentifier !== 'string') {
            throw (0, utils_1.MALFORMED_GET_ANSWER_OPTIONS_INPUT)('"answerSource.prependedIdentifier" property must be a string if provided');
        }
        return { type: 'query', answerSource: answerSource };
    }
    else if (valueSet) {
        var _b = valueSet.split('|'), url = _b[0], version = _b[1];
        if (!url || !version) {
            throw (0, utils_1.MALFORMED_GET_ANSWER_OPTIONS_INPUT)('"valueSet" property must be a well-formed canonical URL');
        }
        return { type: 'canonical', url: url, version: version };
    }
    else {
        throw (0, utils_1.MALFORMED_GET_ANSWER_OPTIONS_INPUT)('Request body must contain an "answerSource" or "valueSet" property');
    }
};
