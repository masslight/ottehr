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
var aws_serverless_1 = require("@sentry/aws-serverless");
var utils_1 = require("utils");
var helpers_1 = require("../../patient/appointment/get-visit-details/helpers");
var shared_1 = require("../../shared");
var get_video_resources_1 = require("../../shared/pdf/visit-details-pdf/get-video-resources");
var make_visit_note_pdf_document_reference_1 = require("../../shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference");
var visit_note_pdf_creation_1 = require("../../shared/pdf/visit-details-pdf/visit-note-pdf-creation");
var get_chart_data_1 = require("../get-chart-data");
var shared_2 = require("../schedules/shared");
var fhir_utils_1 = require("./helpers/fhir-utils");
var helpers_2 = require("./helpers/helpers");
var payments_1 = require("./helpers/payments");
var validateRequestParameters_1 = require("./validateRequestParameters");
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
var ZAMBDA_NAME = 'change-telemed-appointment-status';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, oystehr, oystehrCurrentUser, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, validatedParameters.secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, validatedParameters.secrets);
                oystehrCurrentUser = (0, shared_1.createOystehrClient)(validatedParameters.userToken, validatedParameters.secrets);
                console.log('Created Oystehr client');
                return [4 /*yield*/, (0, exports.performEffect)(oystehr, oystehrCurrentUser, validatedParameters)];
            case 2:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _a.sent();
                console.error('Stringified error: ' + JSON.stringify(error_1));
                console.error('Error: ' + error_1);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets))];
            case 4: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (oystehr, oystehrCurrentUser, params) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentId, newStatus, secrets, visitResources, encounter, patient, account, chargeItem, questionnaireResponse, appointment, location, listResources, insuranceCompanyID, _a, paymentOption, selfPayVisit, currentStatus, myPractitionerId, ENVIRONMENT, createResourcesRequests, chartDataPromise, additionalChartDataPromise, _b, chartData, additionalChartData, pdfInfo, error_2, candidEncounterId, error_3, organizationId, transactionBundle, resources, newChargeItem, chargeOutcome, paymentInfo, pdfInfo, resources, _c, emailClient, emailEnabled, patientEmail, locationName, presignedUrls, visitNoteUrl, templateData;
    var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    return __generator(this, function (_p) {
        switch (_p.label) {
            case 0:
                appointmentId = params.appointmentId, newStatus = params.newStatus, secrets = params.secrets;
                return [4 /*yield*/, (0, get_video_resources_1.getAppointmentAndRelatedResources)(oystehr, appointmentId)];
            case 1:
                visitResources = _p.sent();
                if (!visitResources) {
                    {
                        throw new Error("Visit resources are not properly defined for appointment ".concat(appointmentId));
                    }
                }
                encounter = visitResources.encounter, patient = visitResources.patient, account = visitResources.account, chargeItem = visitResources.chargeItem, questionnaireResponse = visitResources.questionnaireResponse, appointment = visitResources.appointment, location = visitResources.location, listResources = visitResources.listResources;
                if (!patient) {
                    throw new Error("No patient has been found for appointment ".concat(appointmentId));
                }
                insuranceCompanyID = (_e = (_d = (0, utils_1.getQuestionnaireResponseByLinkId)('insurance-carrier', questionnaireResponse)) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0].valueString;
                if (!insuranceCompanyID) return [3 /*break*/, 3];
                _a = visitResources;
                return [4 /*yield*/, (0, fhir_utils_1.getInsurancePlan)(oystehr, insuranceCompanyID)];
            case 2:
                _a.insurancePlan = _p.sent();
                _p.label = 3;
            case 3:
                console.log("Checking different ids here. Account id: ".concat((_f = visitResources.account) === null || _f === void 0 ? void 0 : _f.id, ". Encounter id: ").concat(encounter.id, ". Patient id: ").concat(patient === null || patient === void 0 ? void 0 : patient.id, ". Charge item id: ").concat(chargeItem === null || chargeItem === void 0 ? void 0 : chargeItem.id, ". Account id: ").concat(account === null || account === void 0 ? void 0 : account.id));
                paymentOption = ((_j = (_h = (_g = (0, utils_1.getQuestionnaireResponseByLinkId)('payment-option', questionnaireResponse)) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString) || '';
                selfPayVisit = paymentOption.toUpperCase() === 'self-pay'.toUpperCase();
                if (((_k = encounter === null || encounter === void 0 ? void 0 : encounter.subject) === null || _k === void 0 ? void 0 : _k.reference) === undefined) {
                    throw new Error("No subject reference defined for encounter ".concat(encounter === null || encounter === void 0 ? void 0 : encounter.id));
                }
                console.log("appointment and encounter statuses: ".concat(appointment.status, ", ").concat(encounter.status));
                currentStatus = (0, utils_1.getTelemedVisitStatus)(encounter.status, appointment.status);
                if (!currentStatus) return [3 /*break*/, 6];
                return [4 /*yield*/, (0, shared_1.getMyPractitionerId)(oystehrCurrentUser)];
            case 4:
                myPractitionerId = _p.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, secrets);
                return [4 /*yield*/, (0, helpers_2.changeStatusIfPossible)(oystehr, visitResources, currentStatus, newStatus, myPractitionerId, ENVIRONMENT)];
            case 5:
                _p.sent();
                _p.label = 6;
            case 6:
                console.debug("Status has been changed.");
                if (!(newStatus === utils_1.TelemedAppointmentStatusEnum.complete && currentStatus === utils_1.TelemedAppointmentStatusEnum.unsigned)) return [3 /*break*/, 29];
                createResourcesRequests = [];
                console.debug("Status change detected from ".concat(currentStatus, " to ").concat(newStatus));
                chartDataPromise = (0, get_chart_data_1.getChartData)(oystehr, m2mToken, visitResources.encounter.id);
                additionalChartDataPromise = (0, get_chart_data_1.getChartData)(oystehr, m2mToken, visitResources.encounter.id, utils_1.telemedProgressNoteChartDataRequestedFields);
                return [4 /*yield*/, Promise.all([chartDataPromise, additionalChartDataPromise])];
            case 7:
                _b = (_p.sent()).map(function (promise) { return promise.response; }), chartData = _b[0], additionalChartData = _b[1];
                console.log('Chart data received');
                _p.label = 8;
            case 8:
                _p.trys.push([8, 11, , 12]);
                return [4 /*yield*/, (0, visit_note_pdf_creation_1.composeAndCreateVisitNotePdf)({ chartData: chartData, additionalChartData: additionalChartData }, visitResources, secrets, m2mToken)];
            case 9:
                pdfInfo = _p.sent();
                if (!(patient === null || patient === void 0 ? void 0 : patient.id))
                    throw new Error("No patient has been found for encounter: ".concat(encounter.id));
                console.log("Creating visit note pdf docRef");
                return [4 /*yield*/, (0, make_visit_note_pdf_document_reference_1.makeVisitNotePdfDocumentReference)(oystehr, pdfInfo, patient.id, appointmentId, encounter.id, listResources)];
            case 10:
                _p.sent();
                return [3 /*break*/, 12];
            case 11:
                error_2 = _p.sent();
                console.error("Error creating visit note pdf: ".concat(error_2));
                (0, aws_serverless_1.captureException)(error_2, {
                    tags: {
                        appointmentId: appointmentId,
                        encounterId: encounter.id,
                    },
                });
                return [3 /*break*/, 12];
            case 12:
                candidEncounterId = void 0;
                _p.label = 13;
            case 13:
                _p.trys.push([13, 15, , 16]);
                if (!secrets)
                    throw new Error('Secrets are not defined, cannot create Candid encounter.');
                console.log('[CLAIM SUBMISSION] Attempting to create telemed encounter in candid...');
                return [4 /*yield*/, (0, shared_1.createEncounterFromAppointment)(visitResources, secrets, oystehr)];
            case 14:
                candidEncounterId = _p.sent();
                return [3 /*break*/, 16];
            case 15:
                error_3 = _p.sent();
                console.error("Error creating Candid encounter: ".concat(error_3, ", stringified error: ").concat(JSON.stringify(error_3)));
                (0, aws_serverless_1.captureException)(error_3, {
                    tags: {
                        appointmentId: appointmentId,
                        encounterId: encounter.id,
                    },
                });
                return [3 /*break*/, 16];
            case 16:
                console.log("[CLAIM SUBMISSION] Candid telemed encounter created with ID ".concat(candidEncounterId));
                return [4 /*yield*/, addCandidEncounterIdToEncounter(candidEncounterId, encounter, oystehr)];
            case 17:
                _p.sent();
                // if this is a self-pay encounter, create a charge item
                if (selfPayVisit) {
                    if (((_l = visitResources.account) === null || _l === void 0 ? void 0 : _l.id) === undefined) {
                        // TODO: add sentry notification: something is misconfigured
                        console.error("No account has been found associated with the a self-pay visit for encounter ".concat((_m = visitResources.encounter) === null || _m === void 0 ? void 0 : _m.id));
                    }
                    // see if charge item already exists for the encounter and if not, create it
                    if (chargeItem === undefined) {
                        console.debug("There is no existing charge item for encounter ".concat(visitResources.encounter.id, ", so creating one."));
                        organizationId = (0, utils_1.getSecret)(utils_1.SecretsKeys.ORGANIZATION_ID, params.secrets);
                        createResourcesRequests.push((0, shared_1.saveResourceRequest)((0, helpers_2.makeAppointmentChargeItem)(encounter, organizationId, account)));
                    }
                }
                console.log('before creating resources');
                if (!(createResourcesRequests.length > 0)) return [3 /*break*/, 19];
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: createResourcesRequests,
                    })];
            case 18:
                transactionBundle = _p.sent();
                resources = (0, shared_1.parseCreatedResourcesBundle)(transactionBundle);
                console.log("createdResources: ".concat(JSON.stringify(resources)));
                if (selfPayVisit) {
                    newChargeItem = resources.find(function (res) { return res.resourceType === 'ChargeItem'; });
                    if (newChargeItem === undefined) {
                        // TODO: add sentry notification: something is misconfigured, need a charge item for a charge to be made
                        console.error("Unable to create a charge item for appointment ".concat(appointmentId, ", encounter ").concat(visitResources.encounter.id));
                    }
                    else {
                        console.log("Charge item ".concat(newChargeItem.id, " has been created."));
                    }
                }
                _p.label = 19;
            case 19:
                if (!selfPayVisit) return [3 /*break*/, 26];
                _p.label = 20;
            case 20:
                _p.trys.push([20, 25, , 26]);
                return [4 /*yield*/, (0, payments_1.postChargeIssueRequest)((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, params.secrets), m2mToken, visitResources.encounter.id)];
            case 21:
                chargeOutcome = _p.sent();
                console.log("Charge outcome: ".concat(JSON.stringify(chargeOutcome)));
                return [4 /*yield*/, (0, payments_1.getPaymentDataRequest)((0, utils_1.getSecret)(utils_1.SecretsKeys.PROJECT_API, params.secrets), m2mToken, visitResources.encounter.id)];
            case 22:
                paymentInfo = _p.sent();
                return [4 /*yield*/, (0, payments_1.composeAndCreateReceiptPdf)(paymentInfo, chartData, visitResources, secrets, m2mToken)];
            case 23:
                pdfInfo = _p.sent();
                if (!(patient === null || patient === void 0 ? void 0 : patient.id))
                    throw new Error("No patient has been found for encounter: ".concat(encounter.id));
                return [4 /*yield*/, (0, helpers_2.makeReceiptPdfDocumentReference)(oystehr, pdfInfo, patient.id, encounter.id, listResources)];
            case 24:
                resources = _p.sent();
                console.log("createdResources: ".concat(JSON.stringify(resources)));
                return [3 /*break*/, 26];
            case 25:
                _c = _p.sent();
                console.error('Error issuing a charge for self-pay encounter.');
                (0, aws_serverless_1.captureException)(Error, {
                    tags: {
                        appointmentId: appointmentId,
                        encounterId: encounter.id,
                    },
                });
                return [3 /*break*/, 26];
            case 26:
                emailClient = (0, shared_1.getEmailClient)(secrets);
                emailEnabled = emailClient.getFeatureFlag();
                patientEmail = (0, utils_1.getPatientContactEmail)(patient);
                if (!(emailEnabled && location && patientEmail)) return [3 /*break*/, 29];
                locationName = (_o = (0, shared_2.getNameForOwner)(location)) !== null && _o !== void 0 ? _o : '';
                return [4 /*yield*/, (0, helpers_1.getPresignedURLs)(oystehr, m2mToken, visitResources.encounter.id)];
            case 27:
                presignedUrls = _p.sent();
                visitNoteUrl = presignedUrls['visit-note'].presignedUrl;
                templateData = {
                    location: locationName,
                    'visit-note-url': visitNoteUrl || '',
                };
                return [4 /*yield*/, emailClient.sendVirtualCompletionEmail(patientEmail, templateData)];
            case 28:
                _p.sent();
                _p.label = 29;
            case 29: return [2 /*return*/, {
                    message: selfPayVisit
                        ? 'Appointment status successfully changed and appropriate charged issued.'
                        : 'Appointment status successfully changed.',
                }];
        }
    });
}); };
exports.performEffect = performEffect;
var addCandidEncounterIdToEncounter = function (candidEncounterId, encounter, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var encounterId, identifier;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                encounterId = encounter.id;
                if (candidEncounterId == null || encounterId == null) {
                    return [2 /*return*/];
                }
                identifier = {
                    system: shared_1.CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
                    value: candidEncounterId,
                };
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Encounter',
                        id: encounterId,
                        operations: [
                            {
                                op: 'add',
                                path: encounter.identifier != null ? '/identifier/-' : '/identifier',
                                value: encounter.identifier != null ? identifier : [identifier],
                            },
                        ],
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
