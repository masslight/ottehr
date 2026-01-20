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
exports.createAppointmentComplexValidation = void 0;
exports.validateCreateAppointmentParams = validateCreateAppointmentParams;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var helpers_1 = require("../helpers");
function validateCreateAppointmentParams(input, user) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var isEHRUser = user && (0, shared_1.checkIsEHRUser)(user);
    var bodyJSON = JSON.parse(input.body);
    var slotId = bodyJSON.slotId, language = bodyJSON.language, patient = bodyJSON.patient, unconfirmedDateOfBirth = bodyJSON.unconfirmedDateOfBirth, locationState = bodyJSON.locationState, appointmentMetadata = bodyJSON.appointmentMetadata;
    console.log('unconfirmedDateOfBirth', unconfirmedDateOfBirth);
    console.log('patient:', patient, 'slotId:', slotId);
    // Check existence of necessary fields
    if (patient === undefined) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['patient']);
    }
    if (slotId === undefined) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['slotId']);
    }
    console.log('patient input:', JSON.stringify(patient));
    // Patient details
    var missingRequiredPatientFields = [];
    if (Boolean(patient.firstName) === false) {
        missingRequiredPatientFields.push('firstName');
    }
    if (Boolean(patient.lastName) === false) {
        missingRequiredPatientFields.push('lastName');
    }
    if (Boolean(patient.dateOfBirth) === false) {
        missingRequiredPatientFields.push('dateOfBirth');
    }
    if (Boolean(patient.reasonForVisit) === undefined) {
        missingRequiredPatientFields.push('reasonForVisit');
    }
    if (!isEHRUser && Boolean(patient.sex) === false) {
        missingRequiredPatientFields.push('sex');
    }
    if (!isEHRUser && Boolean(patient.email === undefined)) {
        missingRequiredPatientFields.push('email');
    }
    if (missingRequiredPatientFields.length > 0) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingRequiredPatientFields.map(function (field) { return "patient.".concat(field); }));
    }
    var isInvalidPatientDate = !luxon_1.DateTime.fromISO(patient.dateOfBirth).isValid;
    if (isInvalidPatientDate) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"patient.dateOfBirth" was not read as a valid date');
    }
    if (patient.sex && !Object.values(utils_1.PersonSex).includes(patient.sex)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("\"patient.sex\" must be one of the following values: ".concat(JSON.stringify(Object.values(utils_1.PersonSex))));
    }
    if (isEHRUser && !patient.email) {
        patient.emailUser = undefined;
    }
    if ((patient === null || patient === void 0 ? void 0 : patient.phoneNumber) && !shared_1.phoneRegex.test(patient.phoneNumber)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('patient phone number is not valid');
    }
    patient.reasonForVisit = "".concat(patient.reasonForVisit).concat((patient === null || patient === void 0 ? void 0 : patient.reasonAdditional) ? "".concat(utils_1.REASON_FOR_VISIT_SEPARATOR).concat(patient === null || patient === void 0 ? void 0 : patient.reasonAdditional) : '');
    if (patient.reasonForVisit && patient.reasonForVisit.length > utils_1.REASON_MAXIMUM_CHAR_LIMIT) {
        throw (0, utils_1.CHARACTER_LIMIT_EXCEEDED_ERROR)('Reason for visit', utils_1.REASON_MAXIMUM_CHAR_LIMIT);
    }
    if (language && ['en', 'es'].includes(language) === false) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"language" must be one of: "en", "es"');
    }
    if (unconfirmedDateOfBirth) {
        var isInvalidUnconfirmedDateOfBirth = !luxon_1.DateTime.fromISO(unconfirmedDateOfBirth).isValid;
        if (isInvalidUnconfirmedDateOfBirth) {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"unconfirmedDateOfBirth" was not read as a valid date');
        }
    }
    if (locationState) {
        var isValidLocationState = utils_1.AllStates.some(function (state) { return state.value.toLowerCase() === locationState.toLowerCase(); });
        if (isValidLocationState === false) {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"locationState" must be a valid US state postal abbreviation');
        }
    }
    // will rely on fhir validation for more granular checks
    if (appointmentMetadata && typeof appointmentMetadata !== 'object') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"appointmentMetadata" must be an object');
    }
    if (patient.authorizedNonLegalGuardians != null && typeof patient.authorizedNonLegalGuardians !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('if specified, "patient.authorizedNonLegalGuardians" must be a string');
    }
    return {
        slotId: slotId,
        user: user,
        isEHRUser: isEHRUser,
        patient: patient,
        secrets: input.secrets,
        language: language,
        unconfirmedDateOfBirth: unconfirmedDateOfBirth,
        locationState: locationState,
        appointmentMetadata: appointmentMetadata,
    };
}
var createAppointmentComplexValidation = function (input, oystehrClient) { return __awaiter(void 0, void 0, void 0, function () {
    var slotId, isEHRUser, user, patient, appointmentMetadata, locationState, userAccess, fhirResources, slot, schedule, scheduleOwner, appointment, serviceMode, questionnaireCanonical, visitType, state_1, isValidLocationState;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                slotId = input.slotId, isEHRUser = input.isEHRUser, user = input.user, patient = input.patient, appointmentMetadata = input.appointmentMetadata;
                console.log('createAppointmentComplexValidation metadata:', appointmentMetadata);
                locationState = input.locationState;
                if (!patient.id) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, shared_1.userHasAccessToPatient)(user, patient.id, oystehrClient)];
            case 1:
                userAccess = _b.sent();
                if (!user || (!userAccess && !isEHRUser && !(0, shared_1.isTestUser)(user))) {
                    throw utils_1.NO_READ_ACCESS_TO_PATIENT_ERROR;
                }
                _b.label = 2;
            case 2: return [4 /*yield*/, oystehrClient.fhir.search({
                    resourceType: 'Slot',
                    params: [
                        {
                            name: '_id',
                            value: slotId,
                        },
                        {
                            name: '_include',
                            value: 'Slot:schedule',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Schedule:actor',
                        },
                        {
                            name: '_revinclude',
                            value: 'Appointment:slot',
                        },
                    ],
                })];
            case 3:
                fhirResources = (_b.sent()).unbundle();
                slot = fhirResources.find(function (resource) { return resource.resourceType === 'Slot'; });
                schedule = fhirResources.find(function (resource) { return resource.resourceType === 'Schedule'; });
                scheduleOwner = fhirResources.find(function (resource) {
                    var _a;
                    var asRef = "".concat(resource.resourceType, "/").concat(resource.id);
                    return (_a = schedule === null || schedule === void 0 ? void 0 : schedule.actor) === null || _a === void 0 ? void 0 : _a.some(function (actor) { return actor.reference === asRef; });
                });
                appointment = fhirResources.find(function (resource) { return resource.resourceType === 'Appointment'; });
                if (!slot.id) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Slot');
                }
                if (scheduleOwner === undefined) {
                    // this will be a 500 error
                    throw new Error('Schedule owner not found');
                }
                if (appointment === null || appointment === void 0 ? void 0 : appointment.id) {
                    throw utils_1.APPOINTMENT_ALREADY_EXISTS_ERROR;
                }
                serviceMode = (0, utils_1.getServiceModeFromSlot)(slot);
                if (serviceMode === undefined) {
                    serviceMode = (0, utils_1.getServiceModeFromScheduleOwner)(scheduleOwner);
                }
                // todo: better error with link to docs here?
                if (serviceMode === undefined) {
                    throw new Error('Service mode not found');
                }
                questionnaireCanonical = (0, helpers_1.getCanonicalUrlForPrevisitQuestionnaire)(serviceMode);
                visitType = (0, utils_1.getSlotIsPostTelemed)(slot) ? utils_1.VisitType.PostTelemed : utils_1.VisitType.PreBook;
                if ((0, utils_1.getSlotIsWalkin)(slot)) {
                    visitType = utils_1.VisitType.WalkIn;
                }
                if (serviceMode === utils_1.ServiceMode.virtual && !locationState) {
                    if (scheduleOwner.resourceType === 'Location' && (0, utils_1.isLocationVirtual)(scheduleOwner)) {
                        state_1 = (_a = scheduleOwner.address) === null || _a === void 0 ? void 0 : _a.state;
                        isValidLocationState = utils_1.AllStates.some(function (stateTemp) { return state_1 && stateTemp.value.toLowerCase() === state_1.toLowerCase(); });
                        if (isValidLocationState) {
                            locationState = state_1;
                        }
                    }
                }
                if (serviceMode === utils_1.ServiceMode.virtual && !locationState) {
                    throw (0, utils_1.INVALID_INPUT_ERROR)('"locationState" is required for virtual appointments');
                }
                return [2 /*return*/, {
                        slot: slot,
                        scheduleOwner: scheduleOwner,
                        serviceMode: serviceMode,
                        user: user,
                        patient: patient,
                        questionnaireCanonical: questionnaireCanonical,
                        visitType: visitType,
                        locationState: locationState,
                        appointmentMetadata: appointmentMetadata,
                    }];
        }
    });
}); };
exports.createAppointmentComplexValidation = createAppointmentComplexValidation;
