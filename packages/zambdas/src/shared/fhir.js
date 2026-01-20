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
exports.getPatientResource = getPatientResource;
exports.getSchedules = getSchedules;
exports.updatePatientResource = updatePatientResource;
exports.updateAppointmentTime = updateAppointmentTime;
exports.searchInvitedParticipantResourcesByEncounterId = searchInvitedParticipantResourcesByEncounterId;
var short_uuid_1 = require("short-uuid");
var utils_1 = require("utils");
function getPatientResource(patientID, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.get({
                        resourceType: 'Patient',
                        id: patientID !== null && patientID !== void 0 ? patientID : '',
                    })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response];
            }
        });
    });
}
function getSchedules(oystehr, scheduleType, slug) {
    return __awaiter(this, void 0, void 0, function () {
        var fhirType, searchParams, resourceType, scheduleResources, scheduleOwner, hsSchedulingStrategy, schedule, practitioners, schedules, locations, scheduleList, practitioners_1, schedules_1, locations_1, schedules_2, matchingSchedules;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fhirType = (function () {
                        if (scheduleType === 'location') {
                            return 'Location';
                        }
                        if (scheduleType === 'provider') {
                            return 'Practitioner';
                        }
                        return 'HealthcareService';
                    })();
                    searchParams = [
                        { name: 'identifier', value: "".concat(utils_1.SLUG_SYSTEM, "|").concat(slug) },
                        { name: '_revinclude', value: "Schedule:actor:".concat(fhirType) },
                    ];
                    if (scheduleType === 'location') {
                        resourceType = 'Location';
                    }
                    else if (scheduleType === 'provider') {
                        resourceType = 'Practitioner';
                    }
                    else if (scheduleType === 'group') {
                        resourceType = 'HealthcareService';
                    }
                    else {
                        throw new Error('resourceType is not expected');
                    }
                    if (scheduleType === 'group') {
                        searchParams.push({
                            name: '_include',
                            value: 'HealthcareService:location',
                        }, {
                            name: '_revinclude',
                            value: 'PractitionerRole:service',
                        }, {
                            name: '_include:iterate',
                            value: 'PractitionerRole:practitioner',
                        }, {
                            name: '_revinclude:iterate',
                            value: 'HealthcareService:location',
                        }, {
                            name: '_include:iterate',
                            value: 'PractitionerRole:service',
                        }, { name: '_revinclude:iterate', value: 'Schedule:actor:Practitioner' }, { name: '_revinclude:iterate', value: 'Schedule:actor:Location' });
                    }
                    console.log('searching for resource with search params: ', searchParams);
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: resourceType,
                            params: searchParams,
                        })];
                case 1:
                    scheduleResources = (_a.sent()).unbundle();
                    scheduleOwner = scheduleResources.find(function (res) {
                        return res.resourceType === fhirType && (0, utils_1.checkResourceHasSlug)(res, slug);
                    });
                    if ((scheduleOwner === null || scheduleOwner === void 0 ? void 0 : scheduleOwner.resourceType) === 'HealthcareService') {
                        hsSchedulingStrategy = (0, utils_1.scheduleStrategyForHealthcareService)(scheduleOwner);
                    }
                    if (hsSchedulingStrategy === undefined && (scheduleOwner === null || scheduleOwner === void 0 ? void 0 : scheduleOwner.resourceType) === 'HealthcareService') {
                        throw (0, utils_1.MISCONFIGURED_SCHEDULING_GROUP)("HealthcareService/".concat(scheduleOwner === null || scheduleOwner === void 0 ? void 0 : scheduleOwner.id, " needs to be configured with a scheduling strategy in order to be used as a schedule provider."));
                    }
                    if (scheduleOwner === undefined) {
                        throw utils_1.SCHEDULE_NOT_FOUND_ERROR;
                    }
                    if (scheduleResources.length === 0) {
                        console.log("schedule for ".concat(fhirType, " with identifier \"").concat(slug, "\" was not found"));
                        throw utils_1.SCHEDULE_NOT_FOUND_ERROR;
                    }
                    schedule = scheduleResources.find(function (res) {
                        var _a, _b;
                        return res.resourceType === 'Schedule' && ((_b = (_a = res.actor) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === "".concat(fhirType, "/").concat(scheduleOwner.id);
                    });
                    //const schedule: Location | Practitioner | HealthcareService = scheduleResources[0];
                    if (!(schedule === null || schedule === void 0 ? void 0 : schedule.id) && (hsSchedulingStrategy === undefined || hsSchedulingStrategy === utils_1.ScheduleStrategy.owns)) {
                        throw (0, utils_1.SCHEDULE_NOT_FOUND_CUSTOM_ERROR)("No Schedule associated with ".concat(fhirType, " with identifier \"").concat(slug, "\" could be found. To cure this, create a Schedule resource referencing this ").concat(fhirType, " resource via its \"actor\" field and give it an extension with the requisite schedule extension json."));
                    }
                    practitioners = [];
                    schedules = [];
                    locations = [];
                    scheduleResources.forEach(function (res) {
                        if (res.resourceType === 'Practitioner') {
                            practitioners.push(res);
                        }
                        if (res.resourceType === 'Schedule') {
                            schedules.push(res);
                        }
                        if (res.resourceType === 'Location') {
                            locations.push(res);
                        }
                    });
                    scheduleList = [];
                    if (hsSchedulingStrategy === utils_1.ScheduleStrategy.poolsAll || hsSchedulingStrategy === utils_1.ScheduleStrategy.poolsProviders) {
                        practitioners_1 = [];
                        schedules_1 = [];
                        scheduleResources.forEach(function (res) {
                            if (res.resourceType === 'Practitioner') {
                                practitioners_1.push(res);
                            }
                            if (res.resourceType === 'Schedule') {
                                schedules_1.push(res);
                            }
                        });
                        schedules_1.forEach(function (scheduleObj) {
                            var _a, _b;
                            var owner = (_b = (_a = scheduleObj.actor[0]) === null || _a === void 0 ? void 0 : _a.reference) !== null && _b !== void 0 ? _b : '';
                            var _c = owner.split('/'), ownerResourceType = _c[0], ownerId = _c[1];
                            if (ownerResourceType === 'Practitioner' && ownerId) {
                                var practitioner = practitioners_1.find(function (practitionerObj) {
                                    return practitionerObj.id === ownerId;
                                });
                                if (practitioner) {
                                    scheduleList.push({
                                        schedule: scheduleObj,
                                        owner: practitioner,
                                    });
                                }
                            }
                        });
                    }
                    // todo: there's clearly a generic func to be extracted here...
                    if (hsSchedulingStrategy === utils_1.ScheduleStrategy.poolsAll || hsSchedulingStrategy === utils_1.ScheduleStrategy.poolsLocations) {
                        locations_1 = [];
                        schedules_2 = [];
                        scheduleResources.forEach(function (res) {
                            if (res.resourceType === 'Location') {
                                locations_1.push(res);
                            }
                            if (res.resourceType === 'Schedule') {
                                schedules_2.push(res);
                            }
                        });
                        schedules_2.forEach(function (scheduleObj) {
                            var _a, _b;
                            var owner = (_b = (_a = scheduleObj.actor[0]) === null || _a === void 0 ? void 0 : _a.reference) !== null && _b !== void 0 ? _b : '';
                            var _c = owner.split('/'), ownerResourceType = _c[0], ownerId = _c[1];
                            if (ownerResourceType === 'Location' && ownerId) {
                                var location_1 = locations_1.find(function (loc) {
                                    return loc.id === ownerId;
                                });
                                if (location_1) {
                                    scheduleList.push({
                                        schedule: scheduleObj,
                                        owner: location_1,
                                    });
                                }
                            }
                        });
                    }
                    if (hsSchedulingStrategy === undefined || hsSchedulingStrategy === utils_1.ScheduleStrategy.owns) {
                        matchingSchedules = schedules.filter(function (res) {
                            var _a, _b;
                            return ((_b = (_a = res.actor) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === "".concat(scheduleOwner.resourceType, "/").concat(scheduleOwner.id);
                        });
                        scheduleList.push.apply(scheduleList, matchingSchedules.map(function (scheduleObj) { return ({ schedule: scheduleObj, owner: scheduleOwner }); }));
                    }
                    return [2 /*return*/, {
                            metadata: {
                                type: scheduleType,
                                strategy: hsSchedulingStrategy,
                            },
                            scheduleList: scheduleList,
                            rootScheduleOwner: scheduleOwner, // this probable isn't needed. just the ref can go in metadata
                        }];
            }
        });
    });
}
function updatePatientResource(patientId, patchOperations, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: 'Patient',
                            id: patientId,
                            operations: patchOperations,
                        })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response];
                case 2:
                    error_1 = _a.sent();
                    throw new Error("Failed to update Patient: ".concat(JSON.stringify(error_1)));
                case 3: return [2 /*return*/];
            }
        });
    });
}
// todo maybe refactor use case to use patchAppt instead and get rid of this and rename above
function updateAppointmentTime(appointment, startTime, endTime, oystehr, slot) {
    return __awaiter(this, void 0, void 0, function () {
        var currentSlotRef, newSlotReference, patchSlotRequests, deleteSlotRequests, postSlotRequests, currenSlotId, slotRefOps, patchRequest, json, flattened, apt, error_2;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, , 3]);
                    currentSlotRef = (_b = (_a = appointment === null || appointment === void 0 ? void 0 : appointment.slot) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference;
                    newSlotReference = void 0;
                    patchSlotRequests = [];
                    deleteSlotRequests = [];
                    postSlotRequests = [];
                    if (slot && "Slot/".concat(slot.id) !== currentSlotRef) {
                        // we need to update the Appointment with the passed in Slot
                        if ((0, utils_1.isValidUUID)((_c = slot === null || slot === void 0 ? void 0 : slot.id) !== null && _c !== void 0 ? _c : '') && (slot === null || slot === void 0 ? void 0 : slot.meta) !== undefined) {
                            // assume slot already persisted
                            newSlotReference = {
                                reference: "Slot/".concat(slot.id),
                            };
                            patchSlotRequests.push({
                                method: 'PATCH',
                                url: "Slot/".concat(slot.id),
                                operations: [
                                    {
                                        op: 'replace',
                                        path: '/status',
                                        value: 'busy',
                                    },
                                ],
                            });
                            currenSlotId = currentSlotRef === null || currentSlotRef === void 0 ? void 0 : currentSlotRef.split('/')[1];
                            if (currenSlotId) {
                                deleteSlotRequests.push({
                                    method: 'DELETE',
                                    url: "Slot/".concat(currentSlotRef === null || currentSlotRef === void 0 ? void 0 : currentSlotRef.split('/')[1]),
                                });
                            }
                        }
                        else if (slot) {
                            postSlotRequests.push({
                                method: 'POST',
                                url: '/Slot',
                                resource: __assign(__assign({}, slot), { resourceType: 'Slot', id: undefined, status: 'busy' }),
                                fullUrl: "urn:uuid:".concat((0, short_uuid_1.uuid)()),
                            });
                            newSlotReference = {
                                reference: postSlotRequests[0].fullUrl,
                            };
                        }
                    }
                    slotRefOps = [];
                    if (newSlotReference) {
                        slotRefOps.push({
                            op: appointment.slot === undefined ? 'add' : 'replace',
                            path: '/slot',
                            value: [newSlotReference],
                        });
                    }
                    patchRequest = {
                        method: 'PATCH',
                        url: "Appointment/".concat(appointment.id),
                        operations: __spreadArray([
                            {
                                op: 'replace',
                                path: '/start',
                                value: startTime,
                            },
                            {
                                op: 'replace',
                                path: '/end',
                                value: endTime,
                            }
                        ], slotRefOps, true),
                    };
                    return [4 /*yield*/, oystehr.fhir.transaction({
                            requests: __spreadArray(__spreadArray(__spreadArray(__spreadArray([], postSlotRequests, true), [patchRequest], false), patchSlotRequests, true), deleteSlotRequests, true),
                        })];
                case 1:
                    json = _d.sent();
                    flattened = (0, utils_1.unbundleBatchPostOutput)(json);
                    apt = flattened.find(function (res) { return res.resourceType === 'Appointment'; });
                    if (!apt) {
                        throw new Error('Appointment not returned in bundle');
                    }
                    return [2 /*return*/, apt];
                case 2:
                    error_2 = _d.sent();
                    throw new Error("Failed to update Appointment: ".concat(JSON.stringify(error_2)));
                case 3: return [2 /*return*/];
            }
        });
    });
}
function searchInvitedParticipantResourcesByEncounterId(encounterId, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var allResources, relatedPersons;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: '_id',
                                value: encounterId,
                            },
                            {
                                name: '_include',
                                value: 'Encounter:participant',
                            },
                        ],
                    })];
                case 1:
                    allResources = (_a.sent()).unbundle();
                    relatedPersons = allResources.filter(function (r) { return r.resourceType === 'RelatedPerson'; });
                    return [2 /*return*/, relatedPersons.filter(function (r) { var _a, _b; return ((_b = (_a = r.relationship) === null || _a === void 0 ? void 0 : _a[0].coding) === null || _b === void 0 ? void 0 : _b[0].code) === 'WIT'; })];
            }
        });
    });
}
