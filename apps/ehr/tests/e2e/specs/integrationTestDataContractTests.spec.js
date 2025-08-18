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
var test_1 = require("@playwright/test");
var luxon_1 = require("luxon");
var resource_handler_1 = require("../../e2e-utils/resource-handler");
var PROCESS_ID = "contractTests-".concat(luxon_1.DateTime.now().toMillis());
var e2eHandler = new resource_handler_1.ResourceHandler(PROCESS_ID);
var integrationHandler = new resource_handler_1.ResourceHandler(PROCESS_ID);
test_1.test.beforeAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _b = (_a = Promise).all;
                return [4 /*yield*/, integrationHandler.setResourcesFast()];
            case 1:
                _c = [_d.sent()];
                return [4 /*yield*/, e2eHandler.setResources()];
            case 2: return [4 /*yield*/, _b.apply(_a, [_c.concat([_d.sent()])])];
            case 3:
                _d.sent();
                return [4 /*yield*/, Promise.all([
                        e2eHandler.waitTillAppointmentPreprocessed(e2eHandler.appointment.id),
                        e2eHandler.waitTillHarvestingDone(e2eHandler.appointment.id),
                    ])];
            case 4:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); });
test_1.test.afterAll(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, integrationHandler.cleanupResources()];
            case 1:
                _a.sent();
                return [4 /*yield*/, e2eHandler.cleanupResources()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
var SKIP_ME = 'SKIP_ME_FOR_VALUE_CHECKING';
(0, test_1.test)('Ensure Resources created by generate test data -> harvest -> prefill is the same as what we create for integration testing', function () { return __awaiter(void 0, void 0, void 0, function () {
    var e2eResources, integrationResources;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getAllResourcesFromFHIR(e2eHandler.appointment.id)];
            case 1:
                e2eResources = _a.sent();
                return [4 /*yield*/, getAllResourcesFromFHIR(integrationHandler.appointment.id)];
            case 2:
                integrationResources = _a.sent();
                appointmentTests(e2eResources, integrationResources);
                patientTests(e2eResources, integrationResources);
                relatedPersonTests(e2eResources, integrationResources);
                personTests(e2eResources, integrationResources);
                observationTests(e2eResources, integrationResources);
                encounterTests(e2eResources, integrationResources);
                slotTests(e2eResources, integrationResources);
                listTests(e2eResources, integrationResources);
                serviceRequestTests(e2eResources, integrationResources);
                clinicalImpressionTests(e2eResources, integrationResources);
                documentReferenceTests(e2eResources, integrationResources);
                questionnaireResponseTests(e2eResources, integrationResources);
                consentTests(e2eResources, integrationResources);
                accountTests(e2eResources, integrationResources);
                return [2 /*return*/];
        }
    });
}); });
var appointmentTests = function (e2eResources, integrationResources) {
    var e2eAppointments = e2eResources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
    var integrationAppointments = integrationResources.filter(function (resource) { return resource.resourceType === 'Appointment'; });
    (0, test_1.expect)(e2eAppointments.length).toEqual(integrationAppointments.length);
    var e2eAppointment = cleanAppointment(e2eAppointments[0]);
    var integrationAppointment = cleanAppointment(integrationAppointments[0]);
    checkKeysAndValuesBothWays(e2eAppointment, integrationAppointment, 'Appointment');
};
var patientTests = function (e2eResources, integrationResources) {
    var e2ePatients = e2eResources.filter(function (resource) { return resource.resourceType === 'Patient'; });
    var integrationPatients = integrationResources.filter(function (resource) { return resource.resourceType === 'Patient'; });
    (0, test_1.expect)(e2ePatients.length).toEqual(integrationPatients.length);
    var e2eAppointment = cleanPatient(e2ePatients[0]);
    var integrationAppointment = cleanPatient(integrationPatients[0]);
    checkKeysAndValuesBothWays(e2eAppointment, integrationAppointment, 'Patient');
};
var relatedPersonTests = function (e2eResources, integrationResources) {
    var e2eRPs = e2eResources.filter(function (resource) { return resource.resourceType === 'RelatedPerson'; });
    var integrationRPs = integrationResources.filter(function (resource) { return resource.resourceType === 'RelatedPerson'; });
    (0, test_1.expect)(e2eRPs.length).toEqual(integrationRPs.length);
    var e2eRP = cleanRelatedPerson(e2eRPs[0]);
    var integrationRP = cleanRelatedPerson(integrationRPs[0]);
    checkKeysAndValuesBothWays(e2eRP, integrationRP, 'RelatedPerson');
};
var personTests = function (e2eResources, integrationResources) {
    var e2ePersons = e2eResources.filter(function (resource) { return resource.resourceType === 'Person'; });
    var integrationPersons = integrationResources.filter(function (resource) { return resource.resourceType === 'Person'; });
    (0, test_1.expect)(e2ePersons.length).toEqual(integrationPersons.length);
    var e2eP = cleanPerson(e2ePersons[0]);
    var integrationP = cleanPerson(integrationPersons[0]);
    checkKeysAndValuesBothWays(e2eP, integrationP, 'Person');
};
var observationTests = function (e2eResources, integrationResources) {
    var e2eObservations = e2eResources.filter(function (resource) { return resource.resourceType === 'Observation'; });
    var integrationObservations = integrationResources.filter(function (resource) { return resource.resourceType === 'Observation'; });
    (0, test_1.expect)(e2eObservations.length).toEqual(integrationObservations.length);
    var e2eCleaned = e2eObservations.map(function (observation) { return cleanObservation(observation); });
    var integrationCleaned = integrationObservations.map(function (observation) { return cleanObservation(observation); });
    e2eCleaned.forEach(function (e2eObservation) {
        var _a, _b;
        var e2eObservationTypeTag = (_b = (_a = e2eObservation.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) { return tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field'; });
        var integrationObservation = integrationCleaned.find(function (integrationObservation) {
            var _a, _b;
            return (_b = (_a = integrationObservation.meta) === null || _a === void 0 ? void 0 : _a.tag) === null || _b === void 0 ? void 0 : _b.find(function (tag) {
                return tag.system === 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field' &&
                    tag.code === e2eObservationTypeTag.code;
            });
        });
        checkKeysAndValuesBothWays(e2eObservation, integrationObservation, "".concat(e2eObservationTypeTag.code, " Observation"));
    });
};
var encounterTests = function (e2eResources, integrationResources) {
    var e2eEncounters = e2eResources.filter(function (resource) { return resource.resourceType === 'Encounter'; });
    var integrationEncounters = integrationResources.filter(function (resource) { return resource.resourceType === 'Encounter'; });
    (0, test_1.expect)(e2eEncounters.length).toEqual(integrationEncounters.length);
    var e2eEncounter = cleanEncounter(e2eEncounters[0]);
    var integrationEncounter = cleanEncounter(integrationEncounters[0]);
    checkKeysAndValuesBothWays(e2eEncounter, integrationEncounter, 'Encounter');
};
var slotTests = function (e2eResources, integrationResources) {
    var e2eSlots = e2eResources.filter(function (resource) { return resource.resourceType === 'Slot'; });
    var integrationSlots = integrationResources.filter(function (resource) { return resource.resourceType === 'Slot'; });
    (0, test_1.expect)(e2eSlots.length).toEqual(integrationSlots.length);
    var e2eSlot = cleanSlot(e2eSlots[0]);
    var integrationSlot = cleanSlot(integrationSlots[0]);
    checkKeysAndValuesBothWays(e2eSlot, integrationSlot, 'Slot');
};
var listTests = function (e2eResources, integrationResources) {
    var e2eLists = e2eResources.filter(function (resource) { return resource.resourceType === 'List'; });
    var integrationLists = integrationResources.filter(function (resource) { return resource.resourceType === 'List'; });
    (0, test_1.expect)(e2eLists.length).toEqual(integrationLists.length);
    var e2eCleaned = e2eLists.map(function (list) { return cleanList(list); });
    var integrationCleaned = integrationLists.map(function (list) { return cleanList(list); });
    e2eCleaned.forEach(function (e2eList) {
        var integrationList = integrationCleaned.find(function (iList) { return iList.title === e2eList.title; });
        checkKeysAndValuesBothWays(e2eList, integrationList, "".concat(e2eList.title, " List"));
    });
};
var serviceRequestTests = function (e2eResources, integrationResources) {
    var e2eServiceRequests = e2eResources.filter(function (resource) { return resource.resourceType === 'ServiceRequest'; });
    var integrationServiceRequests = integrationResources.filter(function (resource) { return resource.resourceType === 'ServiceRequest'; });
    (0, test_1.expect)(e2eServiceRequests.length).toEqual(integrationServiceRequests.length);
    var e2eServiceRequest = cleanServiceRequest(e2eServiceRequests[0]);
    var integrationServiceRequest = cleanServiceRequest(integrationServiceRequests[0]);
    checkKeysAndValuesBothWays(e2eServiceRequest, integrationServiceRequest, 'ServiceRequest');
};
var clinicalImpressionTests = function (e2eResources, integrationResources) {
    var e2eClinicalImpressions = e2eResources.filter(function (resource) { return resource.resourceType === 'ClinicalImpression'; });
    var integrationClinicalImpressions = integrationResources.filter(function (resource) { return resource.resourceType === 'ClinicalImpression'; });
    (0, test_1.expect)(e2eClinicalImpressions.length).toEqual(integrationClinicalImpressions.length);
    var e2eClinicalImpression = cleanClinicalImpression(e2eClinicalImpressions[0]);
    var integrationClinicalImpression = cleanClinicalImpression(integrationClinicalImpressions[0]);
    checkKeysAndValuesBothWays(e2eClinicalImpression, integrationClinicalImpression, 'ClinicalImpression');
};
var documentReferenceTests = function (e2eResources, integrationResources) {
    var e2eDocumentReferences = e2eResources.filter(function (resource) { return resource.resourceType === 'DocumentReference'; });
    var integrationDocumentReferences = integrationResources.filter(function (resource) { return resource.resourceType === 'DocumentReference'; });
    (0, test_1.expect)(e2eDocumentReferences.length).toEqual(integrationDocumentReferences.length);
    var e2eCleaned = e2eDocumentReferences.map(function (docRef) { return cleanDocumentReference(docRef); });
    var integrationCleaned = integrationDocumentReferences.map(function (docRef) { return cleanDocumentReference(docRef); });
    e2eCleaned.forEach(function (e2eDocRef) {
        var _a, _b;
        var e2eDocTypeLoincCoding = (_b = (_a = e2eDocRef.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.system === 'http://loinc.org'; });
        var integrationDocRef = integrationCleaned.find(function (integrationDocRef) {
            var _a, _b;
            return (_b = (_a = integrationDocRef.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.system === 'http://loinc.org' && coding.code === e2eDocTypeLoincCoding.code; });
        });
        checkKeysAndValuesBothWays(e2eDocRef, integrationDocRef, "".concat(e2eDocTypeLoincCoding.code, " DocumentReference"));
    });
};
var questionnaireResponseTests = function (e2eResources, integrationResources) {
    var e2eQuestionnaireResponses = e2eResources.filter(function (resource) { return resource.resourceType === 'QuestionnaireResponse'; });
    var integrationQuestionnaireResponses = integrationResources.filter(function (resource) { return resource.resourceType === 'QuestionnaireResponse'; });
    (0, test_1.expect)(e2eQuestionnaireResponses.length).toEqual(integrationQuestionnaireResponses.length);
    var e2eQuestionnaireResponse = cleanQuestionnaireResponse(e2eQuestionnaireResponses[0]);
    var integrationQuestionnaireResponse = cleanQuestionnaireResponse(integrationQuestionnaireResponses[0]);
    checkKeysAndValuesBothWays(e2eQuestionnaireResponse, integrationQuestionnaireResponse, 'QuestionnaireResponse');
};
var consentTests = function (e2eResources, integrationResources) {
    var e2eConsents = e2eResources.filter(function (resource) { return resource.resourceType === 'Consent'; });
    var integrationConsents = integrationResources.filter(function (resource) { return resource.resourceType === 'Consent'; });
    (0, test_1.expect)(e2eConsents.length).toEqual(integrationConsents.length);
    var e2eConsent = cleanConsent(e2eConsents[0]);
    var integrationConsent = cleanConsent(integrationConsents[0]);
    checkKeysAndValuesBothWays(e2eConsent, integrationConsent, 'Consent');
};
var accountTests = function (e2eResources, integrationResources) {
    var e2eAccounts = e2eResources.filter(function (resource) { return resource.resourceType === 'Account'; });
    var integrationAccounts = integrationResources.filter(function (resource) { return resource.resourceType === 'Account'; });
    (0, test_1.expect)(e2eAccounts.length).toEqual(integrationAccounts.length);
    var e2eAccount = cleanAccount(e2eAccounts[0]);
    var integrationAccount = cleanAccount(integrationAccounts[0]);
    checkKeysAndValuesBothWays(e2eAccount, integrationAccount, 'Account');
};
var checkKeysAndValuesBothWays = function (e2eResource, integrationResource, label) {
    Object.entries(e2eResource).forEach(function (_a) {
        var _b;
        var key = _a[0], value = _a[1];
        (0, test_1.expect)(integrationResource[key], "expect integration ".concat(label, ".").concat(key, " value to be defined")).toBeDefined();
        // same meta tag sorting logic
        if (key === 'meta') {
            var valueMetaTags = value === null || value === void 0 ? void 0 : value.tag;
            var integrationMetaTags = (_b = integrationResource[key]) === null || _b === void 0 ? void 0 : _b.tag;
            if (valueMetaTags && integrationMetaTags) {
                var valueTagsSorted = valueMetaTags.sort(function (a, b) {
                    if (a.system === undefined && b.system === undefined) {
                        return 0;
                    }
                    else if (a.system === undefined) {
                        return 1; // undefined comes after defined
                    }
                    else if (b.system === undefined) {
                        return -1; // defined comes before undefined
                    }
                    return a.system.localeCompare(b.system);
                });
                var integrationTagsSorted = integrationMetaTags.sort(function (a, b) {
                    if (a.system === undefined && b.system === undefined) {
                        return 0;
                    }
                    else if (a.system === undefined) {
                        return 1; // undefined comes after defined
                    }
                    else if (b.system === undefined) {
                        return -1; // defined comes before undefined
                    }
                    return a.system.localeCompare(b.system);
                });
                var newVal = __assign(__assign({}, value), { meta: __assign(__assign({}, (value.meta || {})), { tag: valueTagsSorted }) });
                var compValue = __assign(__assign({}, integrationResource[key]), { meta: __assign(__assign({}, (integrationResource[key].meta || {})), { tag: integrationTagsSorted }) });
                (0, test_1.expect)(compValue, "expect integration ".concat(label, ".").concat(key, " value to be equal")).toEqual(newVal);
            }
            else {
                (0, test_1.expect)(integrationResource[key], "expect integration ".concat(label, ".").concat(key, " value to be equal")).toEqual(value);
            }
        }
        else {
            (0, test_1.expect)(integrationResource[key], "expect integration ".concat(label, ".").concat(key, " value to be equal")).toEqual(value);
        }
    });
    Object.entries(integrationResource).forEach(function (_a) {
        var key = _a[0], value = _a[1];
        (0, test_1.expect)(e2eResource[key], "expect e2e ".concat(label, ".").concat(key, " value to be defined")).toBeDefined();
        (0, test_1.expect)(e2eResource[key], "expect e2e ".concat(label, ".").concat(key, " value to be equal")).toEqual(value);
    });
};
var cleanOutMetaStuff = function (resource) {
    resource.id = SKIP_ME;
    resource.meta.versionId = SKIP_ME;
    resource.meta.lastUpdated = SKIP_ME;
    return resource;
};
var cleanAppointment = function (appointment) {
    var _a, _b;
    var cleanedAppointment = __assign({}, appointment);
    cleanedAppointment = cleanOutMetaStuff(cleanedAppointment);
    cleanedAppointment.participant[0].actor.reference =
        (_a = cleanedAppointment.participant[0].actor.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    cleanedAppointment.start = SKIP_ME;
    cleanedAppointment.end = SKIP_ME;
    cleanedAppointment.slot[0].reference = (_b = cleanedAppointment.slot[0].reference) === null || _b === void 0 ? void 0 : _b.split('/')[0]; // Cut off the UUID for comparison
    cleanedAppointment.created = SKIP_ME;
    return cleanedAppointment;
};
var cleanPatient = function (patient) {
    var cleanedPatient = __assign({}, patient);
    cleanedPatient = cleanOutMetaStuff(cleanedPatient);
    return cleanedPatient;
};
var cleanRelatedPerson = function (relatedPerson) {
    var _a;
    var cleanedRelatedPerson = __assign({}, relatedPerson);
    cleanedRelatedPerson = cleanOutMetaStuff(cleanedRelatedPerson);
    cleanedRelatedPerson.patient.reference = (_a = cleanedRelatedPerson.patient.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    return cleanedRelatedPerson;
};
var cleanPerson = function (person) {
    var cleanedPerson = __assign({}, person);
    cleanedPerson = cleanOutMetaStuff(cleanedPerson);
    cleanedPerson.link = []; // Can't check these because Person resource gets used for many different tests and it gets littered. It is effectively a shared resource.
    return cleanedPerson;
};
var cleanObservation = function (observation) {
    var _a, _b;
    var cleanedObservation = __assign({}, observation);
    cleanedObservation = cleanOutMetaStuff(cleanedObservation);
    cleanedObservation.subject.reference = (_a = cleanedObservation.subject.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    cleanedObservation.encounter.reference = (_b = cleanedObservation.encounter.reference) === null || _b === void 0 ? void 0 : _b.split('/')[0]; // cut off the UUID for comparison
    return cleanedObservation;
};
var cleanEncounter = function (encounter) {
    var _a, _b;
    var cleanedEncounter = __assign({}, encounter);
    cleanedEncounter = cleanOutMetaStuff(cleanedEncounter);
    cleanedEncounter.appointment.forEach(function (appointment) {
        var _a;
        appointment.reference = (_a = appointment.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    });
    cleanedEncounter.subject.reference = (_a = cleanedEncounter.subject.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    (_b = cleanedEncounter.statusHistory) === null || _b === void 0 ? void 0 : _b.forEach(function (statusHistory) {
        statusHistory.period.start = SKIP_ME;
    });
    return cleanedEncounter;
};
var cleanSlot = function (slot) {
    var _a;
    var cleanedSlot = __assign({}, slot);
    cleanedSlot = cleanOutMetaStuff(cleanedSlot);
    cleanedSlot.schedule.reference = (_a = cleanedSlot.schedule.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    cleanedSlot.start = SKIP_ME;
    cleanedSlot.end = SKIP_ME;
    return cleanedSlot;
};
var cleanList = function (list) {
    var _a, _b;
    var cleanedList = __assign({}, list);
    cleanedList = cleanOutMetaStuff(cleanedList);
    cleanedList.subject.reference = (_a = cleanedList.subject.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    (_b = cleanedList.entry) === null || _b === void 0 ? void 0 : _b.forEach(function (entry) {
        var _a;
        entry.item.reference = (_a = entry.item.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
        entry.date = SKIP_ME;
    });
    return cleanedList;
};
var cleanServiceRequest = function (serviceRequest) {
    var _a, _b;
    var cleanedServiceRequest = __assign({}, serviceRequest);
    cleanedServiceRequest = cleanOutMetaStuff(cleanedServiceRequest);
    cleanedServiceRequest.subject.reference = (_a = cleanedServiceRequest.subject.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    cleanedServiceRequest.encounter.reference = (_b = cleanedServiceRequest.encounter.reference) === null || _b === void 0 ? void 0 : _b.split('/')[0]; // cut off the UUID for comparison
    return cleanedServiceRequest;
};
var cleanClinicalImpression = function (clinicalImpression) {
    var _a, _b;
    var cleanedClinicalImpression = __assign({}, clinicalImpression);
    cleanedClinicalImpression = cleanOutMetaStuff(cleanedClinicalImpression);
    cleanedClinicalImpression.subject.reference = (_a = cleanedClinicalImpression.subject.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    cleanedClinicalImpression.encounter.reference = (_b = cleanedClinicalImpression.encounter.reference) === null || _b === void 0 ? void 0 : _b.split('/')[0]; // cut off the UUID for comparison
    return cleanedClinicalImpression;
};
var cleanDocumentReference = function (documentReference) {
    var _a, _b, _c;
    var cleanedDocumentReference = __assign({}, documentReference);
    cleanedDocumentReference = cleanOutMetaStuff(cleanedDocumentReference);
    cleanedDocumentReference.subject.reference = (_a = cleanedDocumentReference.subject.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    cleanedDocumentReference.date = SKIP_ME;
    cleanedDocumentReference.content.forEach(function (content) {
        content.attachment.url = SKIP_ME;
    });
    (_c = (_b = cleanedDocumentReference.context) === null || _b === void 0 ? void 0 : _b.related) === null || _c === void 0 ? void 0 : _c.forEach(function (related) {
        var _a;
        related.reference = (_a = related.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    });
    return cleanedDocumentReference;
};
var cleanQuestionnaireResponse = function (questionnaireResponse) {
    var _a, _b;
    var cleanedQuestionnaireResponse = __assign({}, questionnaireResponse);
    cleanedQuestionnaireResponse = cleanOutMetaStuff(cleanedQuestionnaireResponse);
    cleanedQuestionnaireResponse.subject.reference = (_a = cleanedQuestionnaireResponse.subject.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    cleanedQuestionnaireResponse.encounter.reference = (_b = cleanedQuestionnaireResponse.encounter.reference) === null || _b === void 0 ? void 0 : _b.split('/')[0]; // cut off the UUID for comparison
    cleanedQuestionnaireResponse.authored = SKIP_ME;
    return cleanedQuestionnaireResponse;
};
var cleanConsent = function (consent) {
    var _a, _b;
    var cleanedConsent = __assign({}, consent);
    cleanedConsent = cleanOutMetaStuff(cleanedConsent);
    cleanedConsent.patient.reference = (_a = cleanedConsent.patient.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    cleanedConsent.sourceReference.reference = (_b = cleanedConsent.sourceReference.reference) === null || _b === void 0 ? void 0 : _b.split('/')[0]; // cut off the UUID for comparison
    cleanedConsent.dateTime = SKIP_ME;
    return cleanedConsent;
};
var cleanAccount = function (account) {
    var _a, _b, _c;
    var cleanedAccount = __assign({}, account);
    cleanedAccount = cleanOutMetaStuff(cleanedAccount);
    (_a = cleanedAccount.subject) === null || _a === void 0 ? void 0 : _a.forEach(function (subject) {
        var _a;
        subject.reference = (_a = subject.reference) === null || _a === void 0 ? void 0 : _a.split('/')[0]; // cut off the UUID for comparison
    });
    var containedRelatedPerson = (_b = cleanedAccount.contained) === null || _b === void 0 ? void 0 : _b.find(function (contained) { return contained.resourceType === 'RelatedPerson'; });
    containedRelatedPerson.patient.reference = (_c = containedRelatedPerson.patient.reference) === null || _c === void 0 ? void 0 : _c.split('/')[0]; // cut off the UUID for comparison
    return cleanedAccount;
};
var getAllResourcesFromFHIR = function (appointmentId) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, e2eHandler.apiClient.fhir.search({
                    resourceType: 'Appointment',
                    params: [
                        {
                            name: '_id',
                            value: appointmentId,
                        },
                        {
                            name: '_include',
                            value: 'Appointment:patient',
                        },
                        {
                            name: '_include',
                            value: 'Appointment:slot',
                        },
                        {
                            name: '_include',
                            value: 'Appointment:location',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'RelatedPerson:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Encounter:appointment',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'DocumentReference:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'QuestionnaireResponse:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Person:relatedperson',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'List:subject',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Consent:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Account:patient',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'Observation:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'ServiceRequest:encounter',
                        },
                        {
                            name: '_revinclude:iterate',
                            value: 'ClinicalImpression:encounter',
                        },
                    ],
                })];
            case 1: return [2 /*return*/, (_a.sent()).unbundle()];
        }
    });
}); };
//# sourceMappingURL=integrationTestDataContractTests.spec.js.map