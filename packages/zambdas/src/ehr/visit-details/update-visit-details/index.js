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
exports.index = void 0;
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../../shared");
var ZAMBDA_NAME = 'update-visit-details';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, effectInput, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                console.group('validateRequestParameters');
                validatedParameters = validateRequestParameters(input);
                console.groupEnd();
                console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
                secrets = validatedParameters.secrets;
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 1:
                m2mToken = _a.sent();
                oystehr = (0, shared_1.createOystehrClient)(m2mToken, secrets);
                return [4 /*yield*/, complexValidation(validatedParameters, oystehr)];
            case 2:
                effectInput = _a.sent();
                console.log('effectInput', JSON.stringify(effectInput, null, 2));
                return [4 /*yield*/, performEffect(effectInput, oystehr)];
            case 3:
                _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({}),
                    }];
            case 4:
                error_1 = _a.sent();
                console.log('Error: ', JSON.stringify(error_1.message));
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var patient, appointment, bookingDetails, user, encounter, patchRequests, patientPatchOps, updateTag, removeStaffUpdateTagOp, patientPatch, appointmentExt, dobNotConfirmedIdx, appointmentPatch, _a, patientFirstName, patientMiddleName, patientLastName, patientSuffix, patientPatchOps, storedMiddleName, updateTag, storedSuffix, removeStaffUpdateTagOp, op, _b, existingReasonForVisit, existingAdditionalDetails, newAdditionalDetails, value, appointmentPatchOps, extension, extensionIndex, skipUpdate, op, patientPatchOps, consentAttested, encounterExt, newExtension, encounterPatch, newExtEntry, encounterPatch, appointmentPatch, consolidatedPatches;
    var _c, _d, _e, _f, _g, _h, _j, _k, _l;
    return __generator(this, function (_m) {
        switch (_m.label) {
            case 0:
                patient = input.patient, appointment = input.appointment, bookingDetails = input.bookingDetails, user = input.user, encounter = input.encounter;
                patchRequests = [];
                if (bookingDetails.confirmedDob) {
                    patientPatchOps = [
                        {
                            op: 'replace',
                            path: '/birthDate',
                            value: bookingDetails.confirmedDob,
                        },
                    ];
                    updateTag = (0, utils_1.getCriticalUpdateTagOp)(patient, "Staff ".concat((user === null || user === void 0 ? void 0 : user.email) ? user.email : "(".concat(user === null || user === void 0 ? void 0 : user.id, ")")));
                    patientPatchOps.push(updateTag);
                    removeStaffUpdateTagOp = (0, utils_1.cleanUpStaffHistoryTag)(patient, 'dob');
                    if (removeStaffUpdateTagOp)
                        patientPatchOps.push(removeStaffUpdateTagOp);
                    patientPatch = {
                        url: '/Patient/' + patient.id,
                        method: 'PATCH',
                        operations: patientPatchOps,
                    };
                    patchRequests.push(patientPatch);
                    appointmentExt = appointment === null || appointment === void 0 ? void 0 : appointment.extension;
                    dobNotConfirmedIdx = (0, utils_1.getUnconfirmedDOBIdx)(appointment);
                    if (dobNotConfirmedIdx !== undefined && dobNotConfirmedIdx >= 0) {
                        appointmentExt === null || appointmentExt === void 0 ? void 0 : appointmentExt.splice(dobNotConfirmedIdx, 1);
                        appointmentPatch = {
                            url: '/Appointment/' + appointment.id,
                            method: 'PATCH',
                            operations: [
                                {
                                    op: (appointment === null || appointment === void 0 ? void 0 : appointment.extension) ? 'replace' : 'add',
                                    path: '/extension',
                                    value: appointmentExt,
                                },
                            ],
                        };
                        patchRequests.push(appointmentPatch);
                    }
                }
                if (bookingDetails.patientName) {
                    _a = bookingDetails.patientName, patientFirstName = _a.first, patientMiddleName = _a.middle, patientLastName = _a.last, patientSuffix = _a.suffix;
                    patientPatchOps = [
                        {
                            op: 'replace',
                            path: '/name/0/given/0',
                            value: patientFirstName === null || patientFirstName === void 0 ? void 0 : patientFirstName.trim(),
                        },
                        {
                            op: 'replace',
                            path: '/name/0/family',
                            value: patientLastName === null || patientLastName === void 0 ? void 0 : patientLastName.trim(),
                        },
                    ];
                    storedMiddleName = (_e = (_d = (_c = patient === null || patient === void 0 ? void 0 : patient.name) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.given) === null || _e === void 0 ? void 0 : _e[1];
                    if (patientMiddleName && !storedMiddleName) {
                        patientPatchOps.push({
                            op: 'add',
                            path: '/name/0/given/1',
                            value: patientMiddleName === null || patientMiddleName === void 0 ? void 0 : patientMiddleName.trim(),
                        });
                    }
                    else if (!patientMiddleName && storedMiddleName) {
                        patientPatchOps.push({
                            op: 'remove',
                            path: '/name/0/given/1',
                        });
                    }
                    else if (patientMiddleName && storedMiddleName) {
                        patientPatchOps.push({
                            op: 'replace',
                            path: '/name/0/given/1',
                            value: patientMiddleName === null || patientMiddleName === void 0 ? void 0 : patientMiddleName.trim(),
                        });
                    }
                    updateTag = (0, utils_1.getCriticalUpdateTagOp)(patient, "Staff ".concat((user === null || user === void 0 ? void 0 : user.email) ? user.email : "(".concat(user === null || user === void 0 ? void 0 : user.id, ")")));
                    patientPatchOps.push(updateTag);
                    storedSuffix = (_h = (_g = (_f = patient === null || patient === void 0 ? void 0 : patient.name) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.suffix) === null || _h === void 0 ? void 0 : _h[0];
                    if (patientSuffix && !storedSuffix) {
                        patientPatchOps.push({
                            op: 'add',
                            path: '/name/0/suffix',
                            value: [patientSuffix],
                        });
                    }
                    else if (!patientSuffix && storedSuffix) {
                        patientPatchOps.push({
                            op: 'remove',
                            path: '/name/0/suffix',
                        });
                    }
                    else if (patientSuffix && storedSuffix) {
                        patientPatchOps.push({
                            op: 'replace',
                            path: '/name/0/suffix',
                            value: [patientSuffix],
                        });
                    }
                    removeStaffUpdateTagOp = (0, utils_1.cleanUpStaffHistoryTag)(patient, 'name');
                    if (removeStaffUpdateTagOp)
                        patientPatchOps.push(removeStaffUpdateTagOp);
                    patchRequests.push({
                        method: 'PATCH',
                        url: "/Patient/".concat(patient.id),
                        operations: patientPatchOps,
                    });
                }
                if (bookingDetails.reasonForVisit || bookingDetails.additionalDetails) {
                    op = appointment.description ? 'replace' : 'add';
                    _b = (0, utils_1.getReasonForVisitAndAdditionalDetailsFromAppointment)(appointment), existingReasonForVisit = _b.reasonForVisit, existingAdditionalDetails = _b.additionalDetails;
                    newAdditionalDetails = (_j = bookingDetails.additionalDetails) !== null && _j !== void 0 ? _j : existingAdditionalDetails;
                    value = "".concat((_k = bookingDetails.reasonForVisit) !== null && _k !== void 0 ? _k : (existingReasonForVisit || '')) +
                        (newAdditionalDetails ? " - ".concat((_l = newAdditionalDetails !== null && newAdditionalDetails !== void 0 ? newAdditionalDetails : existingAdditionalDetails) !== null && _l !== void 0 ? _l : '') : '');
                    appointmentPatchOps = [
                        {
                            op: op,
                            path: '/description',
                            value: value,
                        },
                    ];
                    patchRequests.push({
                        method: 'PATCH',
                        url: "/Appointment/".concat(appointment.id),
                        operations: appointmentPatchOps,
                    });
                }
                if (bookingDetails.authorizedNonLegalGuardians !== undefined) {
                    extension = patient.extension || [];
                    extensionIndex = (patient.extension || []).findIndex(function (ext) {
                        return ext.url === utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url;
                    });
                    skipUpdate = false;
                    if (extensionIndex > -1) {
                        if (bookingDetails.authorizedNonLegalGuardians) {
                            extension[extensionIndex].valueString = bookingDetails.authorizedNonLegalGuardians;
                        }
                        else {
                            extension.splice(extensionIndex, 1);
                        }
                    }
                    else if (bookingDetails.authorizedNonLegalGuardians) {
                        extension.push({
                            url: utils_1.FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url,
                            valueString: bookingDetails.authorizedNonLegalGuardians,
                        });
                    }
                    else {
                        skipUpdate = true;
                    }
                    if (!skipUpdate) {
                        op = extensionIndex > -1 ? 'replace' : 'add';
                        patientPatchOps = [
                            {
                                op: op,
                                path: '/extension',
                                value: extension,
                            },
                        ];
                        patchRequests.push({
                            method: 'PATCH',
                            url: "/Patient/".concat(patient.id),
                            operations: patientPatchOps,
                        });
                    }
                }
                if (bookingDetails.consentForms) {
                    consentAttested = bookingDetails.consentForms.consentAttested;
                    encounterExt = (encounter === null || encounter === void 0 ? void 0 : encounter.extension) || [];
                    newExtension = encounterExt.filter(function (ext) {
                        return ext.url !== utils_1.FHIR_EXTENSION.Encounter.attestedConsent.url;
                    });
                    if (!consentAttested) {
                        if (newExtension.length !== encounterExt.length) {
                            encounterPatch = {
                                method: 'PATCH',
                                url: "/Encounter/".concat(encounter.id),
                                operations: [
                                    {
                                        op: 'replace',
                                        path: '/extension',
                                        value: newExtension,
                                    },
                                ],
                            };
                            patchRequests.push(encounterPatch);
                        }
                    }
                    else {
                        newExtEntry = {
                            url: utils_1.FHIR_EXTENSION.Encounter.attestedConsent.url,
                            valueSignature: {
                                when: luxon_1.DateTime.now().setZone('utc').toISO(),
                                who: {
                                    reference: user.profile,
                                    display: "".concat(user.name, " - userId:").concat(user.id),
                                },
                                type: [
                                    {
                                        system: 'http://uri.etsi.org/01903/v1.2.2',
                                        code: 'ProofOfReceipt',
                                    },
                                ],
                            },
                        };
                        newExtension.push(newExtEntry);
                        encounterPatch = {
                            method: 'PATCH',
                            url: "/Encounter/".concat(encounter.id),
                            operations: [
                                {
                                    op: (encounter === null || encounter === void 0 ? void 0 : encounter.extension) ? 'replace' : 'add',
                                    path: '/extension',
                                    value: newExtension,
                                },
                            ],
                        };
                        patchRequests.push(encounterPatch);
                    }
                }
                if (bookingDetails.serviceCategory) {
                    appointmentPatch = {
                        url: '/Appointment/' + appointment.id,
                        method: 'PATCH',
                        operations: [
                            {
                                op: (appointment === null || appointment === void 0 ? void 0 : appointment.serviceCategory) ? 'replace' : 'add',
                                path: '/serviceCategory',
                                value: [
                                    {
                                        coding: [bookingDetails.serviceCategory],
                                    },
                                ],
                            },
                        ],
                    };
                    patchRequests.push(appointmentPatch);
                }
                consolidatedPatches = consolidatePatchRequests(patchRequests);
                // Batch Appointment and Patient updates
                return [4 /*yield*/, oystehr.fhir.transaction({
                        requests: consolidatedPatches,
                    })];
            case 1:
                // Batch Appointment and Patient updates
                _m.sent();
                return [2 /*return*/];
        }
    });
}); };
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentId, userToken, user, patientAndThings, appointment, patientResource, encounterResource;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                appointmentId = input.appointmentId, userToken = input.userToken;
                return [4 /*yield*/, (0, utils_1.userMe)(userToken, input.secrets)];
            case 1:
                user = _a.sent();
                if (!user) {
                    throw new Error('user unexpectedly not found');
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'Appointment',
                        params: [
                            { name: '_id', value: appointmentId },
                            { name: '_include', value: 'Appointment:patient' },
                            { name: '_revinclude', value: 'Encounter:appointment' },
                        ],
                    })];
            case 2:
                patientAndThings = (_a.sent()).unbundle();
                appointment = patientAndThings.find(function (entry) { return entry.resourceType === 'Appointment'; });
                patientResource = patientAndThings.find(function (entry) { return entry.resourceType === 'Patient'; });
                encounterResource = patientAndThings.find(function (entry) { return entry.resourceType === 'Encounter'; });
                if (!appointment) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Appointment');
                }
                if (!patientResource || !patientResource.id) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Patient');
                }
                if (!encounterResource || !encounterResource.id) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Encounter');
                }
                // const selfPay = getPaymentVariantFromEncounter(encounterResource) === PaymentVariant.selfPay;
                return [2 /*return*/, __assign(__assign({}, input), { patient: patientResource, appointment: appointment, encounter: encounterResource, user: user })];
        }
    });
}); };
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    var userToken = input.headers.Authorization.replace('Bearer ', '');
    if (!userToken) {
        throw new Error('user token unexpectedly missing');
    }
    console.log('input', JSON.stringify(input, null, 2));
    var secrets = input.secrets;
    var _a = JSON.parse(input.body), appointmentId = _a.appointmentId, bookingDetails = _a.bookingDetails;
    if (!appointmentId) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['appointmentId']);
    }
    if ((0, utils_1.isValidUUID)(appointmentId) === false) {
        throw (0, utils_1.INVALID_RESOURCE_ID_ERROR)('appointmentId');
    }
    if (!bookingDetails) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(['bookingDetails']);
    }
    if (typeof bookingDetails !== 'object') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('bookingDetails must be an object');
    }
    if (bookingDetails.reasonForVisit && typeof bookingDetails.reasonForVisit !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('reasonForVisit must be a string');
    }
    else if (bookingDetails.reasonForVisit &&
        !utils_1.VALUE_SETS.reasonForVisitOptions.map(function (option) { return option.value; }).includes(bookingDetails.reasonForVisit)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("reasonForVisit, \"".concat(bookingDetails.reasonForVisit, "\", is not a valid option"));
    }
    if (bookingDetails.additionalDetails && typeof bookingDetails.additionalDetails !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('additionalDetails must be a string');
    }
    else if (bookingDetails.additionalDetails && bookingDetails.additionalDetails.length > utils_1.REASON_ADDITIONAL_MAX_CHAR) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("additionalDetails must be at most ".concat(utils_1.REASON_ADDITIONAL_MAX_CHAR, " characters"));
    }
    if (bookingDetails.authorizedNonLegalGuardians && typeof bookingDetails.authorizedNonLegalGuardians !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('authorizedNonLegalGuardians must be a string');
    }
    if (bookingDetails.confirmedDob && typeof bookingDetails.confirmedDob !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('confirmedDob must be a string');
    }
    else if (bookingDetails.confirmedDob) {
        var dob = luxon_1.DateTime.fromISO(bookingDetails.confirmedDob);
        if (!dob.isValid) {
            throw (0, utils_1.INVALID_INPUT_ERROR)("confirmedDob, \"".concat(bookingDetails.confirmedDob, "\", is not a valid iso date string"));
        }
    }
    if (bookingDetails.patientName && typeof bookingDetails.patientName !== 'object') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"patientName" must be an object');
    }
    else if (bookingDetails.patientName && Object.keys(bookingDetails.patientName).length === 0) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"patientName" must have at least one field defined');
    }
    else if (bookingDetails.patientName) {
        if (bookingDetails.patientName.first && typeof bookingDetails.patientName.first !== 'string') {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"patientName.first" must be a string');
        }
        if (bookingDetails.patientName.last && typeof bookingDetails.patientName.last !== 'string') {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"patientName.last" must be a string');
        }
        if (bookingDetails.patientName.middle && typeof bookingDetails.patientName.middle !== 'string') {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"patientName.middle" must be a string');
        }
        if (bookingDetails.patientName.suffix && typeof bookingDetails.patientName.suffix !== 'string') {
            throw (0, utils_1.INVALID_INPUT_ERROR)('"patientName.suffix" must be a string');
        }
        if (bookingDetails.patientName.first !== undefined && bookingDetails.patientName.first.trim().length === 0) {
            throw (0, utils_1.INVALID_INPUT_ERROR)('patientName must have a non-empty first name');
        }
        if (bookingDetails.patientName.last !== undefined && bookingDetails.patientName.last.trim().length === 0) {
            throw (0, utils_1.INVALID_INPUT_ERROR)('patientName must have a non-empty last name');
        }
    }
    if (bookingDetails.consentForms && typeof bookingDetails.consentForms !== 'object') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"consentForms" must be an object');
    }
    else if (bookingDetails.consentForms) {
        if (bookingDetails.consentForms.consentAttested &&
            typeof bookingDetails.consentForms.consentAttested !== 'boolean') {
            throw (0, utils_1.INVALID_INPUT_ERROR)('consentForms.consentAttested must be a boolean');
        }
    }
    var serviceCategory = undefined;
    if (bookingDetails.serviceCategory && typeof bookingDetails.serviceCategory !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)('serviceCategory must be a string');
    }
    else if (bookingDetails.serviceCategory) {
        serviceCategory = utils_1.BOOKING_CONFIG.serviceCategories.find(function (category) { return category.code === bookingDetails.serviceCategory; });
        if (!serviceCategory) {
            throw (0, utils_1.INVALID_INPUT_ERROR)("serviceCategory, \"".concat(bookingDetails.serviceCategory, "\", is not a valid option"));
        }
    }
    // Require at least one field to be present
    if (bookingDetails.reasonForVisit === undefined &&
        bookingDetails.additionalDetails === undefined &&
        bookingDetails.authorizedNonLegalGuardians === undefined &&
        bookingDetails.confirmedDob === undefined &&
        bookingDetails.patientName === undefined &&
        bookingDetails.consentForms === undefined &&
        bookingDetails.serviceCategory === undefined) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('at least one field in bookingDetails must be provided');
    }
    return {
        secrets: secrets,
        userToken: userToken,
        appointmentId: appointmentId,
        bookingDetails: __assign(__assign({}, bookingDetails), { serviceCategory: serviceCategory }),
    };
};
var consolidatePatchRequests = function (ops) {
    var consolidated = {};
    ops.forEach(function (op) {
        var _a;
        var key = op.url;
        if (!consolidated[key]) {
            consolidated[key] = __assign({}, op);
        }
        else {
            (_a = consolidated[key].operations).push.apply(_a, op.operations);
        }
    });
    return Object.values(consolidated);
};
