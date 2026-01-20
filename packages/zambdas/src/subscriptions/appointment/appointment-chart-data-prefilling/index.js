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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var chart_data_1 = require("../../../shared/chart-data");
var helpers_1 = require("../../../shared/helpers");
var helpers_2 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var CHUNK_SIZE = 50;
var oystehrToken;
var ZAMBDA_NAME = 'appointment-chart-data-prefilling';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var updateAppointmentRequests, encounterUpdateRequests, saveOrUpdateRequests, validatedParameters, appointment, secrets, oystehr_1, resourceBundle, isInPerson_1, patient, patientId_1, encounter, encounterId_1, examObservations, disposition, allRequests, requestChunks, error_1, error_2, error_3, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Input: ".concat(JSON.stringify(input)));
                updateAppointmentRequests = [];
                encounterUpdateRequests = [];
                saveOrUpdateRequests = [];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 12, , 13]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                appointment = validatedParameters.appointment, secrets = validatedParameters.secrets;
                console.log('appointment ID', appointment.id);
                console.groupEnd();
                console.debug('validateRequestParameters success');
                if (!appointment.id)
                    throw new Error("Appointment FHIR resource doesn't exist.");
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(oystehrToken, secrets)];
            case 2:
                oystehrToken = _a.sent();
                oystehr_1 = (0, helpers_1.createOystehrClient)(oystehrToken, secrets);
                console.log('Created zapToken and fhir client');
                return [4 /*yield*/, oystehr_1.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            { name: '_id', value: appointment.id },
                            {
                                name: '_include',
                                value: 'Appointment:patient',
                            },
                            {
                                name: '_revinclude:iterate',
                                value: 'Encounter:appointment',
                            },
                        ],
                    })];
            case 3:
                resourceBundle = (_a.sent()).unbundle();
                console.log('Got Appointment related resources');
                isInPerson_1 = (0, utils_1.isInPersonAppointment)(appointment);
                patient = resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) { return resource.resourceType === 'Patient'; });
                if (!(patient === null || patient === void 0 ? void 0 : patient.id))
                    throw new Error('Patient is missing from resource bundle.');
                patientId_1 = patient.id;
                encounter = resourceBundle === null || resourceBundle === void 0 ? void 0 : resourceBundle.find(function (resource) {
                    return resource.resourceType === 'Encounter' && (isInPerson_1 || Boolean((0, helpers_1.getVideoRoomResourceExtension)(resource)));
                });
                if (!(encounter === null || encounter === void 0 ? void 0 : encounter.id))
                    throw new Error('Encounter is missing from resource bundle.');
                encounterId_1 = encounter.id;
                examObservations = (0, helpers_2.createExamObservations)(isInPerson_1);
                examObservations === null || examObservations === void 0 ? void 0 : examObservations.forEach(function (element) {
                    var code = element.code, bodySite = element.bodySite, label = element.label, rest = __rest(element, ["code", "bodySite", "label"]);
                    saveOrUpdateRequests.push((0, shared_1.saveResourceRequest)((0, chart_data_1.makeExamObservationResource)(encounterId_1, patientId_1, rest, code ? { code: code, bodySite: bodySite } : undefined, label)));
                });
                disposition = {
                    type: 'pcp-no-type',
                    note: (0, utils_1.getDefaultNote)('pcp-no-type'),
                };
                saveOrUpdateRequests.push((0, chart_data_1.createDispositionServiceRequest)({
                    disposition: disposition,
                    encounterId: encounter.id,
                    patientId: patient.id,
                }));
                saveOrUpdateRequests.push((0, shared_1.saveResourceRequest)((0, chart_data_1.makeClinicalImpressionResource)(encounterId_1, patient.id, { text: utils_1.MDM_FIELD_DEFAULT_TEXT }, 'medical-decision')));
                encounterUpdateRequests.push((0, utils_1.getPatchBinary)({
                    resourceId: encounter.id,
                    resourceType: 'Encounter',
                    patchOperations: __spreadArray(__spreadArray([], (0, chart_data_1.updateEncounterPatientInfoConfirmed)(encounter, { value: true }), true), [
                        (0, chart_data_1.updateEncounterDischargeDisposition)(encounter, disposition),
                    ], false),
                }));
                // Add appointment PREPROCESSED tag LAST so it's in the final chunk
                // This ensures all resources are created before the tag is set
                updateAppointmentRequests.push((0, utils_1.getPatchBinary)({
                    resourceId: appointment.id,
                    resourceType: 'Appointment',
                    patchOperations: [(0, utils_1.getPatchOperationForNewMetaTag)(appointment, utils_1.FHIR_APPOINTMENT_PREPROCESSED_TAG)],
                }));
                allRequests = __spreadArray(__spreadArray(__spreadArray([], encounterUpdateRequests, true), saveOrUpdateRequests, true), updateAppointmentRequests, true);
                if (!(allRequests.length > CHUNK_SIZE)) return [3 /*break*/, 8];
                console.log('chunking batches...');
                requestChunks = (0, utils_1.chunkThings)(allRequests, CHUNK_SIZE);
                console.log('chunks', requestChunks.length, ', chunk size', requestChunks[0].length);
                console.time('Batch requests');
                _a.label = 4;
            case 4:
                _a.trys.push([4, 6, , 7]);
                return [4 /*yield*/, Promise.all(requestChunks.map(function (chunk) {
                        return oystehr_1.fhir.transaction({
                            requests: chunk,
                        });
                    }))];
            case 5:
                _a.sent();
                return [3 /*break*/, 7];
            case 6:
                error_1 = _a.sent();
                console.error('Error during parallel chunk processing:', JSON.stringify(error_1));
                throw new Error('Error during parallel chunk processing');
            case 7:
                console.timeEnd('Batch requests');
                return [3 /*break*/, 11];
            case 8:
                _a.trys.push([8, 10, , 11]);
                return [4 /*yield*/, oystehr_1.fhir.transaction({
                        requests: allRequests,
                    })];
            case 9:
                _a.sent();
                return [3 /*break*/, 11];
            case 10:
                error_2 = _a.sent();
                console.log('Error from transaction: ', error_2, JSON.stringify(error_2));
                throw new Error('error from transaction');
            case 11: return [2 /*return*/, {
                    statusCode: 200,
                    body: 'Successfully pre-processed appointment',
                }];
            case 12:
                error_3 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('admin-appointment-chart-data-prefilling', error_3, ENVIRONMENT)];
            case 13: return [2 /*return*/];
        }
    });
}); });
