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
var shared_1 = require("../../../shared");
var make_visit_details_document_reference_1 = require("../../../shared/pdf/make-visit-details-document-reference");
var visit_details_pdf_1 = require("../../../shared/pdf/visit-details-pdf");
var get_video_resources_1 = require("../../../shared/pdf/visit-details-pdf/get-video-resources");
var helpers_1 = require("../../patient-payments/helpers");
var harvest_1 = require("../../shared/harvest");
var get_visit_files_1 = require("../get-visit-files");
var validateRequestParameters_1 = require("./validateRequestParameters");
var ZAMBDA_NAME = 'visit-details-to-pdf';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, appointmentId, timezone, secrets, oystehr, response, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log("".concat(ZAMBDA_NAME, " started, input: ").concat(JSON.stringify(input)));
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                appointmentId = validatedParameters.appointmentId, timezone = validatedParameters.timezone, secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                console.log('Created Oystehr client');
                return [4 /*yield*/, (0, exports.performEffect)(oystehr, appointmentId, secrets, timezone)];
            case 3:
                response = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 4:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('visit-details-to-pdf', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (oystehr, appointmentId, secrets, timezone) { return __awaiter(void 0, void 0, void 0, function () {
    var visitResources, appointment, encounter, patient, location, resourceTimezone, listResources, questionnaireResponse, effectiveTimezone, _a, consentResources, accountResources, documentReferences, consents, account, coverages, insuranceOrgs, guarantorResource, emergencyContactResource, employerOrganization, primaryCarePhysician, payments, stripeClient, error_2, pharmacy, _b, pdfInfo, attached, documentReference, visitDetailsDocumentId;
    var _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0: return [4 /*yield*/, (0, get_video_resources_1.getAppointmentAndRelatedResources)(oystehr, appointmentId, true)];
            case 1:
                visitResources = _h.sent();
                if (!visitResources) {
                    {
                        throw new Error("Visit resources are not properly defined for appointment ".concat(appointmentId));
                    }
                }
                appointment = visitResources.appointment, encounter = visitResources.encounter, patient = visitResources.patient, location = visitResources.location, resourceTimezone = visitResources.timezone, listResources = visitResources.listResources, questionnaireResponse = visitResources.questionnaireResponse;
                effectiveTimezone = timezone !== null && timezone !== void 0 ? timezone : resourceTimezone;
                if (!(patient === null || patient === void 0 ? void 0 : patient.id)) {
                    throw new Error("Patient data is missing for appointment ".concat(appointmentId));
                }
                console.log('Chart data received');
                return [4 /*yield*/, Promise.all([
                        (0, utils_1.getConsentAndRelatedDocRefsForAppointment)({ appointmentId: appointmentId, patientId: patient.id }, oystehr),
                        (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patient.id, oystehr),
                        (0, get_visit_files_1.searchDocumentReferencesForVisit)(oystehr, patient.id, appointmentId),
                    ])];
            case 2:
                _a = _h.sent(), consentResources = _a[0], accountResources = _a[1], documentReferences = _a[2];
                consents = consentResources.consents;
                account = accountResources.account, coverages = accountResources.coverages, insuranceOrgs = accountResources.insuranceOrgs, guarantorResource = accountResources.guarantorResource, emergencyContactResource = accountResources.emergencyContactResource, employerOrganization = accountResources.employerOrganization;
                primaryCarePhysician = (_d = (_c = accountResources.patient) === null || _c === void 0 ? void 0 : _c.contained) === null || _d === void 0 ? void 0 : _d.find(function (resource) { return resource.resourceType === 'Practitioner' && resource.active === true; });
                payments = [];
                if (!(encounter.id && account)) return [3 /*break*/, 6];
                _h.label = 3;
            case 3:
                _h.trys.push([3, 5, , 6]);
                stripeClient = (0, shared_1.getStripeClient)(secrets);
                return [4 /*yield*/, (0, helpers_1.getPaymentsForEncounter)({
                        oystehrClient: oystehr,
                        stripeClient: stripeClient,
                        account: account,
                        encounterId: encounter.id,
                        patientId: patient.id,
                    })];
            case 4:
                payments = _h.sent();
                return [3 /*break*/, 6];
            case 5:
                error_2 = _h.sent();
                console.error('Failed to fetch payments for PDF generation:', error_2);
                try {
                    (0, utils_1.checkForStripeCustomerDeletedError)(error_2);
                }
                catch (customerError) {
                    console.error("Error: Stripe customer deleted, PDF will be generated without payment info. ".concat(customerError));
                }
                payments = [];
                return [3 /*break*/, 6];
            case 6:
                pharmacy = (_f = (_e = accountResources.patient) === null || _e === void 0 ? void 0 : _e.contained) === null || _f === void 0 ? void 0 : _f.find(function (resource) { return resource.resourceType === 'Organization' && resource.id === harvest_1.PATIENT_CONTAINED_PHARMACY_ID; });
                return [4 /*yield*/, (0, visit_details_pdf_1.createVisitDetailsPdf)({
                        patient: patient,
                        emergencyContactResource: emergencyContactResource,
                        employerOrganization: employerOrganization,
                        appointment: appointment,
                        encounter: encounter,
                        location: location,
                        timezone: effectiveTimezone,
                        physician: primaryCarePhysician,
                        pharmacy: pharmacy,
                        coverages: coverages,
                        insuranceOrgs: insuranceOrgs,
                        guarantorResource: guarantorResource,
                        documents: documentReferences || [],
                        consents: consents || [],
                        questionnaireResponse: questionnaireResponse,
                        payments: payments,
                    }, secrets, m2mToken)];
            case 7:
                _b = _h.sent(), pdfInfo = _b.pdfInfo, attached = _b.attached;
                console.log("Creating Visit details PDF Document Reference");
                return [4 /*yield*/, (0, make_visit_details_document_reference_1.makeVisitDetailsPdfDocumentReference)(oystehr, pdfInfo, patient.id, appointmentId, encounter.id, listResources, attached)];
            case 8:
                documentReference = _h.sent();
                visitDetailsDocumentId = (_g = documentReference.id) !== null && _g !== void 0 ? _g : '';
                return [2 /*return*/, {
                        documentReference: "DocumentReference/".concat(visitDetailsDocumentId),
                    }];
        }
    });
}); };
exports.performEffect = performEffect;
