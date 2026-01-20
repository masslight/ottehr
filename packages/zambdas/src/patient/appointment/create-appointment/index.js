"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.performTransactionalFhirRequests = exports.index = void 0;
exports.createAppointment = createAppointment;
var luxon_1 = require("luxon");
var short_uuid_1 = require("short-uuid");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var helpers_1 = require("../helpers");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var oystehrToken;
exports.index = (0, shared_1.wrapHandler)('create-appointment', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var token, user, validatedParameters, secrets, unconfirmedDateOfBirth, language, oystehr, effectInput, slot, scheduleOwner, serviceMode, patient, questionnaireCanonical, visitType, maybeMetadata, appointmentMetadata, data_appointment, message, appointmentId, fhirPatientId, questionnaireResponseId, encounterId, resources, relatedPersonId, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 8, , 9]);
                console.group('validateRequestParameters');
                // Step 1: Validate input
                console.log('getting user');
                token = input.headers.Authorization.replace('Bearer ', '');
                return [4 /*yield*/, (0, shared_1.getUser)(token, input.secrets)];
            case 1:
                user = _a.sent();
                validatedParameters = (0, validateRequestParameters_1.validateCreateAppointmentParams)(input, user);
                secrets = validatedParameters.secrets, unconfirmedDateOfBirth = validatedParameters.unconfirmedDateOfBirth, language = validatedParameters.language;
                console.groupEnd();
                console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
                if (!!oystehrToken) return [3 /*break*/, 3];
                console.log('getting token');
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(input.secrets)];
            case 2:
                oystehrToken = _a.sent();
                return [3 /*break*/, 4];
            case 3:
                console.log('already have token');
                _a.label = 4;
            case 4:
                oystehr = (0, shared_1.createOystehrClient)(oystehrToken, input.secrets);
                console.time('performing-complex-validation');
                return [4 /*yield*/, (0, validateRequestParameters_1.createAppointmentComplexValidation)(validatedParameters, oystehr)];
            case 5:
                effectInput = _a.sent();
                slot = effectInput.slot, scheduleOwner = effectInput.scheduleOwner, serviceMode = effectInput.serviceMode, patient = effectInput.patient, questionnaireCanonical = effectInput.questionnaireCanonical, visitType = effectInput.visitType, maybeMetadata = effectInput.appointmentMetadata;
                console.log('effectInput', effectInput);
                console.timeEnd('performing-complex-validation');
                appointmentMetadata = injectMetadataIfNeeded(maybeMetadata);
                console.log('creating appointment with metadata: ', JSON.stringify(appointmentMetadata));
                return [4 /*yield*/, createAppointment({
                        slot: slot,
                        scheduleOwner: scheduleOwner,
                        patient: patient,
                        serviceMode: serviceMode,
                        user: user,
                        language: language,
                        secrets: secrets,
                        visitType: visitType,
                        unconfirmedDateOfBirth: unconfirmedDateOfBirth,
                        questionnaireCanonical: questionnaireCanonical,
                        appointmentMetadata: appointmentMetadata,
                    }, oystehr)];
            case 6:
                data_appointment = _a.sent();
                console.log('appointment created');
                message = data_appointment.message, appointmentId = data_appointment.appointmentId, fhirPatientId = data_appointment.fhirPatientId, questionnaireResponseId = data_appointment.questionnaireResponseId, encounterId = data_appointment.encounterId, resources = data_appointment.resources, relatedPersonId = data_appointment.relatedPersonId;
                return [4 /*yield*/, (0, shared_1.createAuditEvent)(shared_1.AuditableZambdaEndpoints.appointmentCreate, oystehr, input, fhirPatientId, validatedParameters.secrets)];
            case 7:
                _a.sent();
                response = {
                    message: message,
                    appointmentId: appointmentId,
                    fhirPatientId: fhirPatientId,
                    questionnaireResponseId: questionnaireResponseId,
                    encounterId: encounterId,
                    resources: resources,
                    relatedPersonId: relatedPersonId,
                };
                console.log("fhirAppointment = ".concat(JSON.stringify(response)), visitType);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 8:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('create-appointment', error_1, ENVIRONMENT)];
            case 9: return [2 /*return*/];
        }
    });
}); });
function createAppointment(input, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var slot, scheduleOwner, patient, user, secrets, visitType, unconfirmedDateOfBirth, serviceMode, questionnaireUrl, appointmentMetadata, _a, verifiedPhoneNumber, listRequests, createPatientRequest, updatePatientRequest, isEHRUser, maybeFhirPatient, startTime, endTime, formattedUserNumber, createdBy, currentQuestionnaire, verifiedFormattedPhoneNumber, _b, appointment, fhirPatient, questionnaireResponseId, encounter, questionnaire, relatedPersonId, userResource, person;
        var _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    slot = input.slot, scheduleOwner = input.scheduleOwner, patient = input.patient, user = input.user, secrets = input.secrets, visitType = input.visitType, unconfirmedDateOfBirth = input.unconfirmedDateOfBirth, serviceMode = input.serviceMode, questionnaireUrl = input.questionnaireCanonical, appointmentMetadata = input.appointmentMetadata;
                    return [4 /*yield*/, (0, shared_1.generatePatientRelatedRequests)(user, patient, oystehr)];
                case 1:
                    _a = _g.sent(), verifiedPhoneNumber = _a.verifiedPhoneNumber, listRequests = _a.listRequests, createPatientRequest = _a.createPatientRequest, updatePatientRequest = _a.updatePatientRequest, isEHRUser = _a.isEHRUser, maybeFhirPatient = _a.maybeFhirPatient;
                    if (visitType === utils_1.VisitType.WalkIn) {
                        startTime = luxon_1.DateTime.now().setZone('UTC').toISO();
                    }
                    else {
                        if (slot === null || slot === void 0 ? void 0 : slot.start) {
                            startTime = luxon_1.DateTime.fromISO(slot.start).setZone('UTC').toISO();
                        }
                        else {
                            throw new Error('Slot start time is required for pre-book appointments');
                        }
                    }
                    if (!startTime) {
                        throw new Error('startTime must be set by this point');
                    }
                    endTime = luxon_1.DateTime.fromISO(startTime)
                        .plus({ minutes: (0, utils_1.getAppointmentDurationFromSlot)(slot) })
                        .setZone('UTC')
                        .toISO();
                    if (!endTime) {
                        throw new Error('endTime could not be calculated');
                    }
                    formattedUserNumber = (0, utils_1.formatPhoneNumberDisplay)((_c = user === null || user === void 0 ? void 0 : user.name) === null || _c === void 0 ? void 0 : _c.replace('+1', ''));
                    createdBy = isEHRUser
                        ? "Staff ".concat(user === null || user === void 0 ? void 0 : user.email)
                        : "".concat(visitType === utils_1.VisitType.WalkIn ? 'QR - ' : '', "Patient").concat(formattedUserNumber ? " ".concat(formattedUserNumber) : '');
                    console.log('getting questionnaire ID to create blank questionnaire response');
                    return [4 /*yield*/, (0, utils_1.getCanonicalQuestionnaire)(questionnaireUrl, oystehr)];
                case 2:
                    currentQuestionnaire = _g.sent();
                    verifiedFormattedPhoneNumber = verifiedPhoneNumber;
                    if (!patient.id && !verifiedPhoneNumber) {
                        console.log('Getting verifiedPhoneNumber for new patient', patient.phoneNumber);
                        if (isEHRUser) {
                            if (!patient.phoneNumber) {
                                throw new Error('No phone number found for patient');
                            }
                            verifiedFormattedPhoneNumber = (0, utils_1.formatPhoneNumber)(patient.phoneNumber);
                        }
                        else {
                            // User is patient and auth0 already appends a +1 to the phone number
                            verifiedFormattedPhoneNumber = (user === null || user === void 0 ? void 0 : user.name) ? (0, utils_1.formatPhoneNumber)(user.name) : undefined;
                        }
                    }
                    console.time('performing Transactional Fhir Requests for new appointment');
                    return [4 /*yield*/, (0, exports.performTransactionalFhirRequests)({
                            patient: maybeFhirPatient,
                            reasonForVisit: (patient === null || patient === void 0 ? void 0 : patient.reasonForVisit) || '',
                            startTime: startTime,
                            endTime: endTime,
                            serviceMode: serviceMode,
                            scheduleOwner: scheduleOwner,
                            visitType: visitType,
                            secrets: secrets,
                            verifiedPhoneNumber: verifiedFormattedPhoneNumber,
                            contactInfo: { phone: verifiedFormattedPhoneNumber !== null && verifiedFormattedPhoneNumber !== void 0 ? verifiedFormattedPhoneNumber : 'not provided', email: (_d = patient.email) !== null && _d !== void 0 ? _d : 'not provided' },
                            questionnaire: currentQuestionnaire,
                            oystehr: oystehr,
                            updatePatientRequest: updatePatientRequest,
                            createPatientRequest: createPatientRequest,
                            performPreProcessing: user && !(0, shared_1.isTestUser)(user),
                            listRequests: listRequests,
                            unconfirmedDateOfBirth: unconfirmedDateOfBirth,
                            newPatientDob: (_e = createPatientRequest === null || createPatientRequest === void 0 ? void 0 : createPatientRequest.resource) === null || _e === void 0 ? void 0 : _e.birthDate,
                            createdBy: createdBy,
                            slot: slot,
                            appointmentMetadata: appointmentMetadata,
                        })];
                case 3:
                    _b = _g.sent(), appointment = _b.appointment, fhirPatient = _b.patient, questionnaireResponseId = _b.questionnaireResponseId, encounter = _b.encounter, questionnaire = _b.questionnaire;
                    relatedPersonId = '';
                    if (!(!patient.id && fhirPatient.id)) return [3 /*break*/, 5];
                    console.log('New patient');
                    if (!verifiedFormattedPhoneNumber) {
                        throw new Error('No phone number found for patient 2');
                    }
                    return [4 /*yield*/, (0, utils_1.createUserResourcesForPatient)(oystehr, fhirPatient.id, verifiedFormattedPhoneNumber)];
                case 4:
                    userResource = _g.sent();
                    relatedPersonId = ((_f = userResource === null || userResource === void 0 ? void 0 : userResource.relatedPerson) === null || _f === void 0 ? void 0 : _f.id) || '';
                    person = userResource.person;
                    if (!person.id) {
                        throw new Error('Person resource does not have an ID');
                    }
                    _g.label = 5;
                case 5:
                    if (appointment.id === undefined) {
                        throw new Error('Appointment resource does not have an ID');
                    }
                    if (fhirPatient.id === undefined) {
                        throw new Error('Patient resource does not have an ID');
                    }
                    if (encounter.id === undefined) {
                        throw new Error('Encounter resource does not have an ID');
                    }
                    console.log('success, here is the id: ', appointment.id);
                    return [2 /*return*/, {
                            message: 'Successfully created an appointment and encounter',
                            appointmentId: appointment.id,
                            fhirPatientId: fhirPatient.id,
                            questionnaireResponseId: questionnaireResponseId,
                            encounterId: encounter.id,
                            relatedPersonId: relatedPersonId,
                            resources: {
                                appointment: appointment,
                                encounter: encounter,
                                questionnaire: questionnaire,
                                patient: fhirPatient,
                            },
                        }];
            }
        });
    });
}
var performTransactionalFhirRequests = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var oystehr, patient, scheduleOwner, questionnaire, reasonForVisit, startTime, endTime, visitType, verifiedPhoneNumber, contactInfo, additionalInfo, unconfirmedDateOfBirth, createPatientRequest, performPreProcessing, listRequests, updatePatientRequest, newPatientDob, createdBy, serviceMode, slot, appointmentMetadata, patientRef, now, nowIso, initialAppointmentStatus, initialEncounterStatus, apptExtensions, encExtensions, _a, telemedEncExtensions, telemedApptExtensions, apptUrl, participants, slotReference, postSlotRequests, patchSlotRequests, otherMetaTags, apptResource, encUrl, encResource, _b, documents, accountInfo, patientToUse, currentPatientAccount, item, questionnaireResponseResource, postQuestionnaireResponseRequest, postApptReq, postEncRequest, patientRequests, confirmationTextTask, taskRequest, postAccountRequests, accountResource, accountResource, transactionInput, bundle, resources;
    var _c, _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                oystehr = input.oystehr, patient = input.patient, scheduleOwner = input.scheduleOwner, questionnaire = input.questionnaire, reasonForVisit = input.reasonForVisit, startTime = input.startTime, endTime = input.endTime, visitType = input.visitType, verifiedPhoneNumber = input.verifiedPhoneNumber, contactInfo = input.contactInfo, additionalInfo = input.additionalInfo, unconfirmedDateOfBirth = input.unconfirmedDateOfBirth, createPatientRequest = input.createPatientRequest, performPreProcessing = input.performPreProcessing, listRequests = input.listRequests, updatePatientRequest = input.updatePatientRequest, newPatientDob = input.newPatientDob, createdBy = input.createdBy, serviceMode = input.serviceMode, slot = input.slot, appointmentMetadata = input.appointmentMetadata;
                if (!patient && !(createPatientRequest === null || createPatientRequest === void 0 ? void 0 : createPatientRequest.fullUrl)) {
                    throw new Error('Unexpectedly have no patient and no request to make one');
                }
                patientRef = patient ? "Patient/".concat(patient.id) : (createPatientRequest === null || createPatientRequest === void 0 ? void 0 : createPatientRequest.fullUrl) || '';
                now = luxon_1.DateTime.now().setZone('UTC');
                nowIso = (_c = now.toISO()) !== null && _c !== void 0 ? _c : '';
                initialAppointmentStatus = visitType === utils_1.VisitType.PreBook || visitType === utils_1.VisitType.PostTelemed ? 'booked' : 'arrived';
                initialEncounterStatus = visitType === utils_1.VisitType.PreBook || visitType === utils_1.VisitType.PostTelemed ? 'planned' : 'arrived';
                apptExtensions = [];
                encExtensions = [];
                if (serviceMode === utils_1.ServiceMode.virtual) {
                    initialAppointmentStatus = 'arrived';
                    initialEncounterStatus = 'planned';
                    _a = (0, helpers_1.getTelemedRequiredAppointmentEncounterExtensions)(patientRef, nowIso), telemedEncExtensions = _a.encExtensions, telemedApptExtensions = _a.apptExtensions;
                    apptExtensions.push.apply(apptExtensions, telemedApptExtensions);
                    encExtensions.push.apply(encExtensions, telemedEncExtensions);
                }
                if (unconfirmedDateOfBirth) {
                    apptExtensions.push({
                        url: utils_1.FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
                        valueString: unconfirmedDateOfBirth,
                    });
                }
                if (additionalInfo) {
                    apptExtensions.push({
                        url: utils_1.FHIR_EXTENSION.Appointment.additionalInfo.url,
                        valueString: additionalInfo,
                    });
                }
                apptUrl = "urn:uuid:".concat((0, short_uuid_1.uuid)());
                participants = [];
                participants.push({
                    actor: {
                        reference: patientRef,
                    },
                    status: 'accepted',
                });
                participants.push({
                    actor: {
                        reference: "".concat(scheduleOwner.resourceType, "/").concat(scheduleOwner.id),
                    },
                    status: 'accepted',
                });
                postSlotRequests = [];
                patchSlotRequests = [];
                if ((0, utils_1.isValidUUID)((_d = slot === null || slot === void 0 ? void 0 : slot.id) !== null && _d !== void 0 ? _d : '') && (slot === null || slot === void 0 ? void 0 : slot.meta) !== undefined) {
                    // assume slot already persisted
                    slotReference = {
                        reference: "Slot/".concat(slot.id),
                    };
                    patchSlotRequests.push({
                        method: 'PATCH',
                        url: "/Slot/".concat(slot.id),
                        operations: [
                            {
                                op: 'replace',
                                path: '/status',
                                value: 'busy',
                            },
                        ],
                    });
                }
                else if (slot) {
                    postSlotRequests.push({
                        method: 'POST',
                        url: '/Slot',
                        resource: __assign(__assign({}, slot), { resourceType: 'Slot', id: undefined, status: 'busy' }),
                        fullUrl: "urn:uuid:".concat((0, short_uuid_1.uuid)()),
                    });
                    slotReference = {
                        reference: postSlotRequests[0].fullUrl,
                    };
                }
                otherMetaTags = performPreProcessing ? [utils_1.FHIR_APPOINTMENT_READY_FOR_PREPROCESSING_TAG] : [];
                apptResource = {
                    resourceType: 'Appointment',
                    meta: __assign(__assign({}, (appointmentMetadata !== null && appointmentMetadata !== void 0 ? appointmentMetadata : {})), { tag: __spreadArray(__spreadArray([
                            { code: serviceMode === utils_1.ServiceMode.virtual ? utils_1.OTTEHR_MODULE.TM : utils_1.OTTEHR_MODULE.IP },
                            {
                                system: utils_1.CREATED_BY_SYSTEM,
                                display: createdBy,
                            }
                        ], otherMetaTags, true), ((_e = appointmentMetadata === null || appointmentMetadata === void 0 ? void 0 : appointmentMetadata.tag) !== null && _e !== void 0 ? _e : []), true) }),
                    participant: participants,
                    start: startTime,
                    end: endTime,
                    slot: slotReference ? [slotReference] : undefined,
                    appointmentType: {
                        text: visitType,
                    },
                    serviceCategory: slot === null || slot === void 0 ? void 0 : slot.serviceCategory,
                    description: reasonForVisit,
                    status: initialAppointmentStatus,
                    created: (_f = now.toISO()) !== null && _f !== void 0 ? _f : '',
                    extension: apptExtensions,
                };
                encUrl = "urn:uuid:".concat((0, short_uuid_1.uuid)());
                encResource = {
                    resourceType: 'Encounter',
                    status: initialEncounterStatus,
                    statusHistory: [
                        {
                            status: initialEncounterStatus,
                            period: {
                                start: nowIso,
                            },
                        },
                    ],
                    // todo double check this is the correct classification
                    class: (0, helpers_1.getEncounterClass)(serviceMode),
                    subject: { reference: patientRef },
                    appointment: [
                        {
                            reference: apptUrl,
                        },
                    ],
                    location: scheduleOwner.resourceType === 'Location'
                        ? [
                            {
                                location: {
                                    reference: "Location/".concat(scheduleOwner.id),
                                },
                            },
                        ]
                        : [],
                    extension: encExtensions,
                };
                return [4 /*yield*/, (0, helpers_1.getRelatedResources)(oystehr, patient === null || patient === void 0 ? void 0 : patient.id)];
            case 1:
                _b = _j.sent(), documents = _b.documents, accountInfo = _b.accountInfo;
                patientToUse = patient !== null && patient !== void 0 ? patient : createPatientRequest === null || createPatientRequest === void 0 ? void 0 : createPatientRequest.resource;
                if (patient !== undefined) {
                    currentPatientAccount = accountInfo === null || accountInfo === void 0 ? void 0 : accountInfo.account;
                }
                item = (0, utils_1.makePrepopulatedItemsForPatient)({
                    patient: patientToUse,
                    isNewQrsPatient: (createPatientRequest === null || createPatientRequest === void 0 ? void 0 : createPatientRequest.resource) !== undefined,
                    verifiedPhoneNumber: verifiedPhoneNumber,
                    contactInfo: contactInfo,
                    newPatientDob: newPatientDob,
                    unconfirmedDateOfBirth: unconfirmedDateOfBirth,
                    appointmentStartTime: startTime,
                    appointmentServiceCategory: (_h = (_g = (0, utils_1.getCoding)(slot === null || slot === void 0 ? void 0 : slot.serviceCategory, utils_1.SERVICE_CATEGORY_SYSTEM)) === null || _g === void 0 ? void 0 : _g.code) !== null && _h !== void 0 ? _h : '',
                    reasonForVisit: reasonForVisit,
                    questionnaire: questionnaire,
                    documents: documents,
                    accountInfo: accountInfo,
                });
                console.log('prepopulated items for patient questionnaire response before adding previous response', JSON.stringify(item));
                questionnaireResponseResource = {
                    resourceType: 'QuestionnaireResponse',
                    questionnaire: "".concat(questionnaire.url, "|").concat(questionnaire.version),
                    status: 'in-progress',
                    subject: { reference: patientRef },
                    encounter: { reference: encUrl },
                    item: item,
                };
                postQuestionnaireResponseRequest = {
                    method: 'POST',
                    url: '/QuestionnaireResponse',
                    resource: questionnaireResponseResource,
                };
                postApptReq = {
                    method: 'POST',
                    url: '/Appointment',
                    resource: apptResource,
                    fullUrl: apptUrl,
                };
                postEncRequest = {
                    method: 'POST',
                    url: '/Encounter',
                    resource: encResource,
                    fullUrl: encUrl,
                };
                patientRequests = [];
                if (updatePatientRequest) {
                    patientRequests.push(updatePatientRequest);
                }
                if (createPatientRequest) {
                    patientRequests.push(createPatientRequest);
                }
                confirmationTextTask = (0, utils_1.getTaskResource)(utils_1.TaskIndicator.confirmationMessages, apptUrl);
                taskRequest = {
                    method: 'POST',
                    url: '/Task',
                    resource: confirmationTextTask,
                };
                postAccountRequests = [];
                if (createPatientRequest === null || createPatientRequest === void 0 ? void 0 : createPatientRequest.fullUrl) {
                    accountResource = {
                        resourceType: 'Account',
                        status: 'active',
                        type: __assign({}, utils_1.PATIENT_BILLING_ACCOUNT_TYPE),
                        subject: [{ reference: createPatientRequest.fullUrl }],
                    };
                    postAccountRequests.push({
                        method: 'POST',
                        url: '/Account',
                        resource: accountResource,
                    });
                }
                else if (patient && currentPatientAccount === undefined) {
                    accountResource = {
                        resourceType: 'Account',
                        status: 'active',
                        type: __assign({}, utils_1.PATIENT_BILLING_ACCOUNT_TYPE),
                        subject: [{ reference: "Patient/".concat(patient.id) }],
                    };
                    postAccountRequests.push({
                        method: 'POST',
                        url: '/Account',
                        resource: accountResource,
                    });
                }
                transactionInput = {
                    requests: __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], patientRequests, true), listRequests, true), postAccountRequests, true), postSlotRequests, true), patchSlotRequests, true), [
                        postApptReq,
                        postEncRequest,
                        postQuestionnaireResponseRequest,
                        taskRequest,
                    ], false),
                };
                console.log('making transaction request');
                return [4 /*yield*/, oystehr.fhir.transaction(transactionInput)];
            case 2:
                bundle = _j.sent();
                resources = extractResourcesFromBundle(bundle);
                return [2 /*return*/, resources];
        }
    });
}); };
exports.performTransactionalFhirRequests = performTransactionalFhirRequests;
var extractResourcesFromBundle = function (bundle) {
    var _a, _b, _c, _d, _e;
    console.log('getting resources from bundle');
    var entry = (_a = bundle.entry) !== null && _a !== void 0 ? _a : [];
    var appointment = (_b = entry.find(function (appt) {
        return appt.resource && appt.resource.resourceType === 'Appointment';
    })) === null || _b === void 0 ? void 0 : _b.resource;
    var encounter = (_c = entry.find(function (enc) {
        return enc.resource && enc.resource.resourceType === 'Encounter';
    })) === null || _c === void 0 ? void 0 : _c.resource;
    var patient = (_d = entry.find(function (enc) {
        return enc.resource && enc.resource.resourceType === 'Patient';
    })) === null || _d === void 0 ? void 0 : _d.resource;
    var questionnaireResponse = (_e = entry.find(function (entry) {
        return entry.resource && entry.resource.resourceType === 'QuestionnaireResponse';
    })) === null || _e === void 0 ? void 0 : _e.resource;
    if (appointment === undefined) {
        throw new Error('Appointment could not be created');
    }
    if (encounter === undefined) {
        throw new Error('Encounter could not be created');
    }
    if (patient === undefined) {
        throw new Error('Patient could not be found');
    }
    if (questionnaireResponse === undefined) {
        throw new Error('QuestionnaireResponse could not be created');
    }
    if (questionnaireResponse.id === undefined) {
        throw new Error('QuestionnaireResponse does not have an ID');
    }
    console.log('successfully obtained resources from bundle');
    return {
        appointment: appointment,
        encounter: encounter,
        patient: patient,
        questionnaire: questionnaireResponse,
        questionnaireResponseId: questionnaireResponse.id,
    };
};
var injectMetadataIfNeeded = function (maybeMetadata) {
    var _a, _b, _c;
    var appointmentMetadata = maybeMetadata;
    console.log('PLAYWRIGHT_SUITE_ID: ', process.env.PLAYWRIGHT_SUITE_ID);
    var shouldInjectTestMetadata = (_a = process.env.PLAYWRIGHT_SUITE_ID) !== null && _a !== void 0 ? _a : false;
    if (maybeMetadata && shouldInjectTestMetadata) {
        var hasTestTagAlready = (_c = (_b = maybeMetadata.tag) === null || _b === void 0 ? void 0 : _b.some(function (coding) {
            return coding.system === utils_1.E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM;
        })) !== null && _c !== void 0 ? _c : false;
        shouldInjectTestMetadata = !hasTestTagAlready;
    }
    if (shouldInjectTestMetadata) {
        appointmentMetadata = {
            tag: [
                {
                    system: utils_1.E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
                    code: process.env.PLAYWRIGHT_SUITE_ID,
                },
            ],
        };
        console.log('using test metadata: ', JSON.stringify(appointmentMetadata, null, 2));
    }
    return appointmentMetadata;
};
