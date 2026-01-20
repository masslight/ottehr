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
exports.assignPractitionerIfPossible = void 0;
var utils_1 = require("utils");
var assignPractitionerIfPossible = function (oystehr, encounter, appointment, practitionerId, userRole, user) { return __awaiter(void 0, void 0, void 0, function () {
    var patchRequests, _a, visitStatus, isAttender;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!encounter.id || !practitionerId) {
                    throw new Error('Invalid Encounter or Practitioner ID');
                }
                console.log('assigning practitioner: ', practitionerId);
                _a = utils_1.getPatchBinary;
                _b = {
                    resourceType: 'Encounter',
                    resourceId: encounter.id
                };
                return [4 /*yield*/, getAssignPractitionerToEncounterOperation(encounter, practitionerId, userRole)];
            case 1:
                patchRequests = [
                    _a.apply(void 0, [(_b.patchOperations = _c.sent(),
                            _b)])
                ];
                visitStatus = (0, utils_1.getInPersonVisitStatus)(appointment, encounter);
                console.log('current visitStatus: ', visitStatus);
                // i believe the only time this will get hit is if the user does not assign a provider before clicking "complete intake"
                // but since there is no logic to prevent not assigning the provider before clicking "complete intake" this is the only way to record the status update
                if (visitStatus === 'ready for provider' && appointment.id) {
                    console.log('a provider is being assigned to an appointment in the status', visitStatus);
                    console.log('with user role: ', userRole);
                    isAttender = userRole[0].code === utils_1.PRACTITIONER_CODINGS.Attender[0].code;
                    if (isAttender) {
                        console.log('and isAttender therefore will add status update tags for provider status');
                        patchRequests.push((0, utils_1.getPatchBinary)({
                            resourceType: 'Appointment',
                            resourceId: appointment.id,
                            patchOperations: (0, utils_1.getAppointmentMetaTagOpForStatusUpdate)(appointment, 'provider', { user: user }),
                        }));
                    }
                }
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: patchRequests,
                    })];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.assignPractitionerIfPossible = assignPractitionerIfPossible;
var getAssignPractitionerToEncounterOperation = function (encounter, practitionerId, userRole) { return __awaiter(void 0, void 0, void 0, function () {
    var now, participants, individualReference, newParticipant, participantsExcludingThoseWithRoleWeAreTaking;
    return __generator(this, function (_a) {
        now = new Date().toISOString();
        participants = encounter.participant;
        individualReference = "Practitioner/".concat(practitionerId);
        newParticipant = {
            individual: { reference: individualReference },
            // if it's an attender, we don't need to set the period start, because it will be set on changing status
            // to provider
            period: userRole.some(function (role) { return role.code === utils_1.PRACTITIONER_CODINGS.Attender[0].code; }) ? undefined : { start: now },
            type: [{ coding: userRole }],
        };
        // Empty participants case, 'add' operation.
        if (!participants || participants.length === 0) {
            return [2 /*return*/, [
                    {
                        op: 'add',
                        path: '/participant',
                        value: [newParticipant],
                    },
                ]];
        }
        participantsExcludingThoseWithRoleWeAreTaking = participants === null || participants === void 0 ? void 0 : participants.filter(function (participant) {
            var _a;
            return (_a = participant.type) === null || _a === void 0 ? void 0 : _a.some(function (type) {
                var _a;
                return (_a = type.coding) === null || _a === void 0 ? void 0 : _a.some(function (coding) { return coding.code !== userRole[0].code; });
            });
        });
        return [2 /*return*/, [
                {
                    op: 'replace',
                    path: "/participant",
                    value: __spreadArray(__spreadArray([], participantsExcludingThoseWithRoleWeAreTaking, true), [newParticipant], false),
                },
            ]];
    });
}); };
