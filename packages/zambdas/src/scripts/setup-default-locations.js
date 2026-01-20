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
exports.checkLocations = exports.defaultGroup = exports.allPhysicalDefaultLocations = exports.virtualDefaultLocations = void 0;
var crypto_1 = require("crypto");
var utils_1 = require("utils");
var shared_1 = require("../shared");
exports.virtualDefaultLocations = __spreadArray([], utils_1.TELEMED_INITIAL_STATES.map(function (state) { return ({ state: state }); }), true);
exports.allPhysicalDefaultLocations = [
    {
        state: 'NY',
        city: 'New York',
        name: 'New York',
    },
    {
        state: 'CA',
        city: 'Los Angeles',
        name: 'Los Angeles',
    },
];
exports.defaultGroup = 'Visit Followup Group';
var checkLocations = function (oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var allLocations, telemedExistingVirtualLocationNames, _i, virtualDefaultLocations_1, locationPkg, locationName, _a, allPhysicalDefaultLocations_1, locationInfo;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'Location',
                })];
            case 1:
                allLocations = _b.sent();
                console.log('Received all locations from fhir.');
                telemedExistingVirtualLocationNames = (0, utils_1.filterVirtualLocations)(allLocations.entry).map(function (location) {
                    if (location === null || location === void 0 ? void 0 : location.name)
                        return location.name;
                    return '';
                });
                console.log('Filtered all virtual telemed locations.');
                _i = 0, virtualDefaultLocations_1 = exports.virtualDefaultLocations;
                _b.label = 2;
            case 2:
                if (!(_i < virtualDefaultLocations_1.length)) return [3 /*break*/, 5];
                locationPkg = virtualDefaultLocations_1[_i];
                locationName = utils_1.AllStatesToVirtualLocationLabels[locationPkg.state];
                if (!!telemedExistingVirtualLocationNames.includes(locationName)) return [3 /*break*/, 4];
                return [4 /*yield*/, createTelemedLocation(__assign(__assign({}, locationPkg), { name: locationName }), oystehr)];
            case 3:
                _b.sent();
                _b.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5:
                console.log('All telemed locations exist');
                _a = 0, allPhysicalDefaultLocations_1 = exports.allPhysicalDefaultLocations;
                _b.label = 6;
            case 6:
                if (!(_a < allPhysicalDefaultLocations_1.length)) return [3 /*break*/, 9];
                locationInfo = allPhysicalDefaultLocations_1[_a];
                return [4 /*yield*/, createPhysicalLocation(locationInfo, oystehr)];
            case 7:
                _b.sent();
                _b.label = 8;
            case 8:
                _a++;
                return [3 /*break*/, 6];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.checkLocations = checkLocations;
