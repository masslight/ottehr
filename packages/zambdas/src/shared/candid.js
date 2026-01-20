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
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeBusinessIdentifierForCandidPayment = exports.CANDID_PAYMENT_ID_SYSTEM = exports.performCandidPreEncounterSync = exports.CANDID_NON_INSURANCE_PAYER_ID_IDENTIFIER_SYSTEM = exports.CANDID_PATIENT_ID_IDENTIFIER_SYSTEM = exports.CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM = exports.CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM = void 0;
exports.createAppointment = createAppointment;
exports.createEncounterFromAppointment = createEncounterFromAppointment;
exports.getCandidEncounterIdFromEncounter = getCandidEncounterIdFromEncounter;
exports.mapMedicationToCandidMeasurement = mapMedicationToCandidMeasurement;
// cSpell:ignore Providerid
var candidhealth_1 = require("candidhealth");
var api_1 = require("candidhealth/api");
var v2_1 = require("candidhealth/api/resources/contracts/resources/v2");
var v4_1 = require("candidhealth/api/resources/encounters/resources/v4");
var preEncounter_1 = require("candidhealth/api/resources/preEncounter");
var Sex_1 = require("candidhealth/api/resources/preEncounter/resources/common/types/Sex");
var v2_2 = require("candidhealth/api/resources/serviceLines/resources/v2");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var rcm_1 = require("utils/lib/helpers/rcm");
var harvest_1 = require("../ehr/shared/harvest");
var chart_data_1 = require("./chart-data");
var helpers_1 = require("./helpers");
exports.CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM = 'https://api.joincandidhealth.com/api/encounters/v4/response/encounter_id';
exports.CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM = 'https://pre-api.joincandidhealth.com/appointments/v1/response/appointment_id';
exports.CANDID_PATIENT_ID_IDENTIFIER_SYSTEM = 'https://api.joincandidhealth.com/api/patients/v4/response/patient_id';
exports.CANDID_NON_INSURANCE_PAYER_ID_IDENTIFIER_SYSTEM = 'https://api.joincandidhealth.com/api/non-insurance-payers/v1/response/non_insurance_payer_id';
var CANDID_TAG_WORKERS_COMP = 'workers-comp';
var CANDID_TAG_OCCUPATIONAL_MEDICINE = 'occupational-medicine';
var candidApiClient;
var STUB_BILLING_PROVIDER_DATA = {
    organizationName: 'StubBillingProvider',
    npi: '0000000000',
    taxId: '000000000',
    addressLine: 'stub address line',
    city: 'Stub city',
    state: 'CA',
    zipCode: '00000',
    zipPlusFourCode: '0000',
};
var SERVICE_FACILITY_LOCATION_STATE = 'CA';
var SERVICE_FACILITY_LOCATION = {
    resourceType: 'Location',
    name: 'ServiceFacilityName',
    address: {
        line: ['ServiceFacilityAddressLine'],
        city: 'ServiceFacilityCity',
        state: SERVICE_FACILITY_LOCATION_STATE,
        postalCode: '54321',
    },
    extension: [
        {
            url: rcm_1.CODE_SYSTEM_CMS_PLACE_OF_SERVICE,
            valueString: '20',
        },
    ],
};
function createCandidApiClient(secrets) {
    if (candidApiClient == null) {
        candidApiClient = new candidhealth_1.CandidApiClient({
            clientId: (0, utils_1.getSecret)(utils_1.SecretsKeys.CANDID_CLIENT_ID, secrets),
            clientSecret: (0, utils_1.getSecret)(utils_1.SecretsKeys.CANDID_CLIENT_SECRET, secrets),
            environment: (0, utils_1.getSecret)(utils_1.SecretsKeys.CANDID_ENV, secrets) === 'PROD'
                ? candidhealth_1.CandidApiEnvironment.Production
                : candidhealth_1.CandidApiEnvironment.Staging,
        });
    }
    return candidApiClient;
}
var createCandidCreateEncounterInput = function (visitResources, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var encounter, patient, encounterId, _a, coverages, insuranceOrgs, coverage, coverageSubscriber, coveragePayor, _b, appointment, location, practitionerId, practitioner, medications;
    var _c;
    var _d, _e, _f, _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                encounter = visitResources.encounter, patient = visitResources.patient;
                encounterId = encounter.id;
                if (!(patient === null || patient === void 0 ? void 0 : patient.id)) {
                    throw new Error("Patient id is not defined for encounter ".concat(encounterId));
                }
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(patient.id, oystehr)];
            case 1:
                _a = _j.sent(), coverages = _a.coverages, insuranceOrgs = _a.insuranceOrgs;
                coverage = coverages.primary;
                coverageSubscriber = coverages.primarySubscriber;
                coveragePayor = insuranceOrgs.find(function (insuranceOrg) { var _a; return "Organization/".concat(insuranceOrg.id) === ((_a = coverage === null || coverage === void 0 ? void 0 : coverage.payor[0]) === null || _a === void 0 ? void 0 : _a.reference); });
                if (coverage && (!coverageSubscriber || !coveragePayor)) {
                    throw utils_1.MISSING_PATIENT_COVERAGE_INFO_ERROR;
                }
                if (!encounter.id) {
                    throw new Error("Encounter id is not defined for encounter ".concat(encounterId, " in createCandidCreateEncounterInput"));
                }
                return [4 /*yield*/, fetchFHIRPatientAndAppointmentFromEncounter(encounter.id, oystehr)];
            case 2:
                _b = _j.sent(), appointment = _b.appointment, location = _b.location;
                practitionerId = (0, utils_1.getAttendingPractitionerId)(encounter);
                practitioner = null;
                if (practitionerId) {
                    practitioner = (_e = (_d = visitResources.practitioners) === null || _d === void 0 ? void 0 : _d.find(function (practitioner) { return practitioner.id === practitionerId; })) !== null && _e !== void 0 ? _e : null;
                }
                if (!practitioner) {
                    practitioner = (_g = (_f = visitResources.practitioners) === null || _f === void 0 ? void 0 : _f[0]) !== null && _g !== void 0 ? _g : null;
                }
                return [4 /*yield*/, getMedicationAdministrationsForEncounter(oystehr, encounter.id, {
                        statuses: ['administered', 'administered-partly'],
                    })];
            case 3:
                medications = _j.sent();
                _c = {
                    appointment: appointment,
                    location: location,
                    encounter: encounter,
                    patient: (0, helpers_1.assertDefined)(visitResources.patient, "Patient on encounter ".concat(encounterId)),
                    practitioner: (0, helpers_1.assertDefined)(practitioner, "Practitioner on encounter ".concat(encounterId))
                };
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Condition',
                        params: [
                            {
                                name: 'encounter',
                                value: "Encounter/".concat(encounterId),
                            },
                        ],
                    })];
            case 4:
                _c.diagnoses = (_j.sent())
                    .unbundle()
                    .filter(function (condition) {
                    var _a;
                    return ((_a = encounter.diagnosis) === null || _a === void 0 ? void 0 : _a.find(function (diagnosis) { var _a; return ((_a = diagnosis.condition) === null || _a === void 0 ? void 0 : _a.reference) === 'Condition/' + condition.id; })) !=
                        null;
                });
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Procedure',
                        params: [
                            {
                                name: 'subject',
                                value: (0, helpers_1.assertDefined)((_h = encounter.subject) === null || _h === void 0 ? void 0 : _h.reference, "Patient id on encounter ".concat(encounterId)),
                            },
                            {
                                name: 'encounter',
                                value: "Encounter/".concat(encounterId),
                            },
                        ],
                    })];
            case 5: return [2 /*return*/, (_c.procedures = (_j.sent())
                    .unbundle()
                    .filter(function (procedure) {
                    return (0, chart_data_1.chartDataResourceHasMetaTagByCode)(procedure, 'cpt-code') ||
                        (0, chart_data_1.chartDataResourceHasMetaTagByCode)(procedure, 'em-code');
                }),
                    _c.insuranceResources = coverage
                        ? {
                            coverage: coverage,
                            subscriber: coverageSubscriber,
                            payor: coveragePayor,
                        }
                        : undefined,
                    _c.medications = medications,
                    _c)];
        }
    });
}); };
function getNpi(identifiers) {
    return getIdentifierValueBySystem(identifiers, utils_1.FHIR_IDENTIFIER_NPI);
}
function getIdentifierValueBySystem(identifiers, system) {
    var _a;
    return (_a = identifiers === null || identifiers === void 0 ? void 0 : identifiers.find(function (identifier) { return identifier.system === system; })) === null || _a === void 0 ? void 0 : _a.value;
}
function getExtensionString(extensions, url) {
    var _a;
    return (_a = extensions === null || extensions === void 0 ? void 0 : extensions.find(function (extension) { return extension.url === url; })) === null || _a === void 0 ? void 0 : _a.valueString;
}
function createCandidDiagnoses(encounter, diagnoses) {
    var _a;
    return ((_a = encounter.diagnosis) !== null && _a !== void 0 ? _a : []).flatMap(function (encounterDiagnosis) {
        var _a, _b, _c, _d;
        var diagnosisResourceId = (_a = encounterDiagnosis.condition.reference) === null || _a === void 0 ? void 0 : _a.split('/')[1];
        var diagnosisResource = diagnoses.find(function (resource) { return resource.id === diagnosisResourceId; });
        var diagnosisCode = (_c = (_b = diagnosisResource === null || diagnosisResource === void 0 ? void 0 : diagnosisResource.code) === null || _b === void 0 ? void 0 : _b.coding) === null || _c === void 0 ? void 0 : _c[0].code;
        if (diagnosisCode == null) {
            return [];
        }
        return [
            {
                codeType: ((_d = encounterDiagnosis.rank) !== null && _d !== void 0 ? _d : -1) === 1 ? api_1.DiagnosisTypeCode.Abk : api_1.DiagnosisTypeCode.Abf,
                code: diagnosisCode,
            },
        ];
    });
}
function fetchBillingProviderData(renderingProviderNpi, payerName, state, apiClient) {
    return __awaiter(this, void 0, void 0, function () {
        var providersResponse, renderingProviderId, contractsResponse, contractingProvider, billingProviderId, billingProviderResponse, billingProvider, billingProviderAddress, billingProviderTaxId;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, apiClient.organizationProviders.v3.getMulti({
                        npi: renderingProviderNpi,
                        isRendering: true,
                    })];
                case 1:
                    providersResponse = _d.sent();
                    renderingProviderId = providersResponse.ok
                        ? (_a = providersResponse.body.items[0]) === null || _a === void 0 ? void 0 : _a.organizationProviderId
                        : undefined;
                    if (renderingProviderId == null) {
                        return [2 /*return*/, STUB_BILLING_PROVIDER_DATA];
                    }
                    return [4 /*yield*/, apiClient.contracts.v2.getMulti({
                            renderingProviderIds: [(0, v2_1.RenderingProviderid)(renderingProviderId)],
                            payerNames: payerName,
                            contractStatus: 'effective',
                            states: state,
                        })];
                case 2:
                    contractsResponse = _d.sent();
                    contractingProvider = contractsResponse.ok && contractsResponse.body.items.length === 1
                        ? contractsResponse.body.items[0].contractingProvider
                        : undefined;
                    billingProviderId = contractingProvider != null && contractingProvider.isBilling
                        ? contractingProvider.organizationProviderId
                        : undefined;
                    if (billingProviderId == null) {
                        return [2 /*return*/, STUB_BILLING_PROVIDER_DATA];
                    }
                    return [4 /*yield*/, apiClient.organizationProviders.v3.get(billingProviderId)];
                case 3:
                    billingProviderResponse = _d.sent();
                    if (!billingProviderResponse.ok) {
                        return [2 /*return*/, STUB_BILLING_PROVIDER_DATA];
                    }
                    billingProvider = billingProviderResponse.body;
                    billingProviderAddress = (_c = (_b = billingProvider.addresses) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.address;
                    if (billingProviderAddress == null) {
                        return [2 /*return*/, STUB_BILLING_PROVIDER_DATA];
                    }
                    billingProviderTaxId = billingProvider.taxId;
                    if (billingProviderTaxId == null) {
                        return [2 /*return*/, STUB_BILLING_PROVIDER_DATA];
                    }
                    return [2 /*return*/, {
                            organizationName: billingProvider.organizationName,
                            firstName: billingProvider.firstName,
                            lastName: billingProvider.lastName,
                            npi: billingProvider.npi,
                            taxId: billingProviderTaxId,
                            addressLine: billingProviderAddress.address1,
                            city: billingProviderAddress.city,
                            state: billingProviderAddress.state,
                            zipCode: billingProviderAddress.zipCode,
                            zipPlusFourCode: billingProviderAddress.zipPlusFourCode,
                        }];
            }
        });
    });
}
/*
  Modify this function in order to add custom logic of selecting a billing provider for "self pay" appointments.
*/
function getSelfPayBillingProvider() {
    return STUB_BILLING_PROVIDER_DATA;
}
function fetchPreEncounterPatient(medicalRecordNumber, apiClient) {
    return __awaiter(this, void 0, void 0, function () {
        var patientResponse, patient;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, apiClient.preEncounter.patients.v1.getMulti({
                        limit: 1,
                        mrn: medicalRecordNumber,
                    })];
                case 1:
                    patientResponse = _a.sent();
                    patient = patientResponse.ok && patientResponse.body.items.length === 1 ? patientResponse.body.items[0] : undefined;
                    return [2 /*return*/, patient];
            }
        });
    });
}
function createOrUpdatePreEncounterPatient(patient, candidPatient, nonInsurancePayerId, apiClient) {
    return __awaiter(this, void 0, void 0, function () {
        var medicalRecordNumber, patientName, patientAddress, firstName, lastName, gender, dateOfBirth, patientPhone, baseCreateOrUpdatePayload, patientResponse_1, createBody, patientResponse;
        var _a, _b, _c, _d, _e, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    if (!patient.birthDate) {
                        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, patient date of birth is required. Please update the patient record and try again.');
                    }
                    if (!patient.id) {
                        throw new Error('Patient ID is required');
                    }
                    medicalRecordNumber = patient.id;
                    patientName = (_a = patient.name) === null || _a === void 0 ? void 0 : _a[0];
                    if (!((_b = patientName === null || patientName === void 0 ? void 0 : patientName.given) === null || _b === void 0 ? void 0 : _b[0])) {
                        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, patient first name is required. Please update the patient record and try again.');
                    }
                    if (!(patientName === null || patientName === void 0 ? void 0 : patientName.family)) {
                        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, patient last name is required. Please update the patient record and try again.');
                    }
                    console.log('[CLAIM SUBMISSION] patient details ', patient);
                    patientAddress = (_c = patient.address) === null || _c === void 0 ? void 0 : _c[0];
                    if (!patientAddress) {
                        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, patient address is required. Please update the patient record and try again.');
                    }
                    if (!((_d = patientAddress.line) === null || _d === void 0 ? void 0 : _d[0])) {
                        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, patient address first line is required. Please update the patient record and try again.');
                    }
                    if (!patientAddress.city) {
                        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, patient address city is required. Please update the patient record and try again.');
                    }
                    if (!patientAddress.state) {
                        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, patient address state is required. Please update the patient record and try again.');
                    }
                    if (!patientAddress.postalCode) {
                        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, patient address postal code is required. Please update the patient record and try again.');
                    }
                    firstName = (_e = patientName === null || patientName === void 0 ? void 0 : patientName.given) === null || _e === void 0 ? void 0 : _e[0];
                    lastName = patientName === null || patientName === void 0 ? void 0 : patientName.family;
                    gender = patient.gender;
                    if (!gender) {
                        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, patient gender is required. Please update the patient record and try again.');
                    }
                    dateOfBirth = patient.birthDate;
                    patientPhone = (_g = (_f = patient.telecom) === null || _f === void 0 ? void 0 : _f.find(function (telecom) { return telecom.system === 'phone'; })) === null || _g === void 0 ? void 0 : _g.value;
                    if (!patientPhone) {
                        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, patient phone number is required. Please update the patient record and try again.');
                    }
                    baseCreateOrUpdatePayload = {
                        name: {
                            family: lastName,
                            given: [firstName],
                            use: 'USUAL',
                        },
                        otherNames: [],
                        birthDate: dateOfBirth,
                        biologicalSex: mapGenderToSex(gender),
                        primaryAddress: {
                            line: patientAddress.line,
                            city: patientAddress.city,
                            state: patientAddress.state,
                            postalCode: patientAddress.postalCode,
                            use: mapAddressUse(patientAddress.use),
                            country: patientAddress.country ? patientAddress.country : 'US',
                        },
                        otherAddresses: [],
                        primaryTelecom: {
                            value: patientPhone,
                            use: preEncounter_1.ContactPointUse.Home,
                        },
                        otherTelecoms: [],
                        contacts: [],
                        generalPractitioners: [],
                        filingOrder: {
                            coverages: [],
                        },
                        nonInsurancePayerAssociations: nonInsurancePayerId
                            ? [
                                {
                                    id: (0, preEncounter_1.CanonicalNonInsurancePayerId)(nonInsurancePayerId),
                                },
                            ]
                            : undefined,
                    };
                    if (!candidPatient) return [3 /*break*/, 2];
                    return [4 /*yield*/, apiClient.preEncounter.patients.v1.update(candidPatient.id, (candidPatient.version + 1).toString(), baseCreateOrUpdatePayload)];
                case 1:
                    patientResponse_1 = _h.sent();
                    if (!patientResponse_1.ok) {
                        throw new Error("Error creating Candid patient with MRN ".concat(medicalRecordNumber, ". Response body: ").concat(JSON.stringify(patientResponse_1.error)));
                    }
                    return [2 /*return*/, patientResponse_1.body];
                case 2:
                    createBody = {
                        skipDuplicateCheck: true, // continue adding to candid, even if it's a duplicate
                        body: __assign(__assign({}, baseCreateOrUpdatePayload), { mrn: medicalRecordNumber }),
                    };
                    return [4 /*yield*/, apiClient.preEncounter.patients.v1.createWithMrn(createBody)];
                case 3:
                    patientResponse = _h.sent();
                    if (!patientResponse.ok) {
                        throw new Error("Error creating Candid patient with MRN ".concat(medicalRecordNumber, ". Response body: ").concat(JSON.stringify(patientResponse.error)));
                    }
                    return [2 /*return*/, patientResponse.body];
            }
        });
    });
}
function mapGenderToSex(gender) {
    switch (gender) {
        case 'male':
            return Sex_1.Sex.Male;
        case 'female':
            return Sex_1.Sex.Female;
        case 'unknown':
            return Sex_1.Sex.Unknown;
        case 'other':
        default:
            return Sex_1.Sex.Refused;
    }
}
function mapAddressUse(use) {
    switch (use) {
        case 'home':
            return preEncounter_1.AddressUse.Home;
        case 'work':
            return preEncounter_1.AddressUse.Work;
        case 'billing':
            return preEncounter_1.AddressUse.Billing;
        case 'temp':
            return preEncounter_1.AddressUse.Temp;
        case 'old':
            return preEncounter_1.AddressUse.Old;
        default:
            return preEncounter_1.AddressUse.Home;
    }
}
function createAppointment(patient, appointment, apiClient) {
    return __awaiter(this, void 0, void 0, function () {
        var patientId, appointmentStart, appointmentResponse, appointmentId;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    patientId = (0, helpers_1.assertDefined)((_b = (_a = patient.identifier) === null || _a === void 0 ? void 0 : _a.find(function (identifier) { return identifier.system === exports.CANDID_PATIENT_ID_IDENTIFIER_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value, 'Patient RCM Identifier');
                    appointmentStart = luxon_1.DateTime.fromISO((0, helpers_1.assertDefined)(appointment.start, 'Appointment start timestamp')).toJSDate();
                    return [4 /*yield*/, apiClient.preEncounter.appointments.v1.create({
                            patientId: (0, preEncounter_1.PatientId)(patientId),
                            startTimestamp: appointmentStart,
                            serviceDuration: 0,
                            services: [],
                        })];
                case 1:
                    appointmentResponse = _c.sent();
                    appointmentId = appointmentResponse.ok && appointmentResponse.body.id ? appointmentResponse.body.id : undefined;
                    return [2 /*return*/, appointmentId];
            }
        });
    });
}
//
// Candid Pre-Encounter Integration
//
// 1. Look up the Candid patient from FHIR encounter ID->Patient Id
//   a. if Candid patient is not found, create a Candid patient
// 2. check if Candid patient has coverages, if not, add coverages to Candid patient
//   a. Use https://github.com/masslight/ottehr/blob/candid-pre-encounter-and-copay/packages/zambdas/src/shared/candid.ts#L394
// 3. look up Candid patient appointments for the date of the visit using get-appointments-multi (candid sdk)
//    a. if yes, grab the latest one, you need the appointment ID
//    b. if not, create a Candid appointment for the patient
// 4. record patient payment in candid (amount in cents, allocation of type "appointment", appointment ID noted above)
var performCandidPreEncounterSync = function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var encounterId, oystehr, secrets, amountCents, candidApiClient, _a, ourPatient, ourAppointment, _b, coverages, insuranceOrgs, occupationalMedicineAccount, nonInsurancePayerId, ownerOrganizationId, occupationalMedicineEmployerOrganization, candidPreEncounterPatient, candidCoverages, existingCandidPreEncounterAppointmentId, candidPreEncounterAppointment;
    var _c, _d, _e, _f, _g, _h, _j, _k;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0:
                encounterId = input.encounterId, oystehr = input.oystehr, secrets = input.secrets, amountCents = input.amountCents;
                candidApiClient = createCandidApiClient(secrets);
                return [4 /*yield*/, fetchFHIRPatientAndAppointmentFromEncounter(encounterId, oystehr)];
            case 1:
                _a = _l.sent(), ourPatient = _a.patient, ourAppointment = _a.appointment;
                if (!ourPatient.id) {
                    throw new Error("Patient ID is not defined for encounter ".concat(encounterId));
                }
                return [4 /*yield*/, (0, harvest_1.getAccountAndCoverageResourcesForPatient)(ourPatient.id, oystehr)];
            case 2:
                _b = _l.sent(), coverages = _b.coverages, insuranceOrgs = _b.insuranceOrgs, occupationalMedicineAccount = _b.occupationalMedicineAccount;
                nonInsurancePayerId = undefined;
                if (!occupationalMedicineAccount) return [3 /*break*/, 5];
                ownerOrganizationId = (_d = (_c = occupationalMedicineAccount.owner) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.split('/')[1];
                if (!ownerOrganizationId) return [3 /*break*/, 4];
                return [4 /*yield*/, oystehr.fhir.get({
                        id: ((_f = (_e = occupationalMedicineAccount.owner) === null || _e === void 0 ? void 0 : _e.reference) === null || _f === void 0 ? void 0 : _f.split('/')[1]) || '',
                        resourceType: 'Organization',
                    })];
            case 3:
                occupationalMedicineEmployerOrganization = _l.sent();
                nonInsurancePayerId = (_h = (_g = occupationalMedicineEmployerOrganization.identifier) === null || _g === void 0 ? void 0 : _g.find(function (identifier) { return identifier.system === exports.CANDID_NON_INSURANCE_PAYER_ID_IDENTIFIER_SYSTEM; })) === null || _h === void 0 ? void 0 : _h.value;
                if (!nonInsurancePayerId) {
                    console.error("Occupational Medicine Employer Organization ".concat(ownerOrganizationId, " does not have a Candid Non-Insurance Payer ID."));
                }
                return [3 /*break*/, 5];
            case 4:
                console.error("Occupational Medicine Account ".concat(occupationalMedicineAccount.id, " does not have an owner organization."));
                _l.label = 5;
            case 5: return [4 /*yield*/, fetchPreEncounterPatient(ourPatient.id, candidApiClient)];
            case 6:
                candidPreEncounterPatient = _l.sent();
                return [4 /*yield*/, createOrUpdatePreEncounterPatient(ourPatient, candidPreEncounterPatient, nonInsurancePayerId, candidApiClient)];
            case 7:
                candidPreEncounterPatient = _l.sent();
                return [4 /*yield*/, createCandidCoverages(ourPatient, ourAppointment, candidPreEncounterPatient, coverages, insuranceOrgs, candidApiClient)];
            case 8:
                candidCoverages = _l.sent();
                if (!(candidCoverages.length > 0)) return [3 /*break*/, 10];
                return [4 /*yield*/, updateCandidPatientWithCoverages(candidPreEncounterPatient, candidCoverages, candidApiClient)];
            case 9:
                candidPreEncounterPatient = _l.sent();
                _l.label = 10;
            case 10:
                existingCandidPreEncounterAppointmentId = (_k = (_j = ourAppointment.identifier) === null || _j === void 0 ? void 0 : _j.find(function (identifier) { return identifier.system === exports.CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM; })) === null || _k === void 0 ? void 0 : _k.value;
                if (!existingCandidPreEncounterAppointmentId) return [3 /*break*/, 12];
                return [4 /*yield*/, fetchPreEncounterAppointment(existingCandidPreEncounterAppointmentId)];
            case 11:
                candidPreEncounterAppointment = _l.sent();
                return [3 /*break*/, 14];
            case 12: return [4 /*yield*/, createPreEncounterAppointment(candidPreEncounterPatient, ourAppointment, oystehr)];
            case 13:
                candidPreEncounterAppointment = _l.sent();
                _l.label = 14;
            case 14:
                if (!amountCents) return [3 /*break*/, 16];
                return [4 /*yield*/, createPreEncounterPatientPayment(ourPatient, candidPreEncounterAppointment, amountCents)];
            case 15:
                _l.sent();
                _l.label = 16;
            case 16: return [2 /*return*/];
        }
    });
}); };
exports.performCandidPreEncounterSync = performCandidPreEncounterSync;
var createPreEncounterPatientPayment = function (ourPatient, candidAppointment, amountCents) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!ourPatient.id) {
                    throw new Error("Patient ID is not defined for patient ".concat(JSON.stringify(ourPatient)));
                }
                return [4 /*yield*/, candidApiClient.patientPayments.v4.create({
                        patientExternalId: (0, api_1.PatientExternalId)(ourPatient.id),
                        amountCents: amountCents,
                        allocations: [
                            {
                                amountCents: amountCents,
                                target: {
                                    type: 'appointment_by_id_and_patient_external_id',
                                    appointmentId: (0, api_1.AppointmentId)(candidAppointment.id),
                                    patientExternalId: (0, api_1.PatientExternalId)(ourPatient.id),
                                },
                            },
                        ],
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var createPreEncounterAppointment = function (candidPatient, appointment, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var startTime, response, patchOperations;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!appointment.start) {
                    throw new Error("Appointment period start is not defined for appointment ".concat(appointment.id));
                }
                startTime = luxon_1.DateTime.fromISO(appointment.start).toJSDate();
                return [4 /*yield*/, candidApiClient.preEncounter.appointments.v1.create({
                        patientId: (0, preEncounter_1.PatientId)(candidPatient.id),
                        startTimestamp: startTime,
                        serviceDuration: 30,
                        services: [],
                    })];
            case 1:
                response = _a.sent();
                if (!response.ok) {
                    throw new Error("Error creating Candid appointment. Response body: ".concat(JSON.stringify(response.error)));
                }
                if (!appointment.id) {
                    throw new Error("Appointment ID is not defined for appointment ".concat(JSON.stringify(appointment)));
                }
                patchOperations = [];
                patchOperations.push({
                    op: appointment.identifier === undefined ? 'add' : 'replace',
                    path: '/identifier',
                    value: [
                        {
                            system: exports.CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM,
                            value: response.body.id,
                        },
                    ],
                });
                return [4 /*yield*/, oystehr.fhir.patch({
                        resourceType: 'Appointment',
                        id: appointment.id,
                        operations: patchOperations,
                    })];
            case 2:
                _a.sent();
                return [2 /*return*/, response.body];
        }
    });
}); };
var fetchPreEncounterAppointment = function (candidAppointmentId) { return __awaiter(void 0, void 0, void 0, function () {
    var response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, candidApiClient.preEncounter.appointments.v1.get((0, preEncounter_1.AppointmentId)(candidAppointmentId))];
            case 1:
                response = _a.sent();
                if (!response.ok) {
                    throw new Error("Error fetching Candid appointment. Response body: ".concat(JSON.stringify(response.error)));
                }
                return [2 /*return*/, response.body];
        }
    });
}); };
var updateCandidPatientWithCoverages = function (candidPatient, candidCoverages, candidApiClient) { return __awaiter(void 0, void 0, void 0, function () {
    var updatedPatient, patientResponse;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                updatedPatient = __assign(__assign({}, candidPatient), { filingOrder: {
                        coverages: candidCoverages.map(function (coverage) { return coverage.id; }),
                    } });
                return [4 /*yield*/, candidApiClient.preEncounter.patients.v1.update(candidPatient.id, (candidPatient.version + 1).toString(), updatedPatient)];
            case 1:
                patientResponse = _a.sent();
                if (!patientResponse.ok) {
                    throw new Error("Error updating Candid patient. Response body: ".concat(JSON.stringify(patientResponse.error)));
                }
                return [2 /*return*/, patientResponse.body];
        }
    });
}); };
var createCandidCoverages = function (patient, appointment, candidPatient, coverages, insuranceOrgs, candidApiClient) { return __awaiter(void 0, void 0, void 0, function () {
    var candidCoverages, primaryInsuranceOrg, secondaryInsuranceOrg, workersCompInsuranceOrg, candidCoverage, response, candidCoverage, response, candidCoverage, response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!patient.id) {
                    throw new Error("Patient ID is not defined for patient ".concat(JSON.stringify(patient)));
                }
                candidCoverages = [];
                if (coverages === undefined) {
                    return [2 /*return*/, candidCoverages];
                }
                primaryInsuranceOrg = insuranceOrgs.find(function (org) { var _a, _b; return (0, utils_1.createReference)(org).reference === ((_b = (_a = coverages.primary) === null || _a === void 0 ? void 0 : _a.payor) === null || _b === void 0 ? void 0 : _b[0].reference); });
                secondaryInsuranceOrg = insuranceOrgs.find(function (org) { var _a, _b; return (0, utils_1.createReference)(org).reference === ((_b = (_a = coverages.secondary) === null || _a === void 0 ? void 0 : _a.payor) === null || _b === void 0 ? void 0 : _b[0].reference); });
                workersCompInsuranceOrg = insuranceOrgs.find(function (org) { var _a, _b; return (0, utils_1.createReference)(org).reference === ((_b = (_a = coverages.workersComp) === null || _a === void 0 ? void 0 : _a.payor) === null || _b === void 0 ? void 0 : _b[0].reference); });
                if (!(coverages.primary && coverages.primarySubscriber && primaryInsuranceOrg)) return [3 /*break*/, 2];
                candidCoverage = buildCandidCoverageCreateInput(coverages.primary, coverages.primarySubscriber, primaryInsuranceOrg, candidPatient);
                return [4 /*yield*/, candidApiClient.preEncounter.coverages.v1.create(candidCoverage)];
            case 1:
                response = _a.sent();
                if (!response.ok) {
                    throw new Error("Error creating Candid Primary coverage. Response body: ".concat(JSON.stringify(response.error)));
                }
                candidCoverages.push(response.body);
                _a.label = 2;
            case 2:
                if (!(coverages.secondary && coverages.secondarySubscriber && secondaryInsuranceOrg)) return [3 /*break*/, 4];
                candidCoverage = buildCandidCoverageCreateInput(coverages.secondary, coverages.secondarySubscriber, secondaryInsuranceOrg, candidPatient);
                return [4 /*yield*/, candidApiClient.preEncounter.coverages.v1.create(candidCoverage)];
            case 3:
                response = _a.sent();
                if (!response.ok) {
                    throw new Error("Error creating Candid Secondary coverage. Response body: ".concat(JSON.stringify(response.error)));
                }
                candidCoverages.push(response.body);
                _a.label = 4;
            case 4:
                if (!(coverages.workersComp && workersCompInsuranceOrg)) return [3 /*break*/, 6];
                candidCoverage = buildCandidCoverageCreateInput(coverages.workersComp, patient, workersCompInsuranceOrg, candidPatient);
                return [4 /*yield*/, candidApiClient.preEncounter.coverages.v1.create(candidCoverage)];
            case 5:
                response = _a.sent();
                if (!response.ok) {
                    throw new Error("Error creating Candid Workers Comp coverage. Response body: ".concat(JSON.stringify(response.error)));
                }
                // if visit type is WC put WC insurance first in the candidCoverages array. otherwise, put it at the end?
                if ((0, utils_1.isAppointmentWorkersComp)(appointment)) {
                    candidCoverages.unshift(response.body);
                }
                else {
                    candidCoverages.push(response.body);
                }
                _a.label = 6;
            case 6: return [2 /*return*/, candidCoverages];
        }
    });
}); };
var buildCandidCoverageCreateInput = function (coverage, subscriber, // Patient as subscriber is used in workers comp
insuranceOrg, candidPatient) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    if (!((_a = subscriber.name) === null || _a === void 0 ? void 0 : _a[0].family) || !((_b = subscriber.name) === null || _b === void 0 ? void 0 : _b[0].given)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, insurance subscriber name is required. Please update the patient record and try again.');
    }
    if (!subscriber.birthDate) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, insurance subscriber date of birth is required. Please update the patient record and try again.');
    }
    if (!((_c = subscriber.address) === null || _c === void 0 ? void 0 : _c[0].line) ||
        !((_d = subscriber.address) === null || _d === void 0 ? void 0 : _d[0].city) ||
        !((_e = subscriber.address) === null || _e === void 0 ? void 0 : _e[0].state) ||
        !((_f = subscriber.address) === null || _f === void 0 ? void 0 : _f[0].postalCode)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('In order to collect payment, insurance subscriber address is required. Please update the patient record and try again.');
    }
    return {
        subscriber: {
            name: {
                family: (_g = subscriber.name) === null || _g === void 0 ? void 0 : _g[0].family,
                given: (_h = subscriber.name) === null || _h === void 0 ? void 0 : _h[0].given,
                use: (_l = (_k = (_j = subscriber.name) === null || _j === void 0 ? void 0 : _j[0].use) === null || _k === void 0 ? void 0 : _k.toUpperCase()) !== null && _l !== void 0 ? _l : 'USUAL', // TODO default to usual if not specified
            },
            dateOfBirth: subscriber.birthDate,
            biologicalSex: mapGenderToSex(subscriber.gender),
            address: {
                line: (_m = subscriber.address) === null || _m === void 0 ? void 0 : _m[0].line,
                city: (_o = subscriber.address) === null || _o === void 0 ? void 0 : _o[0].city,
                state: (_p = subscriber.address) === null || _p === void 0 ? void 0 : _p[0].state,
                postalCode: (_q = subscriber.address) === null || _q === void 0 ? void 0 : _q[0].postalCode,
                use: mapAddressUse((_r = subscriber.address) === null || _r === void 0 ? void 0 : _r[0].use),
                country: (_t = (_s = subscriber.address) === null || _s === void 0 ? void 0 : _s[0].country) !== null && _t !== void 0 ? _t : 'US', // TODO just save country into the FHIR resource when making it https://build.fhir.org/datatypes-definitions.html#Address.country. We can put US by default to start.
            },
        },
        relationship: convertCoverageRelationshipToCandidRelationship((0, helpers_1.assertDefined)((_v = (_u = coverage.relationship) === null || _u === void 0 ? void 0 : _u.coding) === null || _v === void 0 ? void 0 : _v[0].code, 'Subscriber relationship')),
        status: 'ACTIVE',
        patient: candidPatient.id,
        verified: true,
        insurancePlan: {
            memberId: (0, helpers_1.assertDefined)(coverage.subscriberId, 'Member ID'),
            payerName: (0, helpers_1.assertDefined)(insuranceOrg.name, 'Payor name'),
            payerId: (0, preEncounter_1.PayerId)((0, helpers_1.assertDefined)((0, utils_1.getPayerId)(insuranceOrg), 'Payor id')),
            planType: (0, utils_1.getCandidPlanTypeCodeFromCoverage)(coverage),
        },
    };
};
function convertCoverageRelationshipToCandidRelationship(relationship) {
    var normalizedString = relationship.toUpperCase().trim();
    //
    // Normalize the string to match the expected values from FHIR specification
    // defined here https://build.fhir.org/valueset-subscriber-relationship.html
    //
    //
    switch (normalizedString) {
        case 'SELF':
            return preEncounter_1.Relationship.Self;
        case 'SPOUSE':
            return preEncounter_1.Relationship.Spouse;
        case 'PARENT':
            return preEncounter_1.Relationship.Other;
        case 'CHILD':
            return preEncounter_1.Relationship.Child;
        case 'COMMON':
            return preEncounter_1.Relationship.CommonLawSpouse;
        default:
            return preEncounter_1.Relationship.Other;
    }
}
function getLocalDateOfService(appointmentStart, location) {
    var timezone = location ? (0, utils_1.getTimezone)(location) : utils_1.TIMEZONES[0];
    return luxon_1.DateTime.fromISO(appointmentStart).setZone(timezone).toISODate();
}
var fetchFHIRPatientAndAppointmentFromEncounter = function (encounterId, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var searchBundleResponse, patient, appointment, location;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, oystehr.fhir.search({
                    resourceType: 'Encounter',
                    params: [
                        {
                            name: '_id',
                            value: encounterId,
                        },
                        {
                            name: '_include',
                            value: 'Encounter:subject',
                        },
                        {
                            name: '_include',
                            value: 'Encounter:appointment',
                        },
                        {
                            name: '_include:iterate',
                            value: 'Appointment:location',
                        },
                    ],
                })];
            case 1:
                searchBundleResponse = (_a.sent()).unbundle();
                patient = searchBundleResponse.find(function (resource) { return resource.resourceType === 'Patient'; });
                if (!patient) {
                    throw new Error("Patient not found for encounter ID: ".concat(encounterId));
                }
                appointment = searchBundleResponse.find(function (resource) { return resource.resourceType === 'Appointment'; });
                if (!appointment) {
                    throw new Error("Appointment not found for encounter ID: ".concat(encounterId));
                }
                location = searchBundleResponse.find(function (resource) { return resource.resourceType === 'Location'; });
                return [2 /*return*/, {
                        patient: patient,
                        appointment: appointment,
                        location: location,
                    }];
        }
    });
}); };
function createEncounterFromAppointment(visitResources, secrets, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var candidClientId, apiClient, createEncounterInput, request, response, encounter, packageEncounter, paymentVariantFromEncounter, candidResponsibleParty, updateResponse;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('[CLAIM SUBMISSION] Starting encounter submission to candid');
                    candidClientId = (0, utils_1.getOptionalSecret)(utils_1.SecretsKeys.CANDID_CLIENT_ID, secrets);
                    if (candidClientId == null || candidClientId.length === 0) {
                        console.log('CANDID_CLIENT_ID is not set, skipping encounter submission to candid');
                        return [2 /*return*/, undefined];
                    }
                    apiClient = createCandidApiClient(secrets);
                    return [4 /*yield*/, createCandidCreateEncounterInput(visitResources, oystehr)];
                case 1:
                    createEncounterInput = _c.sent();
                    if (!!((_b = (_a = createEncounterInput.appointment.identifier) === null || _a === void 0 ? void 0 : _a.find(function (identifier) { return identifier.system === exports.CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value)) return [3 /*break*/, 4];
                    // If this is not set, then we did not yet complete pre-encounter sync by collecting any payment before the visit, so we need to do that now.
                    console.log('Candid pre-encounter appointment ID is not set, performing pre-encounter sync.');
                    if (!visitResources.encounter.id) {
                        throw new Error("Encounter ID is not defined for visit resources ".concat(JSON.stringify(visitResources)));
                    }
                    console.log("[CLAIM SUBMISSION] Starting patient & encounter sync for encounter ".concat(visitResources.encounter.id));
                    return [4 /*yield*/, (0, exports.performCandidPreEncounterSync)({
                            encounterId: visitResources.encounter.id,
                            oystehr: oystehr,
                            secrets: secrets,
                        })];
                case 2:
                    _c.sent();
                    console.log("[CLAIM SUBMISSION] Sync completed for encounter  ".concat(visitResources.encounter.id));
                    return [4 /*yield*/, createCandidCreateEncounterInput(visitResources, oystehr)];
                case 3:
                    createEncounterInput = _c.sent();
                    _c.label = 4;
                case 4: return [4 /*yield*/, candidCreateEncounterFromAppointmentRequest(createEncounterInput, apiClient)];
                case 5:
                    request = _c.sent();
                    console.log('Candid request:' + JSON.stringify(request, null, 2));
                    console.log("[CLAIM SUBMISSION] Sending encounter to candid");
                    return [4 /*yield*/, apiClient.encounters.v4.createFromPreEncounterPatient(request)];
                case 6:
                    response = _c.sent();
                    console.log("[CLAIM SUBMISSION] Encounter sent to candid, response from candid ".concat(JSON.stringify(response)));
                    if (!response.ok) {
                        throw new Error("Error creating a Candid encounter. Response body: ".concat(JSON.stringify(response.error)));
                    }
                    encounter = response.body;
                    console.log('Created Candid encounter:' + JSON.stringify(encounter));
                    packageEncounter = visitResources.encounter;
                    paymentVariantFromEncounter = (0, utils_1.getPaymentVariantFromEncounter)(packageEncounter);
                    candidResponsibleParty = paymentVariantFromEncounter && paymentVariantFromEncounter === utils_1.PaymentVariant.selfPay
                        ? v4_1.ResponsiblePartyType.SelfPay
                        : v4_1.ResponsiblePartyType.InsurancePay;
                    if (!candidResponsibleParty) return [3 /*break*/, 8];
                    return [4 /*yield*/, apiClient.encounters.v4.update(encounter.encounterId, {
                            responsibleParty: candidResponsibleParty,
                        })];
                case 7:
                    updateResponse = _c.sent();
                    if (!updateResponse.ok) {
                        throw new Error("Error updating a Candid encounter. Response body: ".concat(JSON.stringify(updateResponse.error)));
                    }
                    else {
                        console.log('Updated Candid encounter:' + JSON.stringify(updateResponse.body));
                    }
                    _c.label = 8;
                case 8: return [2 /*return*/, encounter.encounterId];
            }
        });
    });
}
function candidCreateEncounterFromAppointmentRequest(input, apiClient) {
    return __awaiter(this, void 0, void 0, function () {
        var appointment, encounter, patient, practitioner, diagnoses, procedures, insuranceResources, location, medications, practitionerNpi, practitionerName, billingProviderData, _a, serviceFacilityAddress, serviceFacilityPostalCodeTokens, candidDiagnoses, primaryDiagnosisIndex, candidPatientId, candidPatient, candidAppointmentId, appointmentStart, dateOfServiceString, serviceLines, tags;
        var _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    appointment = input.appointment, encounter = input.encounter, patient = input.patient, practitioner = input.practitioner, diagnoses = input.diagnoses, procedures = input.procedures, insuranceResources = input.insuranceResources, location = input.location, medications = input.medications;
                    practitionerNpi = (0, helpers_1.assertDefined)(getNpi(practitioner.identifier), 'Practitioner NPI');
                    practitionerName = (0, helpers_1.assertDefined)((_b = practitioner.name) === null || _b === void 0 ? void 0 : _b[0], 'Practitioner name');
                    if (!insuranceResources) return [3 /*break*/, 2];
                    return [4 /*yield*/, fetchBillingProviderData(practitionerNpi, (0, helpers_1.assertDefined)(insuranceResources.payor.name, 'Payor name'), SERVICE_FACILITY_LOCATION_STATE, apiClient)];
                case 1:
                    _a = _j.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = getSelfPayBillingProvider();
                    _j.label = 3;
                case 3:
                    billingProviderData = _a;
                    serviceFacilityAddress = (0, helpers_1.assertDefined)(SERVICE_FACILITY_LOCATION.address, 'Service facility address');
                    serviceFacilityPostalCodeTokens = (0, helpers_1.assertDefined)(serviceFacilityAddress.postalCode, 'Service facility postal code').split('-');
                    candidDiagnoses = createCandidDiagnoses(encounter, diagnoses);
                    primaryDiagnosisIndex = candidDiagnoses.findIndex(function (candidDiagnosis) { return candidDiagnosis.codeType === api_1.DiagnosisTypeCode.Abk; });
                    if (primaryDiagnosisIndex === -1) {
                        throw new Error('Primary diagnosis is absent');
                    }
                    return [4 /*yield*/, apiClient.preEncounter.patients.v1.getMulti({
                            mrn: patient.id,
                        })];
                case 4:
                    candidPatientId = _j.sent();
                    if (!candidPatientId.ok || candidPatientId.body.items.length === 0) {
                        throw new Error("Candid patient not found for patient ".concat(patient.id));
                    }
                    if (candidPatientId.body.items.length > 1) {
                        throw new Error("Multiple Candid patients found for patient ".concat(patient.id));
                    }
                    candidPatient = candidPatientId.body.items[0];
                    candidAppointmentId = (_d = (_c = appointment.identifier) === null || _c === void 0 ? void 0 : _c.find(function (identifier) { return identifier.system === exports.CANDID_PRE_ENCOUNTER_APPOINTMENT_ID_IDENTIFIER_SYSTEM; })) === null || _d === void 0 ? void 0 : _d.value;
                    if (!candidAppointmentId) {
                        throw new Error("Candid appointment ID is not defined for appointment ".concat(appointment.id));
                    }
                    appointmentStart = appointment.start;
                    if (appointmentStart) {
                        dateOfServiceString = getLocalDateOfService(appointmentStart, location);
                    }
                    serviceLines = [];
                    procedures.forEach(function (procedure) {
                        var _a, _b;
                        var procedureCode = (_b = (_a = procedure.code) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b[0].code;
                        var modifiers = [];
                        if (procedureCode == null) {
                            return;
                        }
                        var isEAndMCode = rcm_1.emCodeOptions.some(function (emCodeOption) { return emCodeOption.code === procedureCode; });
                        if (isEAndMCode && (0, utils_1.isTelemedAppointment)(appointment)) {
                            modifiers = ['95'];
                        }
                        serviceLines.push({
                            procedureCode: procedureCode,
                            modifiers: modifiers,
                            quantity: (0, api_1.Decimal)('1'),
                            units: api_1.ServiceLineUnits.Un,
                            diagnosisPointers: [primaryDiagnosisIndex],
                            dateOfService: dateOfServiceString !== null && dateOfServiceString !== void 0 ? dateOfServiceString : getLocalDateOfService((0, helpers_1.assertDefined)(appointment.start, 'Appointment start'), location),
                        });
                    });
                    if (medications) {
                        console.log("Adding medications to service lines, medications: ".concat(medications.length));
                        medications.forEach(function (medicationAdministration) {
                            var medication = (0, utils_1.getMedicationFromMA)(medicationAdministration);
                            if (!medication)
                                return;
                            var ndc = (0, utils_1.getNdcCodeFromMedication)(medication);
                            var cpt = (0, utils_1.getCptCodeFromMedication)(medication);
                            var hcpcs = (0, utils_1.getHcpcsCodeFromMedication)(medication);
                            var procedureCode = cpt || hcpcs;
                            var dosageFromMA = (0, utils_1.getDosageFromMA)(medicationAdministration);
                            if (dosageFromMA === undefined)
                                return;
                            var candidMeasurement = mapMedicationToCandidMeasurement(dosageFromMA.units);
                            console.log("medication: ".concat(medicationAdministration === null || medicationAdministration === void 0 ? void 0 : medicationAdministration.id, ", ndc: ").concat(ndc, ", procedureCode: ").concat(procedureCode, ", dose: ").concat(dosageFromMA.dose));
                            if (procedureCode && ndc && dosageFromMA && candidMeasurement) {
                                serviceLines.push({
                                    procedureCode: procedureCode,
                                    quantity: (0, api_1.Decimal)('1'), // ???
                                    units: api_1.ServiceLineUnits.Un,
                                    diagnosisPointers: [primaryDiagnosisIndex],
                                    drugIdentification: {
                                        serviceIdQualifier: 'N4',
                                        nationalDrugCode: ndc, // this ndc code has to be 5-4-2 format to match N4 code
                                        nationalDrugUnitCount: (0, api_1.Decimal)(dosageFromMA.dose.toString()),
                                        measurementUnitCode: candidMeasurement,
                                    },
                                    dateOfService: dateOfServiceString ||
                                        (0, helpers_1.assertDefined)(getLocalDateOfService((0, helpers_1.assertDefined)(appointment.start, 'Appointment start'), location), 'Service line date'),
                                });
                            }
                        });
                    }
                    tags = [];
                    if ((0, utils_1.isAppointmentWorkersComp)(appointment)) {
                        tags.push((0, api_1.TagId)(CANDID_TAG_WORKERS_COMP));
                    }
                    else if ((0, utils_1.isAppointmentOccupationalMedicine)(appointment)) {
                        tags.push((0, api_1.TagId)(CANDID_TAG_OCCUPATIONAL_MEDICINE));
                    }
                    // Note: dateOfService field must not be provided as service line date of service is already sent
                    return [2 /*return*/, {
                            externalId: (0, api_1.EncounterExternalId)((0, helpers_1.assertDefined)(encounter.id, 'Encounter.id')),
                            preEncounterPatientId: (0, api_1.PreEncounterPatientId)(candidPatient.id),
                            preEncounterAppointmentIds: [(0, api_1.PreEncounterAppointmentId)(candidAppointmentId)],
                            benefitsAssignedToProvider: true,
                            billableStatus: v4_1.BillableStatusType.Billable,
                            patientAuthorizedRelease: true,
                            providerAcceptsAssignment: true,
                            billingProvider: {
                                organizationName: billingProviderData.organizationName,
                                firstName: billingProviderData.firstName,
                                lastName: billingProviderData.lastName,
                                npi: billingProviderData.npi,
                                taxId: billingProviderData.taxId,
                                address: {
                                    address1: billingProviderData.addressLine,
                                    city: billingProviderData.city,
                                    state: billingProviderData.state,
                                    zipCode: billingProviderData.zipCode,
                                    zipPlusFourCode: billingProviderData.zipPlusFourCode,
                                },
                            },
                            renderingProvider: {
                                firstName: (0, helpers_1.assertDefined)((_e = practitionerName.given) === null || _e === void 0 ? void 0 : _e[0], 'Practitioner first name'),
                                lastName: (0, helpers_1.assertDefined)(practitionerName.family, 'Practitioner last name'),
                                npi: (0, helpers_1.assertDefined)(getNpi(practitioner.identifier), 'Practitioner NPI'),
                            },
                            serviceFacility: {
                                organizationName: (_f = location === null || location === void 0 ? void 0 : location.description) !== null && _f !== void 0 ? _f : (0, helpers_1.assertDefined)(SERVICE_FACILITY_LOCATION.name, 'Service facility name'),
                                address: {
                                    address1: (0, helpers_1.assertDefined)((_g = serviceFacilityAddress.line) === null || _g === void 0 ? void 0 : _g[0], 'Service facility address line'),
                                    city: (0, helpers_1.assertDefined)(serviceFacilityAddress.city, 'Service facility city'),
                                    state: (0, helpers_1.assertDefined)(serviceFacilityAddress.state, 'Service facility state'),
                                    zipCode: serviceFacilityPostalCodeTokens[0],
                                    zipPlusFourCode: (_h = serviceFacilityPostalCodeTokens[1]) !== null && _h !== void 0 ? _h : '9998',
                                },
                            },
                            placeOfServiceCode: (0, helpers_1.assertDefined)(getExtensionString(SERVICE_FACILITY_LOCATION.extension, rcm_1.CODE_SYSTEM_CMS_PLACE_OF_SERVICE), 'Location place of service code'),
                            diagnoses: candidDiagnoses,
                            serviceLines: serviceLines,
                            tagIds: tags,
                        }];
            }
        });
    });
}
exports.CANDID_PAYMENT_ID_SYSTEM = 'https://fhir.oystehr.com/PaymentIdSystem/candid';
var makeBusinessIdentifierForCandidPayment = function (candidPaymentId) {
    return {
        system: exports.CANDID_PAYMENT_ID_SYSTEM,
        value: candidPaymentId,
    };
};
exports.makeBusinessIdentifierForCandidPayment = makeBusinessIdentifierForCandidPayment;
function getCandidEncounterIdFromEncounter(encounter) {
    var _a, _b;
    return (_b = (_a = encounter.identifier) === null || _a === void 0 ? void 0 : _a.find(function (idn) { return idn.system === exports.CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM; })) === null || _b === void 0 ? void 0 : _b.value;
}
function getMedicationAdministrationsForEncounter(oystehr, encounterId, filterParams) {
    return __awaiter(this, void 0, void 0, function () {
        var params, resources;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    params = [
                        {
                            name: 'context',
                            value: "Encounter/".concat(encounterId),
                        },
                        {
                            name: '_tag',
                            value: utils_1.MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
                        },
                    ];
                    if (((_a = filterParams === null || filterParams === void 0 ? void 0 : filterParams.statuses) === null || _a === void 0 ? void 0 : _a.length) && filterParams.statuses.length > 0) {
                        params.push({
                            name: 'status',
                            value: filterParams.statuses.map(function (status) { return (0, utils_1.mapOrderStatusToFhir)(status); }).join(','),
                        });
                    }
                    return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'MedicationAdministration',
                            params: params,
                        })];
                case 1:
                    resources = (_b.sent()).unbundle();
                    if (!resources || resources.length === 0)
                        return [2 /*return*/, undefined];
                    return [2 /*return*/, resources];
            }
        });
    });
}
function mapMedicationToCandidMeasurement(units) {
    switch (units) {
        case 'mg':
            return v2_2.MeasurementUnitCode.Milligram;
        case 'ml':
            return v2_2.MeasurementUnitCode.Milliliters;
        case 'unit':
            return v2_2.MeasurementUnitCode.Units;
        case 'g':
            return v2_2.MeasurementUnitCode.Grams;
        default:
            return v2_2.MeasurementUnitCode.InternationalUnit; // todo ??? i have unhandled 'cc' and 'application' cases
    }
}
