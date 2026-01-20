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
var get_video_resources_1 = require("../../../shared/pdf/visit-details-pdf/get-video-resources");
var validateRequestParameters_1 = require("../validateRequestParameters");
var oystehrToken;
var oystehr;
var taskId;
var ZAMBDA_NAME = 'sub-send-claim';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, task, secrets, appointmentId, visitResources, encounter, existingCandidEncounterId, candidEncounterId, encounterPatchOps, identifier, patchedTask, response, error_1, ENVIRONMENT, patchError_1;
    var _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _f.trys.push([0, 10, , 16]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                task = validatedParameters.task, secrets = validatedParameters.secrets;
                console.log('task ID', task.id);
                if (!task.id) {
                    throw new Error('Task ID is required');
                }
                taskId = task.id;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!!oystehrToken) return [3 /*break*/, 2];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
            case 1:
                oystehrToken = _f.sent();
                return [3 /*break*/, 3];
            case 2:
                console.log('already have token');
                _f.label = 3;
            case 3:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, secrets);
                console.log('getting appointment Id from the task');
                appointmentId = ((_a = task.focus) === null || _a === void 0 ? void 0 : _a.type) === 'Appointment' ? (_c = (_b = task.focus) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('Appointment/', '') : undefined;
                console.log('appointment ID parsed: ', appointmentId);
                if (!appointmentId) {
                    console.log('no appointment ID found on task');
                    throw new Error('no appointment ID found on task focus');
                }
                return [4 /*yield*/, (0, get_video_resources_1.getAppointmentAndRelatedResources)(oystehr, appointmentId, true)];
            case 4:
                visitResources = _f.sent();
                if (!visitResources) {
                    {
                        throw new Error("Visit resources are not properly defined for appointment ".concat(appointmentId));
                    }
                }
                encounter = visitResources.encounter;
                existingCandidEncounterId = (_e = (_d = encounter.identifier) === null || _d === void 0 ? void 0 : _d.find(function (identifier) { return identifier.system === shared_1.CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM; })) === null || _e === void 0 ? void 0 : _e.value;
                if (!existingCandidEncounterId) return [3 /*break*/, 5];
                console.log("[CLAIM SUBMISSION] Candid encounter already exists with ID ".concat(existingCandidEncounterId, ", skipping creation"));
                return [3 /*break*/, 8];
            case 5:
                console.log('[CLAIM SUBMISSION] Attempting to create encounter in candid...');
                return [4 /*yield*/, (0, shared_1.createEncounterFromAppointment)(visitResources, secrets, oystehr)];
            case 6:
                candidEncounterId = _f.sent();
                console.log("[CLAIM SUBMISSION] Candid encounter created with ID ".concat(candidEncounterId));
                encounterPatchOps = [];
                if (candidEncounterId != null) {
                    identifier = {
                        system: shared_1.CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
                        value: candidEncounterId,
                    };
                    encounterPatchOps.push({
                        op: 'add',
                        path: encounter.identifier != null ? '/identifier/-' : '/identifier',
                        value: encounter.identifier != null ? identifier : [identifier],
                    });
                }
                if (!encounter.id) {
                    throw new Error('Encounter unexpectedly had no id');
                }
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Encounter',
                        id: encounter.id,
                        operations: encounterPatchOps,
                    })];
            case 7:
                _f.sent();
                _f.label = 8;
            case 8:
                // update task status and status reason
                console.log('making patch request to update task status');
                return [4 /*yield*/, patchTaskStatus(oystehr, task.id, 'completed', 'claim sent successfully')];
            case 9:
                patchedTask = _f.sent();
                response = {
                    taskStatus: patchedTask.status,
                    statusReason: patchedTask.statusReason,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 10:
                error_1 = _f.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                _f.label = 11;
            case 11:
                _f.trys.push([11, 14, , 15]);
                if (!(oystehr && taskId)) return [3 /*break*/, 13];
                return [4 /*yield*/, patchTaskStatus(oystehr, taskId, 'failed', JSON.stringify(error_1))];
            case 12:
                _f.sent();
                _f.label = 13;
            case 13: return [3 /*break*/, 15];
            case 14:
                patchError_1 = _f.sent();
                console.error('Error patching task status in top level catch:', patchError_1);
                return [3 /*break*/, 15];
            case 15: return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 16: return [2 /*return*/];
        }
    });
}); });
var patchTaskStatus = function (oystehr, taskId, status, reason) { return __awaiter(void 0, void 0, void 0, function () {
    var patchedTask;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.patch({
                    resourceType: 'Task',
                    id: taskId,
                    operations: [
                        {
                            op: 'replace',
                            path: '/status',
                            value: status,
                        },
                        {
                            op: 'add',
                            path: '/statusReason',
                            value: {
                                coding: [
                                    {
                                        system: 'status-reason',
                                        code: reason || 'no reason given',
                                    },
                                ],
                            },
                        },
                    ],
                })];
            case 1:
                patchedTask = _a.sent();
                console.log('successfully patched task');
                console.log(JSON.stringify(patchedTask));
                return [2 /*return*/, patchedTask];
        }
    });
}); };
