"use strict";
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
var shared_1 = require("../../../shared");
var ZAMBDA_NAME = 'list-bookables';
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var fhirAPI, projectAPI, serviceType, oystehr, response, items, error_1, ENVIRONMENT;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 8, , 9]);
                fhirAPI = (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, input.secrets);
                projectAPI = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, input.secrets);
                serviceType = validateRequestParameters(input).serviceMode;
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting m2m token for service calls');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(input.secrets)];
            case 1:
                oystehrToken = _b.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have a token, no need to update');
                _b.label = 3;
            case 3:
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, fhirAPI, projectAPI);
                response = void 0;
                if (!(serviceType === 'virtual')) return [3 /*break*/, 5];
                _a = {};
                return [4 /*yield*/, getTelemedLocations(oystehr)];
            case 4:
                response = (_a.items = _b.sent(), _a.categorized = false, _a);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, Promise.all([getPhysicalLocations(oystehr), getGroups(oystehr, utils_1.ServiceMode['in-person'])])];
            case 6:
                items = (_b.sent()).flatMap(function (i) { return i; });
                response = { items: items, categorized: false };
                _b.label = 7;
            case 7:
                response.items = response.items.sort(function (i1, i2) { return i1.label.localeCompare(i2.label); });
                console.log('response items', response.items);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 8:
                error_1 = _b.sent();
                console.error('Failed to get bookables', error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('list-bookables', error_1, ENVIRONMENT)];
            case 9: return [2 /*return*/];
        }
    });
}); });
function getTelemedLocations(oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var resources, telemedLocations, someUndefined, items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Location',
                        params: [],
                    })];
                case 1:
                    resources = (_a.sent()).unbundle();
                    telemedLocations = resources.filter(function (location) { return (0, utils_1.isLocationVirtual)(location); });
                    someUndefined = telemedLocations.map(function (location) { return makeBookableVirtualLocation(location); });
                    items = someUndefined.filter(function (item) { return !!item; });
                    return [2 /*return*/, items];
            }
        });
    });
}
function getGroups(oystehr, serviceMode) {
    return __awaiter(this, void 0, void 0, function () {
        var params, resources, hsObjects, someUndefined, items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    params = [];
                    if (serviceMode === utils_1.ServiceMode['in-person']) {
                        params.push({ name: 'characteristic', value: utils_1.ServiceModeCoding.inPerson.fullParam });
                    }
                    else {
                        params.push({
                            name: 'characteristic',
                            value: [
                                utils_1.ServiceModeCoding.chat.fullParam,
                                utils_1.ServiceModeCoding.telephone.fullParam,
                                utils_1.ServiceModeCoding.videoConference.fullParam,
                            ].join(','),
                        });
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'HealthcareService',
                            params: params,
                        })];
                case 1:
                    resources = (_a.sent()).unbundle();
                    console.log('group resources', resources);
                    hsObjects = [];
                    resources.forEach(function (hsOrLoc, idx) {
                        if (hsOrLoc.resourceType === 'HealthcareService') {
                            var hs_1 = hsOrLoc;
                            var loc = resources.slice(idx).filter(function (res) {
                                var _a;
                                return (res.resourceType === 'Location' &&
                                    ((_a = hs_1.location) === null || _a === void 0 ? void 0 : _a.some(function (locRef) {
                                        return locRef.reference === "Location/".concat(res.id);
                                    })));
                            });
                            hsObjects.push({ hs: hs_1, loc: loc });
                        }
                    });
                    someUndefined = hsObjects.map(function (group) { return makeBookableGroup(group.hs); });
                    items = someUndefined.filter(function (item) { return !!item; });
                    return [2 /*return*/, items];
            }
        });
    });
}
function getPhysicalLocations(oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var resources, physicalLocations, someUndefined, items;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Location',
                        params: [
                            {
                                name: 'address-city:missing',
                                value: 'false',
                            },
                        ],
                    })];
                case 1:
                    resources = (_a.sent()).unbundle();
                    physicalLocations = resources.filter(function (location) { return !(0, utils_1.isLocationVirtual)(location); });
                    console.log('physical locations found', physicalLocations);
                    someUndefined = physicalLocations.map(function (location) { return makeBookablePhysicalLocation(location); });
                    items = someUndefined.filter(function (item) { return !!item; });
                    return [2 /*return*/, items];
            }
        });
    });
}
var makeBookableVirtualLocation = function (location) {
    var _a, _b, _c, _d;
    var stateCode = ((_a = location.address) === null || _a === void 0 ? void 0 : _a.state) || '';
    var stateFullName = (_c = utils_1.stateCodeToFullName[((_b = location.address) === null || _b === void 0 ? void 0 : _b.state) || '']) !== null && _c !== void 0 ? _c : '';
    var isActive = location.status === 'active';
    var slug = (0, utils_1.getSlugForBookableResource)(location);
    if (!slug || !location.id || !isActive) {
        return undefined;
    }
    var label = (_d = location.name) !== null && _d !== void 0 ? _d : stateFullName;
    return {
        label: label,
        slug: slug,
        serviceMode: utils_1.ServiceMode.virtual,
        resourceType: 'Location',
        resourceId: location.id,
        secondaryLabel: [],
        state: stateCode,
    };
};
var makeBookablePhysicalLocation = function (location) {
    var _a, _b, _c;
    var isActive = location.status === 'active';
    var slug = (0, utils_1.getSlugForBookableResource)(location);
    var stateFullName = (_b = utils_1.stateCodeToFullName[((_a = location.address) === null || _a === void 0 ? void 0 : _a.state) || '']) !== null && _b !== void 0 ? _b : '';
    if (!slug || !location.id || !isActive) {
        return undefined;
    }
    var label = (_c = location.name) !== null && _c !== void 0 ? _c : slug;
    return {
        label: label,
        slug: slug,
        resourceType: 'Location',
        resourceId: location.id,
        secondaryLabel: [],
        category: stateFullName,
    };
};
var makeBookableGroup = function (service) {
    var _a;
    var slug = (0, utils_1.getSlugForBookableResource)(service);
    if (!slug || !service.id) {
        return undefined;
    }
    var label = (_a = service.name) !== null && _a !== void 0 ? _a : slug;
    return {
        label: label,
        slug: slug,
        serviceMode: (0, utils_1.serviceModeForHealthcareService)(service),
        resourceType: 'HealthcareService',
        resourceId: service.id,
        secondaryLabel: [],
    };
};
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var serviceMode = JSON.parse(input.body).serviceMode;
    if (!serviceMode) {
        throw new Error('serviceType parameter ("in-person"|"virtual") is required');
    }
    return {
        serviceMode: serviceMode,
    };
}
