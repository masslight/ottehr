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
exports.index = void 0;
exports.updateAppointment = updateAppointment;
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'telemed-update-appointment';
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("Input: ".concat(JSON.stringify(input)));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                validatedParameters = (0, validateRequestParameters_1.validateUpdateAppointmentParams)(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(oystehrToken, input.secrets)];
            case 2:
                oystehrToken = _a.sent();
                return [4 /*yield*/, performEffect({ input: input, params: validatedParameters })];
            case 3:
                response = _a.sent();
                return [2 /*return*/, response];
            case 4:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('update-appointment', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
function performEffect(props) {
    return __awaiter(this, void 0, void 0, function () {
        var input, params, patient, secrets, fhirAPI, projectAPI, oystehr, user, userAccess, appointmentId, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    input = props.input, params = props.params;
                    patient = params.patient;
                    secrets = input.secrets;
                    fhirAPI = (0, utils_1.getSecret)(utils_1.SecretsKeys.FHIR_API, secrets);
                    projectAPI = (0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, secrets);
                    oystehr = (0, utils_1.createOystehrClient)(oystehrToken, fhirAPI, projectAPI);
                    console.log('getting user');
                    return [4 /*yield*/, (0, shared_1.getUser)(input.headers.Authorization.replace('Bearer ', ''), secrets)];
                case 1:
                    user = _a.sent();
                    if (!patient.id) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, shared_1.userHasAccessToPatient)(user, patient.id, oystehr)];
                case 2:
                    userAccess = _a.sent();
                    if (!userAccess) {
                        return [2 /*return*/, {
                                statusCode: 403,
                                body: JSON.stringify({
                                    message: 'User does not have permission to access this patient',
                                }),
                            }];
                    }
                    _a.label = 3;
                case 3:
                    console.log('updating appointment');
                    return [4 /*yield*/, updateAppointment(params, oystehr, user)];
                case 4:
                    appointmentId = (_a.sent()).appointmentId;
                    response = { appointmentId: appointmentId };
                    console.log("fhirAppointment = ".concat(JSON.stringify(response)), 'Telemed visit');
                    return [2 /*return*/, {
                            statusCode: 200,
                            body: JSON.stringify(response),
                        }];
            }
        });
    });
}
function updateAppointment(params, oystehr, user) {
    return __awaiter(this, void 0, void 0, function () {
        var updatePatientRequest, patient, unconfirmedDateOfBirth, locationState, resources, fhirAppointment, maybeFhirPatient, fhirEncounter, patientRequests, patchApptOps, op, transactionInput, location_1, locationId, locationParticipantIndex, patchEncounterOps, patchEncounterReq, patchApptReq, bundle, fhirPatient, response;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    updatePatientRequest = undefined;
                    patient = params.patient, unconfirmedDateOfBirth = params.unconfirmedDateOfBirth, locationState = params.locationState;
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Appointment',
                            params: [
                                {
                                    name: '_id',
                                    value: params.appointmentId,
                                },
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
                case 1:
                    resources = (_b.sent()).unbundle();
                    fhirAppointment = resources.find(function (res) {
                        return res.resourceType === 'Appointment';
                    });
                    maybeFhirPatient = resources.find(function (res) {
                        return res.resourceType === 'Patient';
                    });
                    fhirEncounter = resources.find(function (res) { return res.resourceType === 'Encounter'; });
                    if (!maybeFhirPatient) {
                        throw new Error('Patient is not found for the appointment');
                    }
                    if (!fhirAppointment) {
                        throw new Error("Appointment with provider ID ".concat(params.appointmentId, " was not found"));
                    }
                    if (!fhirEncounter) {
                        throw new Error("Encounter is not found for the appointment ".concat(params.appointmentId));
                    }
                    return [4 /*yield*/, (0, shared_1.creatingPatientUpdateRequest)(patient, maybeFhirPatient)];
                case 2:
                    updatePatientRequest = _b.sent();
                    console.log('performing Transactional Fhir Requests for the appointment');
                    if (!patient && !updatePatientRequest) {
                        throw new Error('Unexpectedly have no patient and no request to make one');
                    }
                    patientRequests = [];
                    if (updatePatientRequest) {
                        patientRequests.push(updatePatientRequest);
                    }
                    patchApptOps = [];
                    if (unconfirmedDateOfBirth) {
                        op = (0, utils_1.getPatchOperationToUpdateExtension)(fhirAppointment, {
                            url: utils_1.FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
                            valueDate: unconfirmedDateOfBirth,
                        });
                        if (op) {
                            patchApptOps.push(op);
                        }
                    }
                    transactionInput = {
                        requests: __spreadArray([], patientRequests, true),
                    };
                    if (!locationState) return [3 /*break*/, 4];
                    return [4 /*yield*/, (0, utils_1.getTelemedLocation)(oystehr, locationState)];
                case 3:
                    location_1 = _b.sent();
                    locationId = location_1 === null || location_1 === void 0 ? void 0 : location_1.id;
                    locationParticipantIndex = (_a = fhirAppointment.participant) === null || _a === void 0 ? void 0 : _a.findIndex(function (p) { var _a, _b; return (_b = (_a = p.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Location/'); });
                    if (locationParticipantIndex !== undefined && locationParticipantIndex !== -1) {
                        patchApptOps.push({
                            op: 'replace',
                            path: "/participant/".concat(locationParticipantIndex, "/actor/reference"),
                            value: "Location/".concat(locationId),
                        });
                    }
                    if (fhirEncounter && fhirEncounter.id) {
                        patchEncounterOps = [
                            {
                                op: 'replace',
                                path: '/location/0/location/reference',
                                value: "Location/".concat(locationId),
                            },
                        ];
                        patchEncounterReq = (0, utils_1.getPatchBinary)({
                            resourceId: fhirEncounter.id,
                            resourceType: 'Encounter',
                            patchOperations: patchEncounterOps,
                        });
                        transactionInput.requests.push(patchEncounterReq);
                    }
                    _b.label = 4;
                case 4:
                    patchApptReq = patchApptOps.length > 0
                        ? (0, utils_1.getPatchBinary)({ resourceId: params.appointmentId, resourceType: 'Appointment', patchOperations: patchApptOps })
                        : undefined;
                    if (patchApptReq) {
                        transactionInput.requests.push(patchApptReq);
                    }
                    console.log('making transaction request');
                    return [4 /*yield*/, oystehr.fhir.transaction(transactionInput)];
                case 5:
                    bundle = _b.sent();
                    fhirPatient = extractResourcesFromBundle(bundle, transactionInput, maybeFhirPatient).patient;
                    return [4 /*yield*/, (0, shared_1.createUpdateUserRelatedResources)(oystehr, patient, fhirPatient, user)];
                case 6:
                    _b.sent();
                    console.log('success, here is the id: ', fhirAppointment.id);
                    response = {
                        appointmentId: fhirAppointment.id || '',
                    };
                    return [2 /*return*/, response];
            }
        });
    });
}
var extractResourcesFromBundle = function (bundle, transactionInput, maybePatient) {
    var _a, _b, _c;
    console.log('getting resources from bundle');
    var entry = (_a = bundle.entry) !== null && _a !== void 0 ? _a : [];
    var appointment = (_b = entry.find(function (appt) {
        return appt.resource && appt.resource.resourceType === 'Appointment';
    })) === null || _b === void 0 ? void 0 : _b.resource;
    if (transactionInput.requests.find(function (req) { return req.url.includes('Appointment'); }) && appointment === undefined) {
        throw new Error('Appointment could not be updated');
    }
    var patient = maybePatient;
    if (!patient) {
        patient = (_c = entry.find(function (enc) {
            return enc.resource && enc.resource.resourceType === 'Patient';
        })) === null || _c === void 0 ? void 0 : _c.resource;
    }
    if (transactionInput.requests.find(function (req) { return req.url.includes('Patient'); }) && patient === undefined) {
        throw new Error('Patient could not be updated');
    }
    console.log('successfully obtained resources from bundle');
    return { appointment: appointment, patient: patient };
};
