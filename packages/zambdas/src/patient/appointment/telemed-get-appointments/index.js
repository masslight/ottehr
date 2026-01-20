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
var helpers_1 = require("./helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'telemed-get-appointments';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, patientId, secrets, fhirAPI, projectAPI, oystehr, user, patients, patientIDs, allResources_1, locations_1, encountersMap_1, appointments_1, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                patientId = validatedParameters.patientId, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(oystehrToken, secrets)];
            case 1:
                oystehrToken = _a.sent();
                fhirAPI = (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets);
                projectAPI = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets);
                oystehr = (0, utils_1.createOystehrClient)(oystehrToken, fhirAPI, projectAPI);
                console.log('getting user');
                return [4 /*yield*/, (0, shared_1.getUser)(input.headers.Authorization.replace('Bearer ', ''), secrets)];
            case 2:
                user = _a.sent();
                console.log('getting patients for user');
                return [4 /*yield*/, (0, utils_1.getPatientsForUser)(user, oystehr)];
            case 3:
                patients = _a.sent();
                console.log('getPatientsForUser awaited');
                patientIDs = patients.map(function (patient) { return "Patient/".concat(patient.id); });
                if (patientId && !patientIDs.includes("Patient/".concat(patientId))) {
                    throw new Error('Not authorized to get this patient');
                }
                if (!patientIDs.length && !patientId) {
                    console.log('returned empty appointments');
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify({ appointments: [] }),
                        }];
                }
                console.log('awaiting allResources');
                return [4 /*yield*/, (0, helpers_1.getFhirResources)(oystehr, patientIDs, patientId)];
            case 4:
                allResources_1 = _a.sent();
                console.log('allResources awaited');
                locations_1 = allResources_1.filter(function (resource) { return resource.resourceType === 'Location'; });
                encountersMap_1 = (0, helpers_1.filterTelemedVideoEncounters)(allResources_1);
                appointments_1 = [];
                allResources_1
                    .filter(function (resourceTemp) { return resourceTemp.resourceType === 'Appointment'; })
                    .forEach(function (appointmentTemp) {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                    var fhirAppointment = appointmentTemp;
                    if (!fhirAppointment.id)
                        return;
                    var patient = allResources_1.find(function (resourceTemp) { return resourceTemp.id === (0, utils_1.getParticipantIdFromAppointment)(fhirAppointment, 'Patient'); });
                    var encounter = encountersMap_1[fhirAppointment.id];
                    if (!encounter) {
                        console.log('No encounter for appointment: ' + fhirAppointment.id);
                        return;
                    }
                    var telemedStatus = (0, utils_1.getTelemedVisitStatus)(encounter.status, fhirAppointment.status);
                    if (!telemedStatus) {
                        console.log('No telemed status for appointment');
                        return;
                    }
                    var stateId = (_e = (_d = (_c = (_b = (_a = encounter === null || encounter === void 0 ? void 0 : encounter.location) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.location) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.split('/')) === null || _e === void 0 ? void 0 : _e[1];
                    var stateCode = (_g = (_f = locations_1.find(function (location) { return location.id === stateId; })) === null || _f === void 0 ? void 0 : _f.address) === null || _g === void 0 ? void 0 : _g.state;
                    console.log("build appointment resource for appointment with id ".concat(fhirAppointment.id));
                    var appointment = {
                        id: fhirAppointment.id || 'Unknown',
                        start: fhirAppointment.start,
                        patient: {
                            id: (patient === null || patient === void 0 ? void 0 : patient.id) || '',
                            firstName: (_k = (_j = (_h = patient === null || patient === void 0 ? void 0 : patient.name) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.given) === null || _k === void 0 ? void 0 : _k[0],
                            lastName: (_l = patient === null || patient === void 0 ? void 0 : patient.name) === null || _l === void 0 ? void 0 : _l[0].family,
                        },
                        appointmentStatus: fhirAppointment.status,
                        telemedStatus: telemedStatus,
                        state: { code: stateCode, id: stateId },
                    };
                    appointments_1.push(appointment);
                });
                response = {
                    appointments: appointments_1,
                };
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 5:
                error_1 = _a.sent();
                console.log('error', error_1, error_1.issue);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 6: return [2 /*return*/];
        }
    });
}); });
