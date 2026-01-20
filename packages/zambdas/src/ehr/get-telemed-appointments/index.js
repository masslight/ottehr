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
exports.performEffect = exports.index = void 0;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var helpers_1 = require("../../shared/helpers");
var fhir_resources_filters_1 = require("./helpers/fhir-resources-filters");
var fhir_utils_1 = require("./helpers/fhir-utils");
var helpers_2 = require("./helpers/helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
if (process.env.IS_OFFLINE === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('console-stamp')(console, { pattern: 'HH:MM:ss.l' });
}
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'get-telemed-appointments';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehrCurrentUser, oystehrM2m, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                console.log('Parameters: ' + JSON.stringify(validatedParameters));
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehrCurrentUser = (0, helpers_1.createOystehrClient)(validatedParameters.userToken, validatedParameters.secrets);
                oystehrM2m = (0, helpers_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                console.log('Created zapToken, fhir and app clients.');
                return [4 /*yield*/, (0, exports.performEffect)(validatedParameters, oystehrM2m, oystehrCurrentUser)];
            case 2:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                console.log(error_1);
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 4: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (params, oystehrM2m, oystehrCurrentUser) { return __awaiter(void 0, void 0, void 0, function () {
    var statusesFilter, locationsIdsFilter, visitTypesFilter, virtualLocationsMap, allResources, allPackages, resultAppointments, allRelatedPersonMaps, i, appointmentPackage, appointment, telemedStatus, telemedStatusHistory, locationVirtual, practitioner, encounter, patient, patientPhone, cancellationReason, smsModel, appointmentTemp;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                statusesFilter = params.statusesFilter, locationsIdsFilter = params.locationsIdsFilter, visitTypesFilter = params.visitTypesFilter;
                return [4 /*yield*/, (0, fhir_utils_1.getAllVirtualLocationsMap)(oystehrM2m)];
            case 1:
                virtualLocationsMap = _d.sent();
                console.log('Created virtual locations map.');
                return [4 /*yield*/, (0, fhir_utils_1.getAllPartiallyPreFilteredFhirResources)(oystehrM2m, oystehrCurrentUser, params, virtualLocationsMap)];
            case 2:
                allResources = _d.sent();
                if (!allResources) {
                    return [2 /*return*/, {
                            message: 'Successfully retrieved all appointments',
                            appointments: [],
                        }];
                }
                allPackages = (0, fhir_resources_filters_1.filterAppointmentsAndCreatePackages)({
                    allResources: allResources,
                    statusesFilter: statusesFilter,
                    virtualLocationsMap: virtualLocationsMap,
                    visitTypes: visitTypesFilter,
                    locationsIdsFilter: locationsIdsFilter,
                });
                console.log('Received all appointments with type "virtual":', allPackages.length);
                resultAppointments = [];
                if (!(allPackages.length > 0)) return [3 /*break*/, 4];
                return [4 /*yield*/, (0, utils_1.relatedPersonAndCommunicationMaps)(oystehrM2m, allResources)];
            case 3:
                allRelatedPersonMaps = _d.sent();
                for (i = 0; i < allPackages.length; i++) {
                    appointmentPackage = allPackages[i];
                    appointment = appointmentPackage.appointment, telemedStatus = appointmentPackage.telemedStatus, telemedStatusHistory = appointmentPackage.telemedStatusHistory, locationVirtual = appointmentPackage.locationVirtual, practitioner = appointmentPackage.practitioner, encounter = appointmentPackage.encounter;
                    patient = (0, fhir_resources_filters_1.filterPatientForAppointment)(appointment, allResources);
                    // it handles the case if a patient was deleted - should we handle this case? (relevant for local environment sometimes)
                    if (!patient) {
                        console.log('No patient found for appointment', appointment === null || appointment === void 0 ? void 0 : appointment.id);
                        continue;
                    }
                    patientPhone = appointmentPackage.paperwork
                        ? (0, helpers_2.getPhoneNumberFromQuestionnaire)(appointmentPackage.paperwork)
                        : undefined;
                    cancellationReason = extractCancellationReason(appointment);
                    smsModel = (0, utils_1.createSmsModel)(patient.id, allRelatedPersonMaps);
                    appointmentTemp = {
                        id: appointment.id || 'Unknown',
                        start: appointment.start,
                        patient: {
                            id: patient.id || 'Unknown',
                            firstName: (_b = (_a = patient === null || patient === void 0 ? void 0 : patient.name) === null || _a === void 0 ? void 0 : _a[0].given) === null || _b === void 0 ? void 0 : _b[0],
                            lastName: (_c = patient === null || patient === void 0 ? void 0 : patient.name) === null || _c === void 0 ? void 0 : _c[0].family,
                            dateOfBirth: patient.birthDate || 'Unknown',
                            sex: patient.gender,
                            phone: patientPhone,
                        },
                        smsModel: smsModel,
                        reasonForVisit: appointment.description,
                        comment: appointment.comment,
                        appointmentStatus: appointment.status,
                        locationVirtual: locationVirtual,
                        encounter: encounter,
                        paperwork: appointmentPackage.paperwork,
                        telemedStatus: telemedStatus,
                        telemedStatusHistory: telemedStatusHistory,
                        cancellationReason: cancellationReason,
                        next: false,
                        visitStatusHistory: (0, utils_1.getVisitStatusHistory)(encounter),
                        practitioner: practitioner,
                        encounterId: encounter.id || 'Unknown',
                        appointmentType: (0, utils_1.appointmentTypeForAppointment)(appointment),
                    };
                    resultAppointments.push(appointmentTemp);
                }
                console.log('Appointments parsed and filtered from all resources.');
                _d.label = 4;
            case 4: return [2 /*return*/, {
                    message: 'Successfully retrieved all appointments',
                    appointments: resultAppointments,
                }];
        }
    });
}); };
exports.performEffect = performEffect;
var extractCancellationReason = function (appointment) {
    var _a, _b;
    var codingClause = (_b = (_a = appointment.cancelationReason) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0];
    var cancellationReasonOptionOne = codingClause === null || codingClause === void 0 ? void 0 : codingClause.code;
    if ((cancellationReasonOptionOne !== null && cancellationReasonOptionOne !== void 0 ? cancellationReasonOptionOne : '').toLowerCase() === 'other') {
        return codingClause === null || codingClause === void 0 ? void 0 : codingClause.display;
    }
    if (cancellationReasonOptionOne) {
        return cancellationReasonOptionOne;
    }
    return codingClause === null || codingClause === void 0 ? void 0 : codingClause.display;
};
