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
exports.createEncounterResource = createEncounterResource;
exports.updateEncounterResource = updateEncounterResource;
var utils_1 = require("utils");
function createEncounterResource(encounterDetails, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var encounterResource, encounterParticipant;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    encounterResource = {
                        resourceType: 'Encounter',
                        class: {
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                            code: 'VR',
                            display: 'virtual', // todo not sure if this type is applicable to non-billable
                        },
                        subject: {
                            reference: "Patient/".concat(encounterDetails.patientId),
                        },
                        status: encounterDetails.resolved ? 'finished' : 'in-progress',
                        period: {
                            start: encounterDetails.start,
                            end: encounterDetails === null || encounterDetails === void 0 ? void 0 : encounterDetails.end,
                        },
                        type: createEncounterType(encounterDetails.followupType),
                    };
                    if (encounterDetails.location) {
                        encounterResource.location = [
                            {
                                location: { reference: "Location/".concat(encounterDetails.location.id) },
                            },
                        ];
                    }
                    if (encounterDetails.reason) {
                        encounterResource.reasonCode = createEncounterReasonCode(encounterDetails.reason, encounterDetails.otherReason);
                    }
                    if (encounterDetails.initialEncounterID) {
                        encounterResource.partOf = {
                            reference: "Encounter/".concat(encounterDetails.initialEncounterID),
                        };
                    }
                    if (encounterDetails.appointmentId) {
                        encounterResource.appointment = [
                            {
                                reference: "Appointment/".concat(encounterDetails.appointmentId),
                            },
                        ];
                    }
                    encounterParticipant = [];
                    if (encounterDetails.answered) {
                        encounterParticipant.push(createEncounterParticipant(utils_1.FOLLOWUP_SYSTEMS.answeredUrl, encounterDetails.answered));
                    }
                    if (encounterDetails.caller) {
                        encounterParticipant.push(createEncounterParticipant(utils_1.FOLLOWUP_SYSTEMS.callerUrl, encounterDetails.caller));
                    }
                    if (encounterDetails.provider) {
                        encounterParticipant.push(createEncounterParticipantIndividual(utils_1.PRACTITIONER_CODINGS.Attender, {
                            type: 'Practitioner',
                            reference: "Practitioner/".concat(encounterDetails.provider.practitionerId),
                        }));
                    }
                    if (encounterParticipant.length)
                        encounterResource.participant = encounterParticipant;
                    if (encounterDetails.message) {
                        encounterResource.extension = [
                            {
                                url: utils_1.FOLLOWUP_SYSTEMS.messageUrl,
                                valueString: encounterDetails.message,
                            },
                        ];
                    }
                    return [4 /*yield*/, oystehr.fhir.create(encounterResource)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function updateEncounterResource(encounterId, encounterDetails, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var fhirResources, curFhirEncounter, curFhirLocation, patientId, curEncounterDetails, operations, locationId, messageIdx, messageExtVal, participantOp, callerParticipant, providerParticipant;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0: return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: '_id',
                                value: encounterId,
                            },
                            {
                                name: '_include',
                                value: 'Encounter:location',
                            },
                        ],
                    })];
                case 1:
                    fhirResources = (_q.sent()).unbundle();
                    curFhirEncounter = fhirResources.find(function (resource) { return resource.resourceType === 'Encounter'; });
                    curFhirLocation = fhirResources.find(function (resource) { return resource.resourceType === 'Location'; });
                    patientId = (_b = (_a = curFhirEncounter === null || curFhirEncounter === void 0 ? void 0 : curFhirEncounter.subject) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')[1];
                    if (!curFhirEncounter || !patientId)
                        throw new Error('Could not find the encounter or patient id when updating the follow up encounter');
                    curEncounterDetails = (0, utils_1.formatFhirEncounterToPatientFollowupDetails)(curFhirEncounter, patientId, curFhirLocation);
                    console.log('current encounter details', curEncounterDetails);
                    operations = [];
                    // if the encounter has been marked resolved, add an end time and update the status to finished
                    if (encounterDetails.end) {
                        operations.push({
                            op: 'add',
                            path: '/period/end',
                            value: encounterDetails === null || encounterDetails === void 0 ? void 0 : encounterDetails.end,
                        }, {
                            op: 'replace',
                            path: '/status',
                            value: 'finished',
                        });
                    }
                    // check for deltas
                    // answered & date/time are read only after initial save so they should never be updated
                    // followupType is required, it will only ever be replaced
                    if (encounterDetails.followupType !== curEncounterDetails.followupType) {
                        operations.push({
                            op: 'replace',
                            path: '/type',
                            value: createEncounterType(encounterDetails.followupType),
                        });
                    }
                    if (encounterDetails.reason !== curEncounterDetails.reason ||
                        encounterDetails.otherReason !== curEncounterDetails.otherReason) {
                        if (encounterDetails.reason) {
                            operations.push({
                                op: "".concat(curEncounterDetails.reason ? 'replace' : 'add'),
                                path: '/reasonCode',
                                value: createEncounterReasonCode(encounterDetails.reason, encounterDetails.otherReason),
                            });
                        }
                        else if (curEncounterDetails.reason) {
                            operations.push({
                                op: 'remove',
                                path: '/reasonCode',
                            });
                        }
                    }
                    locationId = (_c = encounterDetails === null || encounterDetails === void 0 ? void 0 : encounterDetails.location) === null || _c === void 0 ? void 0 : _c.id;
                    if (locationId !== ((_d = curEncounterDetails === null || curEncounterDetails === void 0 ? void 0 : curEncounterDetails.location) === null || _d === void 0 ? void 0 : _d.id)) {
                        // location is updating or being added
                        if (locationId) {
                            operations.push({
                                op: ((_e = curEncounterDetails === null || curEncounterDetails === void 0 ? void 0 : curEncounterDetails.location) === null || _e === void 0 ? void 0 : _e.id) ? 'replace' : 'add',
                                path: '/location',
                                value: [
                                    {
                                        location: {
                                            reference: "Location/".concat(locationId),
                                        },
                                    },
                                ],
                            });
                        }
                        else if ((_f = curEncounterDetails === null || curEncounterDetails === void 0 ? void 0 : curEncounterDetails.location) === null || _f === void 0 ? void 0 : _f.id) {
                            // location is being removed
                            operations.push({
                                op: 'remove',
                                path: '/location',
                            });
                        }
                    }
                    if (encounterDetails.message !== curEncounterDetails.message) {
                        // message is being updated
                        if (encounterDetails.message && curEncounterDetails.message && curFhirEncounter.extension) {
                            messageIdx = curFhirEncounter.extension.findIndex(function (ext) { return ext.url === utils_1.FOLLOWUP_SYSTEMS.messageUrl; });
                            operations.push({
                                op: 'replace',
                                path: "/extension/".concat(messageIdx, "/valueString"),
                                value: encounterDetails.message,
                            });
                        }
                        // message is being added
                        if (encounterDetails.message && !curEncounterDetails.message) {
                            messageExtVal = {
                                url: utils_1.FOLLOWUP_SYSTEMS.messageUrl,
                                valueString: encounterDetails.message,
                            };
                            // either being added to an exiting extension array
                            // or is the first value in the array
                            operations.push({
                                op: 'add',
                                path: "/extension".concat(curFhirEncounter.extension ? '/-' : ''),
                                value: curFhirEncounter.extension ? messageExtVal : [messageExtVal],
                            });
                        }
                        // message is being removed
                        if (!encounterDetails.message && curEncounterDetails.message && curFhirEncounter.extension) {
                            curFhirEncounter.extension = curFhirEncounter.extension.filter(function (ext) { return ext.url !== utils_1.FOLLOWUP_SYSTEMS.messageUrl; });
                            operations.push({
                                op: 'replace',
                                path: '/extension',
                                value: curFhirEncounter.extension,
                            });
                        }
                    }
                    participantOp = undefined;
                    if (encounterDetails.caller !== curEncounterDetails.caller) {
                        // caller is being updated
                        if (encounterDetails.caller && curEncounterDetails.caller && (curFhirEncounter === null || curFhirEncounter === void 0 ? void 0 : curFhirEncounter.participant)) {
                            participantOp = 'replace';
                            curFhirEncounter.participant = updateParticipant(curFhirEncounter.participant, utils_1.FOLLOWUP_SYSTEMS.callerUrl, encounterDetails.caller);
                        }
                        // caller is being added
                        if (encounterDetails.caller && !curEncounterDetails.caller) {
                            callerParticipant = createEncounterParticipant(utils_1.FOLLOWUP_SYSTEMS.callerUrl, encounterDetails.caller);
                            // either being added to an exiting participant array
                            if (curFhirEncounter.participant) {
                                participantOp = 'replace';
                                curFhirEncounter.participant.push(callerParticipant);
                            }
                            else {
                                // or is the first val in the participant array
                                participantOp = 'add';
                                curFhirEncounter.participant = [callerParticipant];
                            }
                        }
                        // caller is being removed
                        if (!encounterDetails.caller && curEncounterDetails.caller && curFhirEncounter.participant) {
                            curFhirEncounter.participant = updateParticipant(curFhirEncounter.participant, utils_1.FOLLOWUP_SYSTEMS.callerUrl);
                            participantOp = curFhirEncounter.participant.length ? 'replace' : 'remove';
                        }
                    }
                    if (((_g = encounterDetails === null || encounterDetails === void 0 ? void 0 : encounterDetails.provider) === null || _g === void 0 ? void 0 : _g.practitionerId) !== ((_h = curEncounterDetails === null || curEncounterDetails === void 0 ? void 0 : curEncounterDetails.provider) === null || _h === void 0 ? void 0 : _h.practitionerId)) {
                        // provider is updating
                        if (((_j = encounterDetails === null || encounterDetails === void 0 ? void 0 : encounterDetails.provider) === null || _j === void 0 ? void 0 : _j.practitionerId) &&
                            ((_k = curEncounterDetails === null || curEncounterDetails === void 0 ? void 0 : curEncounterDetails.provider) === null || _k === void 0 ? void 0 : _k.practitionerId) &&
                            (curFhirEncounter === null || curFhirEncounter === void 0 ? void 0 : curFhirEncounter.participant)) {
                            participantOp = 'replace';
                            curFhirEncounter.participant = updateParticipant(curFhirEncounter.participant, utils_1.FOLLOWUP_SYSTEMS.providerUrl, encounterDetails.provider.name, {
                                type: 'Practitioner',
                                reference: "Practitioner/".concat(encounterDetails.provider.practitionerId),
                            });
                        }
                        // provider is being added
                        if (((_l = encounterDetails === null || encounterDetails === void 0 ? void 0 : encounterDetails.provider) === null || _l === void 0 ? void 0 : _l.practitionerId) && !((_m = curEncounterDetails === null || curEncounterDetails === void 0 ? void 0 : curEncounterDetails.provider) === null || _m === void 0 ? void 0 : _m.practitionerId)) {
                            providerParticipant = createEncounterParticipantIndividual(utils_1.PRACTITIONER_CODINGS.Attender, {
                                type: 'Practitioner',
                                reference: "Practitioner/".concat(encounterDetails.provider.practitionerId),
                            });
                            // either being added to an exiting participant array
                            if (curFhirEncounter.participant) {
                                participantOp = 'replace';
                                curFhirEncounter.participant.push(providerParticipant);
                            }
                            else {
                                // or is the first val in the participant array
                                participantOp = 'add';
                                curFhirEncounter.participant = [providerParticipant];
                            }
                        }
                        // provider is being removed
                        if (!((_o = encounterDetails === null || encounterDetails === void 0 ? void 0 : encounterDetails.provider) === null || _o === void 0 ? void 0 : _o.practitionerId) &&
                            ((_p = curEncounterDetails === null || curEncounterDetails === void 0 ? void 0 : curEncounterDetails.provider) === null || _p === void 0 ? void 0 : _p.practitionerId) &&
                            curFhirEncounter.participant) {
                            curFhirEncounter.participant = updateParticipant(curFhirEncounter.participant, utils_1.FOLLOWUP_SYSTEMS.providerUrl);
                            participantOp = curFhirEncounter.participant.length ? 'replace' : 'remove';
                        }
                    }
                    if (participantOp === 'add' || participantOp === 'replace') {
                        console.log('updating participant to', JSON.stringify(curFhirEncounter.participant));
                        operations.push({
                            op: participantOp,
                            path: '/participant',
                            value: curFhirEncounter.participant,
                        });
                    }
                    else if (participantOp === 'remove') {
                        console.log('removing participant');
                        operations.push({
                            op: participantOp,
                            path: '/participant',
                        });
                    }
                    if (!operations.length) return [3 /*break*/, 3];
                    return [4 /*yield*/, oystehr.fhir.patch({
                            id: encounterId,
                            resourceType: 'Encounter',
                            operations: operations,
                        })];
                case 2: return [2 /*return*/, _q.sent()];
                case 3:
                    console.log('nothing was updated for this follow up encounter');
                    return [2 /*return*/, curFhirEncounter];
            }
        });
    });
}
var createEncounterType = function (type) {
    return [
        {
            coding: [
                {
                    system: utils_1.FOLLOWUP_SYSTEMS.type.url,
                    code: utils_1.FOLLOWUP_SYSTEMS.type.code,
                    display: type,
                },
            ],
            text: type,
        },
    ];
};
var createEncounterReasonCode = function (reason, otherReason) {
    return [
        {
            coding: [
                {
                    system: utils_1.FOLLOWUP_SYSTEMS.reasonUrl,
                    display: reason,
                },
            ],
            text: otherReason || reason,
        },
    ];
};
var createEncounterParticipant = function (system, display) {
    var participant = {
        type: [
            {
                coding: [
                    {
                        system: system,
                        display: display,
                    },
                ],
            },
        ],
    };
    return participant;
};
var createEncounterParticipantIndividual = function (coding, individual) {
    var participant = {
        type: [
            {
                coding: coding,
            },
        ],
        individual: individual,
    };
    return participant;
};
var updateParticipant = function (participants, system, updatedValue, individual) {
    return participants
        .map(function (participant) {
        var _a;
        (_a = participant === null || participant === void 0 ? void 0 : participant.type) === null || _a === void 0 ? void 0 : _a.forEach(function (type) {
            var _a;
            (_a = type === null || type === void 0 ? void 0 : type.coding) === null || _a === void 0 ? void 0 : _a.forEach(function (coding) {
                var _a;
                if (coding.system === system) {
                    if (updatedValue === undefined) {
                        type.coding = (_a = type === null || type === void 0 ? void 0 : type.coding) === null || _a === void 0 ? void 0 : _a.filter(function (c) { return c.system !== system; });
                    }
                    else if (coding.display !== updatedValue) {
                        coding.display = updatedValue;
                        if (individual)
                            participant.individual = individual;
                    }
                }
            });
        });
        return participant;
    })
        .filter(function (p) { var _a; return (_a = p === null || p === void 0 ? void 0 : p.type) === null || _a === void 0 ? void 0 : _a.every(function (t) { return (t === null || t === void 0 ? void 0 : t.coding) && t.coding.length > 0; }); });
};
