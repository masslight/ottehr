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
exports.getAllVirtualLocationsMap = exports.getAllPartiallyPreFilteredFhirResources = exports.getPractitionerLicensesLocationsAbbreviations = exports.getAllResourcesFromFhir = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var getAllFhirSearchPages_1 = require("utils/lib/fhir/getAllFhirSearchPages");
var helpers_1 = require("./helpers");
var mappers_1 = require("./mappers");
var getAllResourcesFromFhir = function (oystehr, locationIds, encounterStatusesToSearchWith, appointmentStatusesToSearchWith, searchDate) { return __awaiter(void 0, void 0, void 0, function () {
    var fhirSearchParams;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                fhirSearchParams = {
                    resourceType: 'Appointment',
                    params: __spreadArray(__spreadArray([
                        {
                            name: '_tag',
                            value: utils_1.OTTEHR_MODULE.TM,
                        },
                        {
                            name: 'status',
                            value: appointmentStatusesToSearchWith.join(','),
                        },
                        {
                            name: '_has:Encounter:appointment:status',
                            value: encounterStatusesToSearchWith.join(','),
                        },
                        {
                            name: '_sort',
                            value: 'date',
                        },
                        {
                            name: '_include',
                            value: 'Appointment:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'RelatedPerson:patient',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Encounter:participant:Practitioner',
                        },
                        {
                            name: '_include',
                            value: 'Appointment:location',
                        },
                        {
                            name: '_revinclude',
                            value: 'Encounter:appointment',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'DocumentReference:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'QuestionnaireResponse:encounter',
                        }
                    ], (searchDate
                        ? [
                            {
                                name: 'date',
                                value: "ge".concat(searchDate.startOf('day').toISO()),
                            },
                            {
                                name: 'date',
                                value: "le".concat(searchDate.endOf('day').toISO()),
                            },
                        ]
                        : []), true), (locationIds.length > 0
                        ? [
                            {
                                name: 'location',
                                value: (0, helpers_1.joinLocationsIdsForFhirSearch)(locationIds),
                            },
                        ]
                        : []), true),
                };
                return [4 /*yield*/, (0, getAllFhirSearchPages_1.getAllFhirSearchPages)(fhirSearchParams, oystehr, 100)];
            case 1: return [2 /*return*/, (_a.sent()).filter(function (resource) { return (0, utils_1.isNonPaperworkQuestionnaireResponse)(resource) === false; })];
        }
    });
}); };
exports.getAllResourcesFromFhir = getAllResourcesFromFhir;
var getPractitionerLicensesLocationsAbbreviations = function (oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var practitionerId, practitioner;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, oystehr.user.me()];
            case 1:
                practitionerId = (_b.sent()).profile.replace('Practitioner/', '');
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Practitioner',
                        id: practitionerId,
                    })];
            case 2:
                practitioner = (_a = (_b.sent())) !== null && _a !== void 0 ? _a : null;
                console.log('Me as practitioner: ' + JSON.stringify(practitioner));
                return [2 /*return*/, (0, utils_1.allLicensesForPractitioner)(practitioner)
                        .filter(function (license) { return license.active; })
                        .map(function (license) { return license.state; })];
        }
    });
}); };
exports.getPractitionerLicensesLocationsAbbreviations = getPractitionerLicensesLocationsAbbreviations;
var locationIdsForAppointmentsSearch = function (usStatesFilter, patientFilter, virtualLocationsMap, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var intersect, usStatesFilterOrEmpty, hasNoUsStatesFiltersSet, statesAbbreviations, licensedPractitionerStates, allowedUsStates;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                intersect = function (arr1, arr2) {
                    var buffer = new Set(arr2);
                    return arr1.filter(function (element) { return buffer.has(element); });
                };
                usStatesFilterOrEmpty = usStatesFilter || [];
                hasNoUsStatesFiltersSet = usStatesFilterOrEmpty.length === 0;
                console.log('Requested US_states filter: ' + JSON.stringify(usStatesFilter));
                if (patientFilter !== 'my-patients') {
                    statesAbbreviations = hasNoUsStatesFiltersSet ? [] : __spreadArray([], usStatesFilterOrEmpty, true);
                    return [2 /*return*/, (0, mappers_1.mapStatesToLocationIds)(statesAbbreviations, virtualLocationsMap)];
                }
                if (!(patientFilter === 'my-patients')) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, exports.getPractitionerLicensesLocationsAbbreviations)(oystehr)];
            case 1:
                licensedPractitionerStates = _a.sent();
                console.log('Licensed Practitioner US_states: ' + JSON.stringify(licensedPractitionerStates));
                if (hasNoUsStatesFiltersSet) {
                    return [2 /*return*/, (0, mappers_1.mapStatesToLocationIds)(licensedPractitionerStates, virtualLocationsMap)];
                }
                allowedUsStates = intersect(licensedPractitionerStates, usStatesFilterOrEmpty);
                console.log('Licensed Practitioner US_states + Applied US_states filter: ' + JSON.stringify(allowedUsStates));
                if (allowedUsStates.length === 0) {
                    return [2 /*return*/, undefined];
                }
                return [2 /*return*/, (0, mappers_1.mapStatesToLocationIds)(allowedUsStates, virtualLocationsMap)];
            case 2: return [2 /*return*/, (0, mappers_1.mapStatesToLocationIds)([], virtualLocationsMap)];
        }
    });
}); };
var getAllPartiallyPreFilteredFhirResources = function (oystehrM2m, oystehrCurrentUser, params, virtualLocationsMap) { return __awaiter(void 0, void 0, void 0, function () {
    var dateFilter, usStatesFilter, statusesFilter, patientFilter, allResources, locationsIdsToSearchWith, _a, encounterStatusesToSearchWith, appointmentStatusesToSearchWith, dateFilterConverted;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                dateFilter = params.dateFilter, usStatesFilter = params.usStatesFilter, statusesFilter = params.statusesFilter, patientFilter = params.patientFilter;
                allResources = [];
                return [4 /*yield*/, locationIdsForAppointmentsSearch(usStatesFilter, patientFilter, virtualLocationsMap, oystehrCurrentUser)];
            case 1:
                locationsIdsToSearchWith = _b.sent();
                if (!locationsIdsToSearchWith)
                    return [2 /*return*/, undefined];
                _a = (0, mappers_1.mapTelemedStatusToEncounterAndAppointment)(statusesFilter), encounterStatusesToSearchWith = _a.encounterStatuses, appointmentStatusesToSearchWith = _a.appointmentStatuses;
                console.log('Received all location ids and encounter statuses to search with.');
                if (locationsIdsToSearchWith.length === 0 && patientFilter === 'my-patients') {
                    return [2 /*return*/, []];
                }
                dateFilterConverted = dateFilter
                    ? luxon_1.DateTime.fromISO(dateFilter, {
                        zone: params.timeZone,
                    })
                    : undefined;
                return [4 /*yield*/, (0, exports.getAllResourcesFromFhir)(oystehrM2m, locationsIdsToSearchWith, encounterStatusesToSearchWith, appointmentStatusesToSearchWith, dateFilterConverted)];
            case 2:
                allResources = _b.sent();
                console.log('Received resources from fhir with all filters applied.');
                return [2 /*return*/, allResources];
        }
    });
}); };
exports.getAllPartiallyPreFilteredFhirResources = getAllPartiallyPreFilteredFhirResources;
var getAllVirtualLocationsMap = function (oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var resources, virtualLocationsMap, locationsByState;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'Location',
                })];
            case 1:
                resources = (_a.sent()).unbundle();
                virtualLocationsMap = {};
                locationsByState = {};
                resources.forEach(function (resource) {
                    var _a;
                    if (resource.resourceType === 'Location' && (0, utils_1.isLocationVirtual)(resource)) {
                        var location_1 = resource;
                        var state = (_a = location_1.address) === null || _a === void 0 ? void 0 : _a.state;
                        var locationId = location_1.id;
                        if (state && locationId) {
                            if (!locationsByState[state]) {
                                locationsByState[state] = [];
                            }
                            if (!virtualLocationsMap[state]) {
                                virtualLocationsMap[state] = [];
                            }
                            locationsByState[state].push(location_1);
                            virtualLocationsMap[state].push(location_1);
                        }
                    }
                });
                Object.entries(locationsByState).forEach(function (_a) {
                    var state = _a[0], locs = _a[1];
                    if (locs.length > 1) {
                        console.warn("\u26A0\uFE0F Found several virtual locations in ".concat(state, ":"));
                        locs.forEach(function (loc) {
                            console.warn("- ".concat(loc.id, ": ").concat(loc.name));
                        });
                    }
                });
                return [2 /*return*/, virtualLocationsMap];
        }
    });
}); };
exports.getAllVirtualLocationsMap = getAllVirtualLocationsMap;
