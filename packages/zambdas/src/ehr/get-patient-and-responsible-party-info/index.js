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
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var harvest_1 = require("../shared/harvest");
var validateRequestParameters_1 = require("./validateRequestParameters");
var m2mToken;
var ZAMBDA_NAME = 'get-patient-and-responsible-party-info';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, secrets, patientId, oystehr, patientResources, response, error_1, ENVIRONMENT;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 3, , 5]);
                _a = (0, validateRequestParameters_1.validateRequestParameters)(input), secrets = _a.secrets, patientId = _a.patientId;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _b.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, getAndValidateFhirResources(oystehr, patientId)];
            case 2:
                patientResources = _b.sent();
                response = complexValidation(patientResources);
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(response),
                    }];
            case 3:
                error_1 = _b.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                console.error('Error occurred:', error_1);
                return [4 /*yield*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 4: return [2 /*return*/, _b.sent()];
            case 5: return [2 /*return*/];
        }
    });
}); });
function getAndValidateFhirResources(oystehr, patientId) {
    return __awaiter(this, void 0, void 0, function () {
        var resourcesResponse, resources, patient, accounts, billingAccount, relatedPerson, patientPhoneNumber, responsibleParty;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🔍 Fetching FHIR resources for invoiceable patients...');
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Patient',
                            params: [
                                {
                                    name: '_id',
                                    value: patientId,
                                },
                                {
                                    name: '_revinclude',
                                    value: 'Account:patient',
                                },
                                {
                                    name: '_revinclude',
                                    value: 'RelatedPerson:patient',
                                },
                            ],
                        })];
                case 1:
                    resourcesResponse = _a.sent();
                    resources = resourcesResponse.unbundle();
                    console.log('Fetched FHIR resources:', resources.length);
                    patient = resources.find(function (resource) { return resource.resourceType === 'Patient'; });
                    accounts = resources.filter(function (resource) { return resource.resourceType === 'Account'; });
                    billingAccount = accounts.find(function (account) { return (0, harvest_1.accountMatchesType)(account, utils_1.PATIENT_BILLING_ACCOUNT_TYPE); });
                    relatedPerson = resources.find(function (resource) {
                        var _a;
                        return resource.resourceType === 'RelatedPerson' &&
                            ((_a = resource.relationship) === null || _a === void 0 ? void 0 : _a.find(function (relationship) { var _a; return (_a = relationship.coding) === null || _a === void 0 ? void 0 : _a.find(function (code) { return code.code === 'user-relatedperson'; }); }));
                    });
                    if (!patient)
                        throw utils_1.PATIENT_NOT_FOUND_ERROR;
                    if (!billingAccount)
                        throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Account');
                    if (!relatedPerson)
                        throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND_CUSTOM)('RelatedPerson or Patient resource was not found as responsible party');
                    patientPhoneNumber = (0, utils_1.getSMSNumberForIndividual)(relatedPerson);
                    if (!patientPhoneNumber)
                        throw utils_1.PATIENT_PHONE_NOT_FOUND_ERROR;
                    responsibleParty = (0, utils_1.getResponsiblePartyFromAccount)(billingAccount, resources);
                    if (!responsibleParty)
                        throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND_CUSTOM)("Responsible party (fhir RelatedPerson) not found for account: ".concat(billingAccount.id));
                    return [2 /*return*/, { patient: patient, responsibleParty: responsibleParty, patientPhoneNumber: patientPhoneNumber }];
            }
        });
    });
}
function complexValidation(patientResources) {
    var _a, _b;
    var patient = patientResources.patient, responsibleParty = patientResources.responsibleParty, patientPhoneNumber = patientResources.patientPhoneNumber;
    var patientName = (0, utils_1.getFullName)(patient);
    var patientDob = (patient === null || patient === void 0 ? void 0 : patient.birthDate)
        ? (_b = (_a = luxon_1.DateTime.fromISO(patient.birthDate)) === null || _a === void 0 ? void 0 : _a.toFormat('MM/dd/yyyy')) === null || _b === void 0 ? void 0 : _b.toString()
        : undefined;
    var patientGenderLabel = (patient === null || patient === void 0 ? void 0 : patient.gender) && utils_1.mapGenderToLabel[patient.gender];
    var responsiblePartyName = (0, utils_1.getFullName)(responsibleParty);
    var responsiblePartyPhoneNumber = (0, utils_1.getPhoneNumberForIndividual)(responsibleParty);
    var responsiblePartyEmail = (0, utils_1.getEmailForIndividual)(responsibleParty);
    if (!patientDob)
        throw (0, utils_1.RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR)('DOB was not found for patient');
    if (!responsiblePartyEmail)
        throw (0, utils_1.RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR)('Email was not found for responsible party');
    if (!patientGenderLabel)
        throw (0, utils_1.RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR)('Gender was not found for patient');
    return {
        patient: {
            fullName: patientName,
            dob: patientDob,
            gender: patientGenderLabel,
            phoneNumber: patientPhoneNumber,
        },
        responsibleParty: {
            fullName: responsiblePartyName,
            email: responsiblePartyEmail,
            phoneNumber: responsiblePartyPhoneNumber,
        },
    };
}
