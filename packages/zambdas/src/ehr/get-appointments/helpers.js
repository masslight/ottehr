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
exports.makeEncounterSearchParams = exports.makeEncounterBaseSearchParams = exports.getTimezoneResourceIdFromAppointment = exports.getAppointmentQueryInput = exports.getTimezone = exports.encounterIdMap = exports.timezoneMap = exports.makeResourceCacheKey = exports.getMergedResourcesFromBundles = exports.mergeResources = exports.parseAttenderProviderType = exports.parseEncounterParticipants = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var parseParticipantInfo = function (practitioner) {
    var _a, _b, _c, _d, _e, _f, _g;
    return ({
        firstName: (_d = (_c = (_b = (_a = practitioner.name) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.given) === null || _c === void 0 ? void 0 : _c[0]) !== null && _d !== void 0 ? _d : '',
        lastName: (_g = (_f = (_e = practitioner.name) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.family) !== null && _g !== void 0 ? _g : '',
    });
};
var parseEncounterParticipants = function (encounter, participantIdToResourceMap) {
    var _a;
    var participants = {};
    (_a = encounter.participant) === null || _a === void 0 ? void 0 : _a.forEach(function (participant) {
        var _a, _b, _c, _d, _e;
        // Skip if no reference or type
        if (!((_a = participant.individual) === null || _a === void 0 ? void 0 : _a.reference) || !((_e = (_d = (_c = (_b = participant.type) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.code)) {
            return;
        }
        var practitioner = participantIdToResourceMap[participant.individual.reference];
        if (!practitioner)
            return;
        var participantType = participant.type[0].coding[0].code;
        switch (participantType) {
            case utils_1.PRACTITIONER_CODINGS.Admitter[0].code:
                participants.admitter = parseParticipantInfo(practitioner);
                break;
            case utils_1.PRACTITIONER_CODINGS.Attender[0].code:
                participants.attender = parseParticipantInfo(practitioner);
                break;
        }
    });
    return participants;
};
exports.parseEncounterParticipants = parseEncounterParticipants;
var parseAttenderProviderType = function (encounter, participantIdToResourceMap) {
    var _a, _b, _c, _d, _e;
    if (!encounter.participant)
        return;
    for (var _i = 0, _f = encounter.participant; _i < _f.length; _i++) {
        var participant = _f[_i];
        if (!((_a = participant.individual) === null || _a === void 0 ? void 0 : _a.reference) || !((_e = (_d = (_c = (_b = participant.type) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.code)) {
            continue;
        }
        var practitioner = participantIdToResourceMap[participant.individual.reference];
        if (!practitioner)
            continue;
        var participantType = participant.type[0].coding[0].code;
        if (participantType === utils_1.PRACTITIONER_CODINGS.Attender[0].code) {
            var providerType = (0, utils_1.getProviderType)(practitioner);
            return providerType;
        }
    }
    return;
};
exports.parseAttenderProviderType = parseAttenderProviderType;
var mergeResources = function (resources) {
    if (!resources.length)
        return [];
    var uniqueMap = new Map();
    for (var i = 0; i < resources.length; i++) {
        var resource = resources[i];
        if (resource && resource.id) {
            uniqueMap.set(resource.id, resource);
        }
    }
    return Array.from(uniqueMap.values());
};
exports.mergeResources = mergeResources;
var getMergedResourcesFromBundles = function (bundles) {
    var allResources = bundles.flatMap(function (bundle) { return bundle.unbundle(); });
    return (0, exports.mergeResources)(allResources);
};
exports.getMergedResourcesFromBundles = getMergedResourcesFromBundles;
var makeResourceCacheKey = function (_a) {
    var resourceId = _a.resourceId, resourceType = _a.resourceType;
    var time = luxon_1.DateTime.now().setZone('UTC').startOf('day').toISO();
    return "".concat(resourceType, "|").concat(resourceId, "|").concat(time);
};
exports.makeResourceCacheKey = makeResourceCacheKey;
exports.timezoneMap = new Map(); // key: Location id | Group id | Provider id, value: timezone
/**
 * Encounters ids for previous day and older are cached, and if that response didn't
 * return any encounters (cache value is a null in that case), we can skip the search for this date
 */
exports.encounterIdMap = new Map(); // key: cache key, value: encounter ids
var getTimezone = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var timezone, resource, e_1;
    var _c, _d;
    var oystehr = _b.oystehr, resourceType = _b.resourceType, resourceId = _b.resourceId;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                if (!!exports.timezoneMap.has(resourceId)) return [3 /*break*/, 4];
                _e.label = 1;
            case 1:
                _e.trys.push([1, 3, , 4]);
                return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: resourceType,
                        id: resourceId,
                    })];
            case 2:
                resource = _e.sent();
                timezone = (_d = (_c = resource === null || resource === void 0 ? void 0 : resource.extension) === null || _c === void 0 ? void 0 : _c.find(function (extensionTemp) { return extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'; })) === null || _d === void 0 ? void 0 : _d.valueString;
                if (timezone) {
                    exports.timezoneMap.set(resourceId, timezone);
                    console.log("timezone found for ".concat(resourceId, " and added to timezoneMap"), timezone);
                }
                else {
                    console.error("timezone not set for ".concat(resourceId));
                }
                return [3 /*break*/, 4];
            case 3:
                e_1 = _e.sent();
                console.log('error getting location', JSON.stringify(e_1));
                throw new Error('location is not found');
            case 4: return [2 /*return*/, exports.timezoneMap.get(resourceId)];
        }
    });
}); };
exports.getTimezone = getTimezone;
var getAppointmentQueryInput = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehr, resourceId, resourceType, searchDate, timezone, searchDateInTargetTimezone, startDay, endDay, _a, actorParams, healthcareService;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                oystehr = input.oystehr, resourceId = input.resourceId, resourceType = input.resourceType, searchDate = input.searchDate;
                return [4 /*yield*/, (0, exports.getTimezone)({
                        oystehr: oystehr,
                        resourceType: resourceType,
                        resourceId: resourceId,
                    })];
            case 1:
                timezone = _b.sent();
                searchDateInTargetTimezone = luxon_1.DateTime.fromISO(searchDate, { zone: timezone });
                startDay = searchDateInTargetTimezone.startOf('day').toUTC().toISO();
                endDay = searchDateInTargetTimezone.endOf('day').toUTC().toISO();
                return [4 /*yield*/, getActorParamsForAppointmentQueryInput(input)];
            case 2:
                _a = _b.sent(), actorParams = _a.actorParams, healthcareService = _a.healthcareService;
                return [2 /*return*/, {
                        resourceType: 'Appointment',
                        params: __spreadArray([
                            {
                                name: 'date',
                                value: "ge".concat(startDay),
                            },
                            {
                                name: 'date',
                                value: "le".concat(endDay),
                            },
                            {
                                name: 'date:missing',
                                value: 'false',
                            },
                            {
                                name: '_sort',
                                value: 'date',
                            },
                            { name: '_count', value: '1000' },
                            {
                                name: '_include',
                                value: 'Appointment:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'RelatedPerson:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Person:link',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Encounter:participant',
                            },
                            {
                                name: '_include',
                                value: 'Appointment:location',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Encounter:appointment',
                            },
                            { name: '_revinclude:iterate', value: 'DocumentReference:patient' },
                            { name: '_revinclude:iterate', value: 'QuestionnaireResponse:encounter' },
                            { name: '_include', value: 'Appointment:actor' }
                        ], actorParams, true),
                        group: healthcareService,
                    }];
        }
    });
}); };
exports.getAppointmentQueryInput = getAppointmentQueryInput;
var getActorParamsForAppointmentQueryInput = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var healthcareService, actorParams;
    var oystehr = _b.oystehr, resourceId = _b.resourceId, resourceType = _b.resourceType;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (function () { return __awaiter(void 0, void 0, void 0, function () {
                    var healthcareServiceAndMembers, allResources, locations, practitioners, locationIdParams, practitionerIdParams, scheduleStrategy;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                if (resourceType === 'Location') {
                                    return [2 /*return*/, [{ name: 'location', value: "Location/".concat(resourceId) }]];
                                }
                                if (resourceType === 'Practitioner') {
                                    return [2 /*return*/, [{ name: 'actor', value: "Practitioner/".concat(resourceId) }]];
                                }
                                if (!(resourceType === 'HealthcareService')) return [3 /*break*/, 2];
                                return [4 /*yield*/, oystehr.fhir.search({
                                        resourceType: 'HealthcareService',
                                        params: [
                                            {
                                                name: '_id',
                                                value: resourceId,
                                            },
                                            {
                                                name: '_include',
                                                value: 'HealthcareService:location',
                                            },
                                            {
                                                name: '_revinclude',
                                                value: 'PractitionerRole:service',
                                            },
                                            {
                                                name: '_include:iterate',
                                                value: 'PractitionerRole:practitioner',
                                            },
                                        ],
                                    })];
                            case 1:
                                healthcareServiceAndMembers = _a.sent();
                                allResources = healthcareServiceAndMembers.unbundle();
                                healthcareService = allResources.find(function (resource) { return resource.resourceType === 'HealthcareService'; });
                                if (healthcareService && (0, utils_1.scheduleStrategyForHealthcareService)(healthcareService) === utils_1.ScheduleStrategy.owns) {
                                    return [2 /*return*/, [{ name: 'actor', value: "HealthcareService/".concat(resourceId) }]];
                                }
                                locations = allResources.filter(function (resource) { return resource.resourceType === 'Location'; });
                                practitioners = allResources.filter(function (resource) { return resource.resourceType === 'Practitioner'; });
                                locationIdParams = [];
                                practitionerIdParams = [];
                                if (healthcareService) {
                                    scheduleStrategy = (0, utils_1.scheduleStrategyForHealthcareService)(healthcareService);
                                    if (scheduleStrategy === utils_1.ScheduleStrategy.poolsLocations || scheduleStrategy === utils_1.ScheduleStrategy.poolsAll) {
                                        locationIdParams.push.apply(locationIdParams, locations.map(function (location) { return "Location/".concat(location.id); }));
                                    }
                                    if (scheduleStrategy === utils_1.ScheduleStrategy.poolsProviders || scheduleStrategy === utils_1.ScheduleStrategy.poolsAll) {
                                        practitionerIdParams.push.apply(practitionerIdParams, practitioners.map(function (currentPractitioner) { return "Practitioner/".concat(currentPractitioner.id); }));
                                    }
                                    if (scheduleStrategy === utils_1.ScheduleStrategy.poolsLocations) {
                                        return [2 /*return*/, [
                                                {
                                                    name: 'actor',
                                                    value: locationIdParams.join(','),
                                                },
                                            ]];
                                    }
                                    else if (scheduleStrategy === utils_1.ScheduleStrategy.poolsProviders) {
                                        return [2 /*return*/, [
                                                {
                                                    name: 'actor',
                                                    value: practitionerIdParams.join(','),
                                                },
                                            ]];
                                    }
                                    else if (scheduleStrategy === utils_1.ScheduleStrategy.poolsAll) {
                                        return [2 /*return*/, [
                                                {
                                                    name: 'actor',
                                                    value: __spreadArray(__spreadArray([], locationIdParams, true), practitionerIdParams, true).join(','),
                                                },
                                            ]];
                                    }
                                }
                                _a.label = 2;
                            case 2: return [2 /*return*/, []];
                        }
                    });
                }); })()];
            case 1:
                actorParams = _c.sent();
                return [2 /*return*/, {
                        actorParams: actorParams,
                        healthcareService: healthcareService,
                    }];
        }
    });
}); };
var getTimezoneResourceIdFromAppointment = function (appointment) {
    var _a, _b, _c, _d, _e, _f;
    var locationRef = (_b = (_a = appointment.participant.find(function (p) { var _a, _b; return (_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Location/'); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference;
    if (locationRef) {
        return locationRef.split('/')[1];
    }
    var practitionerRef = (_d = (_c = appointment.participant.find(function (p) { var _a, _b; return (_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Practitioner/'); })) === null || _c === void 0 ? void 0 : _c.actor) === null || _d === void 0 ? void 0 : _d.reference;
    if (practitionerRef) {
        return practitionerRef.split('/')[1];
    }
    var healthcareServiceRef = (_f = (_e = appointment.participant.find(function (p) { var _a, _b; return (_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('HealthcareService/'); })) === null || _e === void 0 ? void 0 : _e.actor) === null || _f === void 0 ? void 0 : _f.reference;
    if (healthcareServiceRef) {
        return healthcareServiceRef.split('/')[1];
    }
    return undefined;
};
exports.getTimezoneResourceIdFromAppointment = getTimezoneResourceIdFromAppointment;
var makeEncounterBaseSearchParams = function () { return [
    { name: '_count', value: '1000' },
    { name: '_sort', value: '-date' },
    { name: '_include', value: 'Encounter:appointment' },
    { name: '_include', value: 'Encounter:participant' },
    { name: 'appointment._tag', value: utils_1.OTTEHR_MODULE.IP },
    { name: 'status:not', value: 'planned' },
    { name: 'status:not', value: 'finished' },
    { name: 'status:not', value: 'cancelled' },
]; };
exports.makeEncounterBaseSearchParams = makeEncounterBaseSearchParams;
var makeEncounterSearchParams = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var cachedEncounterIds, timezone, startDay;
    var resourceId = _b.resourceId, resourceType = _b.resourceType, cacheKey = _b.cacheKey, oystehr = _b.oystehr;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                cachedEncounterIds = exports.encounterIdMap.get(cacheKey);
                return [4 /*yield*/, (0, exports.getTimezone)({
                        oystehr: oystehr,
                        resourceType: resourceType,
                        resourceId: resourceId,
                    })];
            case 1:
                timezone = _c.sent();
                startDay = luxon_1.DateTime.now().setZone(timezone).startOf('day').toUTC().toISO();
                if (cachedEncounterIds !== null) {
                    return [2 /*return*/, __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], (0, exports.makeEncounterBaseSearchParams)(), true), [
                            { name: 'appointment.date', value: "lt".concat(startDay) }
                        ], false), (cachedEncounterIds ? [{ name: '_id', value: cachedEncounterIds }] : []), true), (resourceType === 'Location' ? [{ name: 'appointment.location', value: "Location/".concat(resourceId) }] : []), true), (resourceType === 'Practitioner' ? [{ name: 'appointment.actor', value: "Practitioner/".concat(resourceId) }] : []), true), (resourceType === 'HealthcareService'
                            ? [{ name: 'appointment.actor', value: "HealthcareService/".concat(resourceId) }]
                            : []), true)];
                }
                return [2 /*return*/, null];
        }
    });
}); };
exports.makeEncounterSearchParams = makeEncounterSearchParams;
