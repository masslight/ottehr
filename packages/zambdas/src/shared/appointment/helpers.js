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
exports.removePrefix = exports.telemedStatusToEncounter = void 0;
exports.getPatientFromAppointment = getPatientFromAppointment;
exports.patchAppointmentResource = patchAppointmentResource;
exports.patchEncounterResource = patchEncounterResource;
exports.getInsuranceRelatedRefsFromAppointmentExtension = getInsuranceRelatedRefsFromAppointmentExtension;
exports.checkUserPhoneNumber = checkUserPhoneNumber;
exports.createUpdateUserRelatedResources = createUpdateUserRelatedResources;
exports.creatingPatientUpdateRequest = creatingPatientUpdateRequest;
exports.getPatientPatchOpsPatientEmail = getPatientPatchOpsPatientEmail;
exports.creatingPatientCreateRequest = creatingPatientCreateRequest;
exports.generatePatientRelatedRequests = generatePatientRelatedRequests;
var luxon_1 = require("luxon");
var short_uuid_1 = require("short-uuid");
var utils_1 = require("utils");
var auth_1 = require("../auth");
var helpers_1 = require("../helpers");
function getPatientFromAppointment(appointment) {
    var _a, _b, _c;
    return (_c = (_b = (_a = appointment.participant
        .find(function (participantTemp) { var _a, _b; return (_b = (_a = participantTemp.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.split('/')[1];
}
function patchAppointmentResource(apptId, patchOperations, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: 'Appointment',
                            id: apptId,
                            operations: patchOperations,
                        })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response];
                case 2:
                    error_1 = _a.sent();
                    throw new Error("Failed to patch Appointment: ".concat(JSON.stringify(error_1)));
                case 3: return [2 /*return*/];
            }
        });
    });
}
function patchEncounterResource(encId, patchOperations, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var response, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: 'Encounter',
                            id: encId,
                            operations: patchOperations,
                        })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response];
                case 2:
                    error_2 = _a.sent();
                    console.log("Failed to patch Encounter: ".concat(JSON.stringify(error_2)));
                    throw new Error("Failed to patch Encounter: ".concat(JSON.stringify(error_2)));
                case 3: return [2 /*return*/];
            }
        });
    });
}
var telemedStatusToEncounter = function (telemedStatus) {
    switch (telemedStatus) {
        case 'ready':
            return 'planned';
        case 'pre-video':
            return 'arrived';
        case 'on-video':
            return 'in-progress';
        case 'unsigned':
            return 'finished';
        case 'complete':
            return 'finished';
        case 'cancelled':
            return 'cancelled';
    }
};
exports.telemedStatusToEncounter = telemedStatusToEncounter;
var utils_2 = require("utils");
Object.defineProperty(exports, "removePrefix", { enumerable: true, get: function () { return utils_2.removePrefix; } });
function getInsuranceRelatedRefsFromAppointmentExtension(appointment) {
    var _a, _b;
    var result = {};
    var mainExtension = (_a = appointment.extension) === null || _a === void 0 ? void 0 : _a.find(function (ext) { return ext.url === utils_1.AppointmentInsuranceRelatedResourcesExtension.extensionUrl; });
    (_b = mainExtension === null || mainExtension === void 0 ? void 0 : mainExtension.extension) === null || _b === void 0 ? void 0 : _b.forEach(function (ext) {
        var _a, _b, _c, _d, _e, _f;
        if (ext.url === utils_1.AppointmentInsuranceRelatedResourcesExtension.primaryCoverage.coverage.url)
            result.primaryCoverage = (_a = ext.valueReference) === null || _a === void 0 ? void 0 : _a.reference;
        if (ext.url === utils_1.AppointmentInsuranceRelatedResourcesExtension.primaryCoverage.eligibilityRequest.url)
            result.primaryCoverageEligibilityRequest = (_b = ext.valueReference) === null || _b === void 0 ? void 0 : _b.reference;
        if (ext.url === utils_1.AppointmentInsuranceRelatedResourcesExtension.primaryCoverage.eligibilityResponse.url)
            result.primaryCoverageEligibilityResponse = (_c = ext.valueReference) === null || _c === void 0 ? void 0 : _c.reference;
        if (ext.url === utils_1.AppointmentInsuranceRelatedResourcesExtension.secondaryCoverage.coverage.url)
            result.secondaryCoverage = (_d = ext.valueReference) === null || _d === void 0 ? void 0 : _d.reference;
        if (ext.url === utils_1.AppointmentInsuranceRelatedResourcesExtension.secondaryCoverage.eligibilityRequest.url)
            result.secondaryCoverageEligibilityRequest = (_e = ext.valueReference) === null || _e === void 0 ? void 0 : _e.reference;
        if (ext.url === utils_1.AppointmentInsuranceRelatedResourcesExtension.secondaryCoverage.eligibilityResponse.url)
            result.secondaryCoverageEligibilityResponse = (_f = ext.valueReference) === null || _f === void 0 ? void 0 : _f.reference;
    });
    return result;
}
function checkUserPhoneNumber(patient, user) {
    var patientNumberToText = undefined;
    // If the user is the ottehr staff, which happens when using the add-patient page,
    // user.name will not be a phone number, like it would be for a patient. In this
    // case, we must insert the patient's phone number using patient.phoneNumber
    // we use .startsWith('+') because the user's phone number will start with "+"
    var isEHRUser = (0, auth_1.checkIsEHRUser)(user);
    if (isEHRUser) {
        // User is ottehr staff
        if (!patient.phoneNumber) {
            throw new Error('No phone number found for patient');
        }
        patientNumberToText = (0, utils_1.formatPhoneNumber)(patient.phoneNumber);
        if (!patientNumberToText) {
            throw new Error('Patient phone number has some wrong format');
        }
    }
    else {
        // User is patient and auth0 already appends a +1 to the phone number
        patientNumberToText = user.name;
    }
    return patientNumberToText;
}
function createUpdateUserRelatedResources(oystehr, patientInfo, fhirPatient, user) {
    return __awaiter(this, void 0, void 0, function () {
        var verifiedPhoneNumber, userResource, relatedPerson, person;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('patient info: ' + JSON.stringify(patientInfo));
                    verifiedPhoneNumber = undefined;
                    if (!(!patientInfo.id && fhirPatient.id)) return [3 /*break*/, 2];
                    console.log('New patient');
                    // If it is a new patient, create a RelatedPerson resource for the Patient
                    // and create a Person resource if there is not one for the account
                    verifiedPhoneNumber = checkUserPhoneNumber(patientInfo, user);
                    return [4 /*yield*/, (0, utils_1.createUserResourcesForPatient)(oystehr, fhirPatient.id, verifiedPhoneNumber)];
                case 1:
                    userResource = _c.sent();
                    relatedPerson = userResource.relatedPerson;
                    person = userResource.person;
                    console.log(5, (_b = (_a = person.telecom) === null || _a === void 0 ? void 0 : _a.find(function (telecomTemp) { return telecomTemp.system === 'phone'; })) === null || _b === void 0 ? void 0 : _b.value);
                    if (!person.id) {
                        throw new Error('Person resource does not have an ID');
                    }
                    return [2 /*return*/, { relatedPersonRef: "RelatedPerson/".concat(relatedPerson.id), verifiedPhoneNumber: verifiedPhoneNumber }];
                case 2: return [2 /*return*/, { relatedPersonRef: undefined, verifiedPhoneNumber: verifiedPhoneNumber }];
            }
        });
    });
}
function creatingPatientUpdateRequest(patient, maybeFhirPatient) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (!patient.id)
        return undefined;
    console.log("Have patient.id, ".concat(patient.id, " fetching Patient and building PATCH request"));
    var updatePatientRequest = undefined;
    var patientPatchOperations = [];
    // store form user (aka emailUser)
    var patientExtension = maybeFhirPatient.extension || [];
    // Store weight
    var weightExtIndex = patientExtension.findIndex(function (ext) { return ext.url === utils_1.FHIR_EXTENSION.Patient.weight.url; });
    var weightLastUpdatedIndex = patientExtension.findIndex(function (ext) { return ext.url === utils_1.FHIR_EXTENSION.Patient.weightLastUpdated.url; });
    if (patient.weight) {
        var newWeight = String(patient.weight);
        var weight = {
            url: utils_1.FHIR_EXTENSION.Patient.weight.url,
            valueString: newWeight,
        };
        var weightLastUpdated = {
            url: utils_1.FHIR_EXTENSION.Patient.weightLastUpdated.url,
            valueString: luxon_1.DateTime.now().toFormat('yyyy-LL-dd'),
        };
        // Check if weight exists
        if (weightExtIndex >= 0) {
            // Update weight if supplied to update weightLastUpdated
            patientExtension[weightExtIndex] = weight;
            patientExtension[weightLastUpdatedIndex] = weightLastUpdated;
        }
        else if (weightLastUpdatedIndex >= 0) {
            // Patient weight used to exist but has been removed, add to patch operations
            patientExtension.push(weight);
            patientExtension[weightLastUpdatedIndex] = weightLastUpdated;
        }
        else {
            // Since no extensions exist, it must be added via patch operations
            patientExtension.push(weight);
            patientExtension.push(weightLastUpdated);
        }
    }
    else if (weightLastUpdatedIndex >= 0 && weightExtIndex >= 0) {
        // Weight removed but has been provided before
        patientExtension = __spreadArray(__spreadArray([], patientExtension.slice(0, weightExtIndex), true), patientExtension.slice(weightExtIndex + 1), true);
        // Do not update weight last updated date
    }
    var guardianExtIndex = patientExtension.findIndex(function (ext) { return ext.url === utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url; });
    var guardianValue = (_a = patient.authorizedNonLegalGuardians) !== null && _a !== void 0 ? _a : (_c = (_b = maybeFhirPatient.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url; })) === null || _c === void 0 ? void 0 : _c.valueString;
    if (guardianValue) {
        var extensionValue = {
            url: utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url,
            valueString: guardianValue,
        };
        if (guardianExtIndex >= 0) {
            patientExtension[guardianExtIndex] = extensionValue;
        }
        else {
            patientExtension.push(extensionValue);
        }
    }
    else if (guardianExtIndex >= 0) {
        patientExtension = __spreadArray(__spreadArray([], patientExtension.slice(0, guardianExtIndex), true), patientExtension.slice(guardianExtIndex + 1), true);
    }
    patientPatchOperations.push({
        op: maybeFhirPatient.extension ? 'replace' : 'add',
        path: '/extension',
        value: patientExtension,
    });
    var emailPatchOps = getPatientPatchOpsPatientEmail(maybeFhirPatient, patient.email);
    if (emailPatchOps.length >= 1) {
        patientPatchOperations.push.apply(patientPatchOperations, emailPatchOps);
    }
    var fhirPatientName = (0, helpers_1.assertDefined)(maybeFhirPatient.name, 'patient.name');
    var fhirPatientOfficialNameIndex = fhirPatientName.findIndex(function (name) { return name.use === 'official'; });
    if (fhirPatientOfficialNameIndex === -1) {
        fhirPatientOfficialNameIndex = 0;
    }
    var fhirPatientMiddleName = (_d = fhirPatientName[fhirPatientOfficialNameIndex].given) === null || _d === void 0 ? void 0 : _d[1];
    if (patient.middleName && !fhirPatientMiddleName) {
        console.log('adding patch op to add middle name', patient.middleName);
        patientPatchOperations.push({
            op: 'add',
            path: "/name/".concat(fhirPatientOfficialNameIndex, "/given/1"),
            value: patient.middleName,
        });
    }
    var fhirPatientPreferredName = (_e = maybeFhirPatient === null || maybeFhirPatient === void 0 ? void 0 : maybeFhirPatient.name) === null || _e === void 0 ? void 0 : _e.find(function (name) { return name.use === 'nickname'; });
    var fhirPatientPreferredNameIndex = (_f = maybeFhirPatient.name) === null || _f === void 0 ? void 0 : _f.findIndex(function (name) { return name.use === 'nickname'; });
    if (patient.chosenName) {
        if (fhirPatientPreferredName) {
            if (((_g = fhirPatientPreferredName.given) === null || _g === void 0 ? void 0 : _g[0]) !== patient.chosenName) {
                patientPatchOperations.push({
                    op: 'replace',
                    path: "/name/".concat(fhirPatientPreferredNameIndex, "/given/0"),
                    value: patient.chosenName,
                });
            }
        }
        else {
            patientPatchOperations.push({
                op: 'add',
                path: "/name/-",
                value: {
                    given: [patient.chosenName],
                    use: 'nickname',
                },
            });
        }
    }
    if (patient.sex !== maybeFhirPatient.gender) {
        // a value exists in the gender path on the patient resource
        if (maybeFhirPatient.gender) {
            patientPatchOperations.push({
                op: 'replace',
                path: "/gender",
                value: patient.sex,
            });
        }
        else {
            patientPatchOperations.push({
                op: 'add',
                path: "/gender",
                value: patient.sex,
            });
        }
    }
    var patientDateOfBirth = (0, utils_1.removeTimeFromDate)((_h = patient.dateOfBirth) !== null && _h !== void 0 ? _h : '');
    if (maybeFhirPatient.birthDate !== patientDateOfBirth) {
        patientPatchOperations.push({
            op: maybeFhirPatient.birthDate ? 'replace' : 'add',
            path: '/birthDate',
            value: patientDateOfBirth,
        });
    }
    if (patient.ssn) {
        var identifier_1 = (0, utils_1.makeSSNIdentifier)(patient.ssn);
        var newIdentifier = ((_j = maybeFhirPatient.identifier) !== null && _j !== void 0 ? _j : []).filter(function (id) { return id.system !== identifier_1.system; });
        newIdentifier.push(identifier_1);
        if (maybeFhirPatient.identifier) {
            // identifier exists
            patientPatchOperations.push({
                op: 'replace',
                path: "/identifier",
                value: newIdentifier,
            });
        }
        else {
            patientPatchOperations.push({
                op: 'add',
                path: "/identifier",
                value: newIdentifier,
            });
        }
    }
    if (patientPatchOperations.length >= 1) {
        console.log('getting patch binary for patient operations');
        updatePatientRequest = (0, utils_1.getPatchBinary)({
            resourceType: 'Patient',
            resourceId: patient.id,
            patchOperations: patientPatchOperations,
        });
    }
    return updatePatientRequest;
}
function getPatientPatchOpsPatientEmail(maybeFhirPatient, email) {
    var patientPatchOperations = [];
    // update email
    if (email) {
        var telecom = maybeFhirPatient.telecom;
        var curEmail = telecom === null || telecom === void 0 ? void 0 : telecom.find(function (telecomToCheck) { return telecomToCheck.system === 'email'; });
        var curEmailIndex = telecom === null || telecom === void 0 ? void 0 : telecom.findIndex(function (telecomToCheck) { return telecomToCheck.system === 'email'; });
        // check email exists in telecom but is different
        if (telecom && curEmailIndex && curEmailIndex > -1 && email !== curEmail) {
            telecom[curEmailIndex] = {
                system: 'email',
                value: email,
            };
            patientPatchOperations.push({
                op: 'replace',
                path: '/telecom',
                value: telecom,
            });
        }
        // check if telecom exists but without email
        if (telecom && !curEmail) {
            telecom.push({
                system: 'email',
                value: email,
            });
            patientPatchOperations.push({
                op: 'replace',
                path: '/telecom',
                value: telecom,
            });
        }
        // add if no telecom
        if (!telecom) {
            patientPatchOperations.push({
                op: 'add',
                path: '/telecom',
                value: [
                    {
                        system: 'email',
                        value: email,
                    },
                ],
            });
        }
    }
    return [];
}
function creatingPatientCreateRequest(patient, isEHRUser) {
    var _a, _b, _c, _d;
    var createPatientRequest = undefined;
    if (!patient.firstName) {
        throw new Error('First name is undefined');
    }
    console.log('building patient resource');
    var patientResource = {
        resourceType: 'Patient',
        name: [
            {
                given: patient.middleName ? [patient.firstName, patient.middleName] : [patient.firstName],
                family: patient.lastName,
                use: 'official',
            },
        ],
        birthDate: (0, utils_1.removeTimeFromDate)((_a = patient.dateOfBirth) !== null && _a !== void 0 ? _a : ''),
        gender: patient.sex,
        active: true,
    };
    if (patient.chosenName) {
        patientResource.name.push({
            given: [patient.chosenName],
            use: 'nickname',
        });
    }
    if ((_b = patient.tags) === null || _b === void 0 ? void 0 : _b.length) {
        patientResource.meta = {
            tag: patient.tags,
        };
    }
    if (patient.weight) {
        (_c = patientResource.extension) === null || _c === void 0 ? void 0 : _c.push({
            url: utils_1.FHIR_EXTENSION.Patient.weight.url,
            valueString: String(patient.weight),
        });
        (_d = patientResource.extension) === null || _d === void 0 ? void 0 : _d.push({
            url: utils_1.FHIR_EXTENSION.Patient.weightLastUpdated.url,
            valueString: luxon_1.DateTime.now().toFormat('yyyy-LL-dd'),
        });
    }
    if (patient.email) {
        if (isEHRUser) {
            patientResource.telecom = [
                {
                    system: 'email',
                    value: patient.email,
                },
                {
                    system: 'phone',
                    value: (0, utils_1.normalizePhoneNumber)(patient.phoneNumber),
                },
            ];
        }
        else {
            patientResource.telecom = [
                {
                    system: 'email',
                    value: patient.email,
                },
            ];
        }
    }
    if (patient.address) {
        patientResource.address = patient.address;
    }
    if (patient.authorizedNonLegalGuardians) {
        if (!patientResource.extension) {
            patientResource.extension = [];
        }
        patientResource.extension.push({
            url: utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url,
            valueString: String(patient.authorizedNonLegalGuardians),
        });
    }
    if (patient.ssn) {
        var identifier = (0, utils_1.makeSSNIdentifier)(patient.ssn);
        patientResource.identifier = [identifier];
    }
    console.log('creating patient request for new patient resource');
    createPatientRequest = {
        method: 'POST',
        url: '/Patient',
        fullUrl: "urn:uuid:".concat((0, short_uuid_1.uuid)()),
        resource: patientResource,
    };
    return createPatientRequest;
}
function generatePatientRelatedRequests(user, patient, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var maybeFhirPatient, updatePatientRequest, createPatientRequest, verifiedPhoneNumber, listRequests, isEHRUser, _a, foundPatient, foundPhoneNumber, patientLists;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    maybeFhirPatient = undefined;
                    updatePatientRequest = undefined;
                    createPatientRequest = undefined;
                    verifiedPhoneNumber = undefined;
                    listRequests = [];
                    isEHRUser = (0, auth_1.checkIsEHRUser)(user);
                    if (!patient.id) return [3 /*break*/, 2];
                    console.log("Have patient.id, ".concat(patient.id, " fetching Patient and building PATCH request"));
                    return [4 /*yield*/, (0, utils_1.getPatientResourceWithVerifiedPhoneNumber)(patient.id, oystehr)];
                case 1:
                    _a = _b.sent(), foundPatient = _a.patient, foundPhoneNumber = _a.verifiedPhoneNumber;
                    maybeFhirPatient = foundPatient;
                    verifiedPhoneNumber = foundPhoneNumber;
                    if (!maybeFhirPatient) {
                        throw utils_1.PATIENT_NOT_FOUND_ERROR;
                    }
                    updatePatientRequest = creatingPatientUpdateRequest(patient, maybeFhirPatient);
                    return [3 /*break*/, 3];
                case 2:
                    createPatientRequest = creatingPatientCreateRequest(patient, isEHRUser);
                    if (createPatientRequest === null || createPatientRequest === void 0 ? void 0 : createPatientRequest.fullUrl) {
                        patientLists = (0, utils_1.createPatientDocumentLists)(createPatientRequest.fullUrl);
                        listRequests.push.apply(listRequests, patientLists.map(function (list) { return ({
                            method: 'POST',
                            url: '/List',
                            resource: list,
                        }); }));
                    }
                    _b.label = 3;
                case 3: return [2 /*return*/, {
                        updatePatientRequest: updatePatientRequest,
                        createPatientRequest: createPatientRequest,
                        listRequests: listRequests,
                        verifiedPhoneNumber: verifiedPhoneNumber,
                        isEHRUser: isEHRUser,
                        maybeFhirPatient: maybeFhirPatient,
                    }];
            }
        });
    });
}
