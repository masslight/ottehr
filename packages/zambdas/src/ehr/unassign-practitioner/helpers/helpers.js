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
exports.unassignParticipantIfPossible = void 0;
var utils_1 = require("utils");
var unassignParticipantIfPossible = function (oystehr, resourcesToUpdate, practitionerId, userRole, practitionerRole) { return __awaiter(void 0, void 0, void 0, function () {
    var encounterPatchOp, unassignPractitionerOp;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!((_a = resourcesToUpdate.encounter) === null || _a === void 0 ? void 0 : _a.id) || !practitionerId) {
                    throw new Error('Invalid Encounter or Practitioner ID');
                }
                encounterPatchOp = [];
                return [4 /*yield*/, getUnassignParticipantToEncounterOperation(resourcesToUpdate.encounter, practitionerId, userRole, practitionerRole)];
            case 1:
                unassignPractitionerOp = _b.sent();
                if (unassignPractitionerOp) {
                    encounterPatchOp.push.apply(encounterPatchOp, unassignPractitionerOp);
                }
                if (!(encounterPatchOp.length > 0)) return [3 /*break*/, 3];
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: [
                            (0, utils_1.getPatchBinary)({
                                resourceType: 'Encounter',
                                resourceId: resourcesToUpdate.encounter.id,
                                patchOperations: encounterPatchOp,
                            }),
                        ],
                    })];
            case 2:
                _b.sent();
                _b.label = 3;
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.unassignParticipantIfPossible = unassignParticipantIfPossible;
var getUnassignParticipantToEncounterOperation = function (encounter, practitionerId, userRole, practitionerRole) { return __awaiter(void 0, void 0, void 0, function () {
    var now, participants, individualReference, matchParticipant, startOnlyIndex, startAndEndIndex;
    return __generator(this, function (_a) {
        now = new Date().toISOString();
        participants = encounter.participant;
        individualReference = practitionerRole
            ? "PractitionerRole/".concat(practitionerRole.id)
            : "Practitioner/".concat(practitionerId);
        if (!participants || participants.length === 0) {
            return [2 /*return*/, [
                    {
                        op: 'add',
                        path: '/participant',
                        value: [
                            {
                                individual: { reference: individualReference },
                                period: { start: now, end: now },
                                type: [{ coding: userRole }],
                            },
                        ],
                    },
                ]];
        }
        matchParticipant = function (participant, hasEnd) {
            var _a, _b, _c, _d, _e, _f, _g;
            var matchIndividualReference = ((_a = participant.individual) === null || _a === void 0 ? void 0 : _a.reference) === individualReference;
            var matchUserRole = Array.isArray(userRole)
                ? (_b = participant.type) === null || _b === void 0 ? void 0 : _b.some(function (type) {
                    var _a;
                    return (_a = type.coding) === null || _a === void 0 ? void 0 : _a.some(function (coding) {
                        return userRole.some(function (role) { return role.code === coding.code || role.display === coding.display; });
                    });
                })
                : (_c = participant.type) === null || _c === void 0 ? void 0 : _c.some(function (type) { var _a; return (_a = type.coding) === null || _a === void 0 ? void 0 : _a.some(function (coding) { return coding === userRole; }); });
            var hasStartCondition = hasEnd
                ? ((_d = participant.period) === null || _d === void 0 ? void 0 : _d.start) && ((_e = participant.period) === null || _e === void 0 ? void 0 : _e.end)
                : ((_f = participant.period) === null || _f === void 0 ? void 0 : _f.start) && !((_g = participant.period) === null || _g === void 0 ? void 0 : _g.end);
            return matchIndividualReference && matchUserRole && hasStartCondition;
        };
        startOnlyIndex = participants.findIndex(function (p) { return matchParticipant(p, false); });
        startAndEndIndex = participants.findIndex(function (p) { return matchParticipant(p, true); });
        if (startOnlyIndex !== -1) {
            return [2 /*return*/, [
                    {
                        op: 'add',
                        path: "/participant/".concat(startOnlyIndex, "/period/end"),
                        value: now,
                    },
                ]];
        }
        if (startAndEndIndex !== -1) {
            return [2 /*return*/, []];
        }
        return [2 /*return*/, [
                {
                    op: 'add',
                    path: "/participant/".concat(participants.length),
                    value: {
                        individual: { reference: individualReference },
                        period: { start: now, end: now },
                        type: [{ coding: userRole }],
                    },
                },
            ]];
    });
}); };
