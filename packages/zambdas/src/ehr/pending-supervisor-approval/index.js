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
var shared_1 = require("../../shared");
var createProvenanceForEncounter_1 = require("../../shared/createProvenanceForEncounter");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
exports.index = (0, shared_1.wrapHandler)('pending-supervisor-approval', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, encounterId, practitionerId, secrets, oystehr, encounter, encounterStatus, encounterPatchOps, statusHistoryUpdate, awaitingSupervisorApprovalExtension, existingExtensionIndex, encounterPatch, provenanceCreate, appointmentId, visitNoteAndEmailTaskResource, taskCreationResults, error_1, ENVIRONMENT;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                console.log("pending-supervisor-approval started, input: ".concat(JSON.stringify(input)));
                try {
                    validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                }
                catch (error) {
                    return [2 /*return*/, {
                            statusCode: 400,
                            body: JSON.stringify({
                                message: "Invalid request parameters. ".concat(error.message || error),
                            }),
                        }];
                }
                _d.label = 1;
            case 1:
                _d.trys.push([1, 6, , 7]);
                encounterId = validatedParameters.encounterId, practitionerId = validatedParameters.practitionerId, secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _d.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Encounter',
                        params: [
                            {
                                name: '_id',
                                value: encounterId,
                            },
                        ],
                    })];
            case 3:
                encounter = (_d.sent()).unbundle()[0];
                encounterStatus = utils_1.visitStatusToFhirEncounterStatusMap['completed'];
                encounterPatchOps = [
                    {
                        op: 'replace',
                        path: '/status',
                        value: encounterStatus,
                    },
                ];
                statusHistoryUpdate = (0, utils_1.getEncounterStatusHistoryUpdateOp)(encounter, encounterStatus, 'awaiting supervisor approval');
                encounterPatchOps.push(statusHistoryUpdate);
                awaitingSupervisorApprovalExtension = (0, utils_1.createExtensionValue)('awaiting-supervisor-approval', true, 'valueBoolean');
                existingExtensionIndex = (0, utils_1.findExtensionIndex)((_a = encounter.extension) !== null && _a !== void 0 ? _a : [], 'awaiting-supervisor-approval');
                if (existingExtensionIndex >= 0) {
                    encounterPatchOps.push({
                        op: 'replace',
                        path: "/extension/".concat(existingExtensionIndex),
                        value: awaitingSupervisorApprovalExtension,
                    });
                }
                else {
                    encounterPatchOps.push({
                        op: 'add',
                        path: encounter.extension ? '/extension/-' : '/extension',
                        value: encounter.extension ? awaitingSupervisorApprovalExtension : [awaitingSupervisorApprovalExtension],
                    });
                }
                encounterPatch = (0, utils_1.getPatchBinary)({
                    resourceType: 'Encounter',
                    resourceId: encounter.id,
                    patchOperations: encounterPatchOps,
                });
                provenanceCreate = {
                    method: 'POST',
                    url: '/Provenance',
                    resource: (0, createProvenanceForEncounter_1.createProvenanceForEncounter)(encounter.id, practitionerId, 'author'),
                };
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: [encounterPatch, provenanceCreate],
                    })];
            case 4:
                _d.sent();
                console.log("Updated encounter: ".concat(encounter.id, "."));
                appointmentId = (_c = (_b = encounter.appointment) === null || _b === void 0 ? void 0 : _b[0].reference) === null || _c === void 0 ? void 0 : _c.split('/')[1];
                if (appointmentId === undefined) {
                    throw new Error('Appointment ID is not defined');
                }
                visitNoteAndEmailTaskResource = (0, utils_1.getTaskResource)(utils_1.TaskIndicator.visitNotePDFAndEmail, appointmentId);
                return [4 /*yield*/, oystehr.fhir.create(visitNoteAndEmailTaskResource)];
            case 5:
                taskCreationResults = _d.sent();
                console.log('Task creation results ', taskCreationResults);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            message: "Successfully updated visit #".concat(appointmentId, " to await supervisor approval"),
                        }),
                    }];
            case 6:
                error_1 = _d.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('pending-supervisor-approval', error_1, ENVIRONMENT)];
            case 7: return [2 /*return*/];
        }
    });
}); });