var createTelemedLocation = function (locationData, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var location, createLocationRequest, locationSchedule, createScheduleRequest, fhirResponse, unbundled, fhirLocation;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                location = {
                    resourceType: 'Location',
                    status: 'active',
                    address: {
                        state: locationData.state,
                    },
                    extension: [
                        {
                            url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
                            valueCoding: {
                                system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
                                code: 'vi',
                                display: 'Virtual',
                            },
                        },
                        {
                            url: utils_1.TIMEZONE_EXTENSION_URL,
                            valueString: 'America/New_York',
                        },
                    ],
                    identifier: [
                        {
                            system: utils_1.SLUG_SYSTEM,
                            value: locationData.name.replace(/\s/g, ''), // remove whitespace from the name
                        },
                    ],
                    // managing organization will be added later after organizations are created
                    name: locationData.name,
                };
                createLocationRequest = {
                    method: 'POST',
                    url: '/Location',
                    resource: location,
                    fullUrl: "urn:uuid:".concat((0, crypto_1.randomUUID)()),
                };
                locationSchedule = {
                    resourceType: 'Schedule',
                    active: true,
                    extension: [
                        {
                            url: utils_1.SCHEDULE_EXTENSION_URL,
                            valueString: '{"schedule":{"monday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"tuesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"wednesday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"thursday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"friday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"saturday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]},"sunday":{"open":8,"close":15,"openingBuffer":0,"closingBuffer":0,"workingDay":true,"hours":[{"hour":8,"capacity":2},{"hour":9,"capacity":2},{"hour":10,"capacity":2},{"hour":11,"capacity":2},{"hour":12,"capacity":2},{"hour":13,"capacity":2},{"hour":14,"capacity":2},{"hour":15,"capacity":2},{"hour":16,"capacity":2},{"hour":17,"capacity":3},{"hour":18,"capacity":3},{"hour":19,"capacity":3},{"hour":20,"capacity":1}]}},"scheduleOverrides":{}}',
                        },
                        {
                            url: utils_1.TIMEZONE_EXTENSION_URL,
                            valueString: 'America/New_York',
                        },
                    ],
                    actor: [
                        {
                            reference: createLocationRequest.fullUrl,
                        },
                    ],
                };
                createScheduleRequest = {
                    method: 'POST',
                    url: '/Schedule',
                    resource: locationSchedule,
                };
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: [createLocationRequest, createScheduleRequest],
                    })];
            case 1:
                fhirResponse = _c.sent();
                unbundled = (0, utils_1.unbundleBatchPostOutput)(fhirResponse);
                fhirLocation = unbundled.find(function (resource) { return resource.resourceType === 'Location'; });
                console.log("Created fhir location: state: ".concat((_a = fhirLocation === null || fhirLocation === void 0 ? void 0 : fhirLocation.address) === null || _a === void 0 ? void 0 : _a.state, ", id: ").concat(fhirLocation === null || fhirLocation === void 0 ? void 0 : fhirLocation.id));
                console.log("Created fhir schedule: id: ".concat(locationSchedule.id, " for ").concat((_b = fhirLocation === null || fhirLocation === void 0 ? void 0 : fhirLocation.address) === null || _b === void 0 ? void 0 : _b.state, " location"));
                return [2 /*return*/];
        }
    });
}); };
var createPhysicalLocation = function (locationInfo, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var prevLocations, newLocation, createLocationRequest, locationSchedule, createScheduleRequest, results;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'Location',
                    params: [
                        {
                            name: 'address-state',
                            value: locationInfo.state,
                        },
                        {
                            name: 'address-city',
                            value: locationInfo.city,
                        },
                    ],
                })];
            case 1:
                prevLocations = _b.sent();
                if (!!((_a = prevLocations.entry) === null || _a === void 0 ? void 0 : _a.length)) return [3 /*break*/, 3];
                newLocation = utils_1.defaultLocation;
                newLocation.name = locationInfo.name;
                newLocation.address = {
                    city: locationInfo.city,
                    state: locationInfo.state,
                };
                // add identifiers
                newLocation.identifier = [
                    {
                        system: utils_1.SLUG_SYSTEM,
                        value: "".concat(locationInfo.city, "-").concat(locationInfo.state).replace(/\s/g, ''), // remove whitespace from the name
                    },
                ];
                newLocation.extension = __spreadArray([
                    {
                        url: utils_1.TIMEZONE_EXTENSION_URL,
                        valueString: 'America/New_York',
                    }
                ], Array.from({ length: 11 }, function (_, i) { return ({
                    url: utils_1.ROOM_EXTENSION_URL,
                    valueString: (i + 1).toString(),
                }); }), true);
                createLocationRequest = {
                    method: 'POST',
                    url: '/Location',
                    resource: newLocation,
                    fullUrl: "urn:uuid:".concat((0, crypto_1.randomUUID)()),
                };
                locationSchedule = {
                    resourceType: 'Schedule',
                    active: true,
                    extension: [
                        {
                            url: utils_1.SCHEDULE_EXTENSION_URL,
                            valueString: '{"schedule":{"monday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":10},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]},"tuesday":{"open":8,"close":21,"openingBuffer":0,"closingBuffer":30,"workingDay":true,"hours":[{"hour":8,"capacity":10},{"hour":9,"capacity":5},{"hour":10,"capacity":7},{"hour":11,"capacity":4},{"hour":12,"capacity":8},{"hour":13,"capacity":11},{"hour":14,"capacity":1},{"hour":15,"capacity":2},{"hour":16,"capacity":1},{"hour":17,"capacity":1},{"hour":18,"capacity":2},{"hour":19,"capacity":2},{"hour":20,"capacity":6}]},"wednesday":{"open":8,"close":0,"openingBuffer":30,"closingBuffer":30,"workingDay":true,"hours":[{"hour":8,"capacity":20},{"hour":9,"capacity":20},{"hour":10,"capacity":20},{"hour":11,"capacity":20},{"hour":12,"capacity":20},{"hour":13,"capacity":20},{"hour":14,"capacity":20},{"hour":15,"capacity":20},{"hour":16,"capacity":20},{"hour":17,"capacity":20},{"hour":18,"capacity":20},{"hour":19,"capacity":20},{"hour":20,"capacity":20},{"hour":21,"capacity":20},{"hour":22,"capacity":20},{"hour":23,"capacity":20}]},"thursday":{"open":18,"close":24,"openingBuffer":30,"closingBuffer":0,"workingDay":true,"hours":[{"hour":0,"capacity":0},{"hour":1,"capacity":0},{"hour":2,"capacity":0},{"hour":3,"capacity":0},{"hour":4,"capacity":0},{"hour":5,"capacity":0},{"hour":6,"capacity":0},{"hour":7,"capacity":0},{"hour":8,"capacity":0},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":12},{"hour":18,"capacity":10},{"hour":19,"capacity":10},{"hour":20,"capacity":10},{"hour":21,"capacity":0},{"hour":22,"capacity":10},{"hour":23,"capacity":10}]},"friday":{"open":14,"close":21,"openingBuffer":30,"closingBuffer":30,"workingDay":true,"hours":[{"hour":14,"capacity":5},{"hour":15,"capacity":6},{"hour":16,"capacity":6},{"hour":17,"capacity":5},{"hour":18,"capacity":5},{"hour":19,"capacity":5},{"hour":20,"capacity":5}]},"saturday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]},"sunday":{"open":4,"close":20,"openingBuffer":90,"closingBuffer":60,"workingDay":true,"hours":[{"hour":4,"capacity":0},{"hour":5,"capacity":2},{"hour":6,"capacity":3},{"hour":7,"capacity":4},{"hour":8,"capacity":5},{"hour":9,"capacity":6},{"hour":10,"capacity":7},{"hour":11,"capacity":8},{"hour":12,"capacity":9},{"hour":13,"capacity":10},{"hour":14,"capacity":11},{"hour":15,"capacity":0},{"hour":16,"capacity":12},{"hour":17,"capacity":13},{"hour":18,"capacity":14},{"hour":19,"capacity":18}]}},"scheduleOverrides":{"12/21/2023":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"12/9/2023":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"05/01/2024":{"open":8,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]},"1/19/2024":{"open":7,"close":17,"openingBuffer":0,"closingBuffer":0,"hours":[]}}}',
                        },
                        {
                            url: utils_1.TIMEZONE_EXTENSION_URL,
                            valueString: 'America/New_York',
                        },
                    ],
                    actor: [
                        {
                            reference: createLocationRequest.fullUrl,
                        },
                    ],
                    serviceCategory: [utils_1.SlotServiceCategory.inPersonServiceMode],
                };
                createScheduleRequest = {
                    method: 'POST',
                    url: '/Schedule',
                    resource: locationSchedule,
                };
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: [createLocationRequest, createScheduleRequest],
                    })];
            case 2:
                results = _b.sent();
                return [2 /*return*/, results];
            case 3:
                console.log("Location already exists.");
                return [2 /*return*/, null];
        }
    });
}); };
// Create Practitioners
var createPractitionerForEligibilityCheck = function (config) { return __awaiter(void 0, void 0, void 0, function () {
    var envToken, oystehr;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, shared_1.getAuth0Token)(config)];
            case 1:
                envToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(envToken, config);
                utils_1.ELIGIBILITY_PRACTITIONER_TYPES.forEach(function (type) { return __awaiter(void 0, void 0, void 0, function () {
                    var eligibilityPractitioners;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, oystehr.fhir.search({
                                    resourceType: 'Practitioner',
                                    params: [
                                        {
                                            name: '_tag',
                                            value: "".concat(utils_1.ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX, "_").concat(type),
                                        },
                                    ],
                                })];
                            case 1:
                                eligibilityPractitioners = (_a.sent()).unbundle();
                                if (!(eligibilityPractitioners.length === 0)) return [3 /*break*/, 3];
                                return [4 /*yield*/, createNewPractitioner(config, oystehr, type)];
                            case 2:
                                _a.sent();
                                _a.label = 3;
                            case 3: return [2 /*return*/];
                        }
                    });
                }); });
                return [2 /*return*/];
        }
    });
}); };
var createNewPractitioner = function (config, oystehr, type) { return __awaiter(void 0, void 0, void 0, function () {
    var npi, practitioner;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                npi = '1790914042';
                if (config.ENVIRONMENT === 'production') {
                    npi = type === 'individual' ? '1326138728' : '1275013955';
                }
                practitioner = {
                    resourceType: 'Practitioner',
                    identifier: [
                        {
                            system: utils_1.FHIR_IDENTIFIER_NPI,
                            type: {
                                coding: [
                                    {
                                        code: 'NPI',
                                        system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                                    },
                                ],
                            },
                            value: npi,
                        },
                    ],
                    meta: {
                        tag: [
                            {
                                code: "".concat(utils_1.ELIGIBILITY_PRACTITIONER_META_TAG_PREFIX, "_").concat(type),
                            },
                        ],
                    },
                };
                return [4 /*yield*/, oystehr.fhir.create(practitioner)];
            case 1:
                _a.sent();
                console.log("Created eligibility MVP ".concat(type, " practitioner"));
                return [2 /*return*/];
        }
    });
}); };
// Main
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var e_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, Promise.all([exports.checkLocations, createPractitionerForEligibilityCheck])];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                e_1 = _a.sent();
                console.log('Catch some error while running all effects: ', e_1);
                console.log('Stringifies: ', JSON.stringify(e_1));
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); };
main().catch(function (error) {
    console.log('error', error);
    throw error;
});
