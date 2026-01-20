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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.performEffectWithEnvFile = exports.createOystehrClientFromConfig = exports.getAll = exports.getTimezoneFromLocation = exports.batchSearch = exports.projectApiUrlFromAuth0Audience = exports.fhirApiUrlFromAuth0Audience = void 0;
exports.makeGroup = makeGroup;
exports.makeList = makeList;
exports.sleep = sleep;
exports.getInHouseInventoryMedications = getInHouseInventoryMedications;
exports.filterInHouseMedications = filterInHouseMedications;
var path_1 = require("path");
var utils_1 = require("utils");
var shared_1 = require("../shared");
var fhirApiUrlFromAuth0Audience = function (auth0Audience) {
    switch (auth0Audience) {
        case 'https://dev.api.zapehr.com':
            return 'https://dev.fhir-api.zapehr.com';
        case 'https://dev2.api.zapehr.com':
            return 'https://dev2.fhir-api.zapehr.com';
        case 'https://testing.api.zapehr.com':
            return 'https://testing.fhir-api.zapehr.com';
        case 'https://staging.api.zapehr.com':
            return 'https://staging.fhir-api.zapehr.com';
        case 'https://api.zapehr.com':
            return 'https://fhir-api.zapehr.com';
        default:
            throw "Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ".concat(auth0Audience);
    }
};
exports.fhirApiUrlFromAuth0Audience = fhirApiUrlFromAuth0Audience;
// todo remove code duplication with configure-secrets
var projectApiUrlFromAuth0Audience = function (auth0Audience) {
    switch (auth0Audience) {
        case 'https://dev.api.zapehr.com':
            return 'https://dev.project-api.zapehr.com/v1';
        case 'https://dev2.api.zapehr.com':
            return 'https://dev2.project-api.zapehr.com/v1';
        case 'https://testing.api.zapehr.com':
            return 'https://testing.project-api.zapehr.com/v1';
        case 'https://staging.api.zapehr.com':
            return 'https://staging.project-api.zapehr.com/v1';
        case 'https://api.zapehr.com':
            return 'https://project-api.zapehr.com/v1';
        default:
            throw "Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ".concat(auth0Audience);
    }
};
exports.projectApiUrlFromAuth0Audience = projectApiUrlFromAuth0Audience;
function makeGroup(thingsToGroup) {
    var member = thingsToGroup.map(function (ttg) {
        return {
            entity: { reference: "".concat(ttg.resourceType, "/").concat(ttg.id) },
        };
    });
    return {
        resourceType: 'Group',
        type: 'person',
        actual: true,
        member: member,
    };
}
function makeList(thingsToGroup) {
    var entry = thingsToGroup.map(function (ttg) {
        console.log('ttg', ttg);
        return {
            item: { reference: "".concat(ttg.resourceType, "/").concat(ttg.id) },
        };
    });
    return {
        resourceType: 'List',
        mode: 'snapshot',
        status: 'current',
        entry: entry,
    };
}
var batchSearch = function (batchRequests, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var batchResults, e_1, entries, idSet;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                return [4 /*yield*/, oystehr.fhir.batch({
                        requests: batchRequests,
                    })];
            case 1:
                batchResults = _b.sent();
                return [3 /*break*/, 3];
            case 2:
                e_1 = _b.sent();
                console.log('error', e_1);
                throw e_1;
            case 3:
                console.log('batchResults', batchResults === null || batchResults === void 0 ? void 0 : batchResults.entry);
                entries = ((_a = batchResults.entry) !== null && _a !== void 0 ? _a : []).flatMap(function (be) {
                    var _a, _b, _c;
                    if (((_b = (_a = be.response) === null || _a === void 0 ? void 0 : _a.outcome) === null || _b === void 0 ? void 0 : _b.id) === 'ok' &&
                        be.resource &&
                        be.resource.resourceType === 'Bundle' &&
                        be.resource.type === 'searchset') {
                        var innerBundle = be.resource;
                        var innerEntry = innerBundle.entry;
                        if (!innerEntry) {
                            return [];
                        }
                        else {
                            return ((_c = innerBundle.entry) !== null && _c !== void 0 ? _c : []).map(function (ibe) { return ibe.resource; });
                        }
                    }
                    else {
                        return [];
                    }
                });
                idSet = new Set();
                return [2 /*return*/, entries.filter(function (entry) {
                        var id = entry.id;
                        if (!id) {
                            return false;
                        }
                        if (idSet.has(id)) {
                            return false;
                        }
                        else {
                            idSet.add(id);
                            return true;
                        }
                    })];
        }
    });
}); };
exports.batchSearch = batchSearch;
function timeout(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
function sleep(period) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Sleeping for ".concat(period / 1000, " seconds"));
                    return [4 /*yield*/, timeout(period)];
                case 1:
                    _a.sent();
                    console.log("resuming program");
                    return [2 /*return*/];
            }
        });
    });
}
var getTimezoneFromLocation = function (location) {
    var _a, _b;
    return (_b = ((_a = location.extension) !== null && _a !== void 0 ? _a : []).find(function (ext) {
        return ext.url === 'http://hl7.org/fhir/StructureDefinition/timezone';
    })) === null || _b === void 0 ? void 0 : _b.valueString;
};
exports.getTimezoneFromLocation = getTimezoneFromLocation;
var getBatchParams = function (batchNo, params) {
    return __spreadArray(__spreadArray([], params, true), [
        {
            name: '_count',
            value: '1000',
        },
        {
            name: '_offset',
            value: "".concat(1000 * batchNo),
        },
    ], false);
};
var getAll = function (resourceType, params, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var bundle, numChunks, paramArray, lists, _a, paramArray_1, paramArray_1_1, params_1, res, e_2_1;
    var _b, e_2, _c, _d;
    var _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: resourceType,
                    params: __spreadArray(__spreadArray([], params, true), [
                        {
                            name: '_count',
                            value: '1',
                        },
                    ], false),
                })];
            case 1:
                bundle = _f.sent();
                numChunks = Math.ceil(((_e = bundle.total) !== null && _e !== void 0 ? _e : 1000) / 1000);
                console.log('num chunks', numChunks);
                paramArray = new Array(numChunks).fill(1).map(function (_, idx) {
                    return getBatchParams(idx, params);
                });
                lists = [];
                _f.label = 2;
            case 2:
                _f.trys.push([2, 9, 10, 15]);
                _a = true, paramArray_1 = __asyncValues(paramArray);
                _f.label = 3;
            case 3: return [4 /*yield*/, paramArray_1.next()];
            case 4:
                if (!(paramArray_1_1 = _f.sent(), _b = paramArray_1_1.done, !_b)) return [3 /*break*/, 8];
                _d = paramArray_1_1.value;
                _a = false;
                params_1 = _d;
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: resourceType,
                        params: params_1,
                    })];
            case 5:
                res = _f.sent();
                lists.push(res);
                return [4 /*yield*/, sleep(1500)];
            case 6:
                _f.sent();
                _f.label = 7;
            case 7:
                _a = true;
                return [3 /*break*/, 3];
            case 8: return [3 /*break*/, 15];
            case 9:
                e_2_1 = _f.sent();
                e_2 = { error: e_2_1 };
                return [3 /*break*/, 15];
            case 10:
                _f.trys.push([10, , 13, 14]);
                if (!(!_a && !_b && (_c = paramArray_1.return))) return [3 /*break*/, 12];
                return [4 /*yield*/, _c.call(paramArray_1)];
            case 11:
                _f.sent();
                _f.label = 12;
            case 12: return [3 /*break*/, 14];
            case 13:
                if (e_2) throw e_2.error;
                return [7 /*endfinally*/];
            case 14: return [7 /*endfinally*/];
            case 15: return [2 /*return*/, lists.flatMap(function (list) { return list.unbundle(); })];
        }
    });
}); };
exports.getAll = getAll;
function getInHouseInventoryMedications(oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var allResources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, utils_1.getResourcesFromBatchInlineRequests)(oystehr, [
                        "Medication?identifier=".concat(utils_1.INVENTORY_MEDICATION_TYPE_CODE),
                    ])];
                case 1:
                    allResources = _a.sent();
                    console.log('Received all Medications from fhir.');
                    return [2 /*return*/, filterInHouseMedications(allResources)];
            }
        });
    });
}
function filterInHouseMedications(allResources) {
    return allResources.filter(function (res) {
        return res.resourceType === 'Medication' && (0, utils_1.getMedicationTypeCode)(res) === utils_1.INVENTORY_MEDICATION_TYPE_CODE;
    });
}
var createOystehrClientFromConfig = function (config) { return __awaiter(void 0, void 0, void 0, function () {
    var token;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, shared_1.getAuth0Token)(config)];
            case 1:
                token = _a.sent();
                if (!token)
                    throw new Error('Failed to fetch auth token.');
                return [2 /*return*/, createOystehrClientFromSecrets(token, config)];
        }
    });
}); };
exports.createOystehrClientFromConfig = createOystehrClientFromConfig;
function createOystehrClientFromSecrets(token, secrets) {
    var FHIR_API = (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
    var PROJECT_API = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets);
    return (0, utils_1.createOystehrClient)(token, FHIR_API, PROJECT_API);
}
var performEffectWithEnvFile = function (callback) { return __awaiter(void 0, void 0, void 0, function () {
    var env, config, configPath, e_3, e_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                env = process.argv[2];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                configPath = path_1.default.resolve(__dirname, "../../.env/".concat(env, ".json"));
                return [4 /*yield*/, Promise.resolve("".concat(configPath)).then(function (s) { return require(s); })];
            case 2:
                config = _a.sent();
                config = __assign(__assign({}, config), { env: env });
                return [3 /*break*/, 4];
            case 3:
                e_3 = _a.sent();
                console.error(e_3);
                throw new Error("can't import config for the environment: '".concat(env, "'"));
            case 4:
                _a.trys.push([4, 6, , 7]);
                return [4 /*yield*/, callback(config)];
            case 5:
                _a.sent();
                return [3 /*break*/, 7];
            case 6:
                e_4 = _a.sent();
                console.error(e_4);
                throw new Error("Error performing effect with env file: '".concat(env, "'"));
            case 7: return [2 /*return*/];
        }
    });
}); };
exports.performEffectWithEnvFile = performEffectWithEnvFile;
