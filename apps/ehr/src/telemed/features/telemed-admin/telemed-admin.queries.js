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
exports.useInsuranceOrganizationsQuery = exports.useInsuranceMutation = exports.useInsurancesQuery = exports.useStatesQuery = void 0;
var react_query_1 = require("react-query");
var utils_1 = require("utils");
var useAppClients_1 = require("../../../hooks/useAppClients");
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useStatesQuery = function () {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['state-locations', { oystehr: oystehr }], function () { return __awaiter(void 0, void 0, void 0, function () {
        var resources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Location',
                        params: [
                            {
                                name: 'address-state:missing',
                                value: 'false',
                            },
                        ],
                    })];
                case 1:
                    resources = _a.sent();
                    return [2 /*return*/, resources.unbundle().filter(utils_1.isLocationVirtual)];
            }
        });
    }); }, {
        enabled: !!oystehr,
    });
};
exports.useStatesQuery = useStatesQuery;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useInsurancesQuery = function (id, enabled) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['insurances', { oystehr: oystehr, id: id }], function () { return __awaiter(void 0, void 0, void 0, function () {
        var searchParams, offset, plans, resources;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    searchParams = [];
                    offset = 0;
                    if (id) {
                        searchParams.push({
                            name: '_id',
                            value: id,
                        });
                    }
                    searchParams.push({
                        name: '_count',
                        value: '1000',
                    }, {
                        name: 'type',
                        value: "".concat(utils_1.ORG_TYPE_CODE_SYSTEM, "|").concat(utils_1.ORG_TYPE_PAYER_CODE),
                    }, {
                        name: '_offset',
                        value: offset,
                    });
                    plans = [];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Organization',
                            params: searchParams,
                        })];
                case 1:
                    resources = _b.sent();
                    plans = plans.concat(resources.unbundle());
                    _b.label = 2;
                case 2:
                    if (!((_a = resources.link) === null || _a === void 0 ? void 0 : _a.find(function (link) { return link.relation === 'next'; }))) return [3 /*break*/, 4];
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Organization',
                            params: searchParams.map(function (param) {
                                if (param.name === '_offset') {
                                    return __assign(__assign({}, param), { value: (offset += 1000) });
                                }
                                return param;
                            }),
                        })];
                case 3:
                    resources = _b.sent();
                    plans = plans.concat(resources.unbundle());
                    return [3 /*break*/, 2];
                case 4: return [2 /*return*/, plans];
            }
        });
    }); }, {
        enabled: (enabled !== undefined ? enabled : true) && !!oystehr,
        cacheTime: 0,
    });
};
exports.useInsurancesQuery = useInsurancesQuery;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useInsuranceMutation = function (insurancePlan) {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)(['insurances', { oystehr: oystehr, id: insurancePlan === null || insurancePlan === void 0 ? void 0 : insurancePlan.id }], function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var resourceExtensions, requirementSettingsExistingExtensions, requirementSettingsNewExtensions, resource, prom, response;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    resourceExtensions = (insurancePlan === null || insurancePlan === void 0 ? void 0 : insurancePlan.extension) || [];
                    requirementSettingsExistingExtensions = (_a = resourceExtensions.find(function (ext) { return ext.url === utils_1.FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url; })) === null || _a === void 0 ? void 0 : _a.extension;
                    requirementSettingsNewExtensions = requirementSettingsExistingExtensions || [];
                    Object.keys(utils_1.INSURANCE_SETTINGS_MAP).map(function (setting) {
                        if (data[setting] === undefined) {
                            return;
                        }
                        var currentSettingExt = {
                            url: setting,
                            valueBoolean: data[setting],
                        };
                        var existingExtIndex = requirementSettingsNewExtensions.findIndex(function (ext) { return ext.url === currentSettingExt.url; });
                        if (existingExtIndex >= 0) {
                            requirementSettingsNewExtensions[existingExtIndex] = currentSettingExt;
                        }
                        else {
                            requirementSettingsNewExtensions.push(currentSettingExt);
                        }
                    });
                    resource = {
                        resourceType: 'Organization',
                        active: (_b = data.active) !== null && _b !== void 0 ? _b : true,
                        name: data.displayName,
                        type: [
                            {
                                coding: [
                                    {
                                        system: utils_1.ORG_TYPE_CODE_SYSTEM,
                                        code: utils_1.ORG_TYPE_PAYER_CODE,
                                    },
                                ],
                            },
                        ],
                    };
                    if (!requirementSettingsExistingExtensions) {
                        resourceExtensions === null || resourceExtensions === void 0 ? void 0 : resourceExtensions.push({
                            url: utils_1.FHIR_EXTENSION.InsurancePlan.insuranceRequirements.url,
                            extension: requirementSettingsNewExtensions,
                        });
                    }
                    resource.extension = resourceExtensions;
                    if (!oystehr)
                        throw new Error('Oystehr is not defined');
                    if (data.id) {
                        resource.id = data.id;
                        prom = oystehr.fhir.update(resource);
                    }
                    else {
                        prom = oystehr.fhir.create(resource);
                    }
                    return [4 /*yield*/, prom];
                case 1:
                    response = _c.sent();
                    return [2 /*return*/, response];
            }
        });
    }); });
};
exports.useInsuranceMutation = useInsuranceMutation;
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useInsuranceOrganizationsQuery = function () {
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['insurance-organizations', { oystehr: oystehr }], function () { return __awaiter(void 0, void 0, void 0, function () {
        var resources;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Organization',
                        params: [
                            {
                                name: 'type',
                                value: "".concat(utils_1.ORG_TYPE_CODE_SYSTEM, "|").concat(utils_1.ORG_TYPE_PAYER_CODE),
                            },
                        ],
                    })];
                case 1:
                    resources = _a.sent();
                    return [2 /*return*/, resources.unbundle()];
            }
        });
    }); }, {
        enabled: !!oystehr,
    });
};
exports.useInsuranceOrganizationsQuery = useInsuranceOrganizationsQuery;
//# sourceMappingURL=telemed-admin.queries.js.map