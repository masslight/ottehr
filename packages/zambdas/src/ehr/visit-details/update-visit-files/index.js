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
var ZAMBDA_NAME = 'update-visit-files';
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, secrets, oystehr, effectInput, files, error_1, ENVIRONMENT;
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
                return [4 /*yield*/, performEffect(effectInput, oystehr)];
            case 3:
                files = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(files),
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
var INSURANCE_CARD_TYPE_CODING = {
    coding: [
        {
            system: 'http://loinc.org',
            code: utils_1.INSURANCE_CARD_CODE,
            display: 'Insurance card front',
        },
    ],
    text: 'Insurance card front',
};
var PHOTO_ID_CARD_TYPE_CODING = {
    coding: [
        {
            system: 'http://loinc.org',
            code: utils_1.PHOTO_ID_CARD_CODE,
            display: 'Patient data Document',
        },
    ],
    text: 'Photo ID cards',
};
var performEffect = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var fileType, attachment, patientId, listResources, drType, createDRInput, docRefs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                fileType = input.fileType, attachment = input.attachment, patientId = input.patientId, listResources = input.listResources;
                console.log('performEffect called with:', { fileType: fileType, attachment: attachment, patientId: patientId });
                if (['insurance-card-front', 'insurance-card-back', 'insurance-card-front-2', 'insurance-card-back-2'].includes(fileType)) {
                    drType = INSURANCE_CARD_TYPE_CODING;
                }
                else {
                    drType = PHOTO_ID_CARD_TYPE_CODING;
                }
                createDRInput = {
                    oystehr: oystehr,
                    files: [{ url: attachment.url || '', title: attachment.title || '' }],
                    type: drType,
                    dateCreated: attachment.creation,
                    searchParams: [{ name: 'patient', value: "Patient/".concat(patientId) }],
                    references: {
                        subject: { reference: "Patient/".concat(patientId) },
                        context: { related: [{ reference: "Patient/".concat(patientId) }] },
                    },
                    listResources: listResources,
                };
                return [4 /*yield*/, (0, utils_1.createFilesDocumentReferences)(createDRInput)];
            case 1:
                docRefs = (_a.sent()).docRefs;
                console.log('Created DocumentReferences:', JSON.stringify(docRefs, null, 2));
                return [2 /*return*/];
        }
    });
}); };
var complexValidation = function (input, oystehr) { return __awaiter(void 0, void 0, void 0, function () {
    var appointmentId, patientId, resourceType, params, patient, appointment, patientResource, confirmedPatientId, listResources;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                appointmentId = input.appointmentId, patientId = input.patientId;
                params = [];
                if (appointmentId) {
                    resourceType = 'Appointment';
                    params.push({ name: '_id', value: appointmentId });
                    params.push({ name: '_include', value: 'Appointment:patient' });
                }
                else if (patientId) {
                    resourceType = 'Patient';
                    params.push({ name: '_id', value: patientId });
                }
                else {
                    throw new Error('Either appointmentId or patientId must be provided');
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: resourceType,
                        params: params,
                    })];
            case 1:
                patient = _e.sent();
                appointment = (_b = (_a = patient.entry) === null || _a === void 0 ? void 0 : _a.find(function (entry) { var _a; return ((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Appointment'; })) === null || _b === void 0 ? void 0 : _b.resource;
                patientResource = (_d = (_c = patient.entry) === null || _c === void 0 ? void 0 : _c.find(function (entry) { var _a; return ((_a = entry.resource) === null || _a === void 0 ? void 0 : _a.resourceType) === 'Patient'; })) === null || _d === void 0 ? void 0 : _d.resource;
                if (appointmentId && !appointment) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Appointment');
                }
                confirmedPatientId = patientResource === null || patientResource === void 0 ? void 0 : patientResource.id;
                if (!confirmedPatientId && !appointmentId) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND)('Patient');
                }
                else if (!confirmedPatientId) {
                    throw (0, utils_1.FHIR_RESOURCE_NOT_FOUND_CUSTOM)('Could not find Patient associated with provided Appointment id');
                }
                return [4 /*yield*/, oystehr.fhir.search({
                        resourceType: 'List',
                        params: [{ name: 'patient', value: "Patient/".concat(confirmedPatientId) }],
                    })];
            case 2:
                listResources = (_e.sent()).unbundle();
                return [2 /*return*/, __assign(__assign({}, input), { patientId: confirmedPatientId, listResources: listResources })];
        }
    });
}); };
var validateRequestParameters = function (input) {
    if (!input.body) {
        throw utils_1.MISSING_REQUEST_BODY;
    }
    console.log('input', JSON.stringify(input, null, 2));
    var secrets = input.secrets;
    var _a = JSON.parse(input.body), maybeFileType = _a.fileType, maybeAttachment = _a.attachment, maybePatientId = _a.patientId, maybeAppointmentId = _a.appointmentId;
    var missingParams = [];
    if (!maybeFileType) {
        missingParams.push('fileType');
    }
    if (!maybeAttachment) {
        missingParams.push('attachment');
    }
    if (missingParams.length > 0) {
        throw (0, utils_1.MISSING_REQUIRED_PARAMETERS)(missingParams);
    }
    console.log('checking fileType validity', maybeFileType, utils_1.ValidEHRUploadTypes);
    if (typeof maybeFileType !== 'string' || !utils_1.ValidEHRUploadTypes.includes(maybeFileType)) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("\"fileType\" is invalid. must be one of ".concat(utils_1.ValidEHRUploadTypes.join(', ')));
    }
    // todo: avoid "as"
    var fileType = maybeFileType;
    var invalidAttachmentShapeMessage = "\"attachment\" must be an object with \"url\", \"title\", and \"creation\" fields";
    if (typeof maybeAttachment !== 'object') {
        throw (0, utils_1.INVALID_INPUT_ERROR)(invalidAttachmentShapeMessage);
    }
    var attachmentKeys = new Set(Object.keys(maybeAttachment));
    if (!attachmentKeys.has('url') || !attachmentKeys.has('title') || !attachmentKeys.has('creation')) {
        throw (0, utils_1.INVALID_INPUT_ERROR)(invalidAttachmentShapeMessage);
    }
    if (!maybeAttachment.url || typeof maybeAttachment.url !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)("\"attachment.url\" must be a non-empty string.");
    }
    if (!maybeAttachment.title || typeof maybeAttachment.title !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)("\"attachment.title\" must be a non-empty string.");
    }
    if (!maybeAttachment.creation ||
        typeof maybeAttachment.creation !== 'string' ||
        !luxon_1.DateTime.fromISO(maybeAttachment.creation).isValid) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("\"attachment.creation\" must be a valid ISO date string.");
    }
    if (!maybePatientId && !maybeAppointmentId) {
        throw (0, utils_1.INVALID_INPUT_ERROR)("Either \"patientId\" or \"appointmentId\" must be provided.");
    }
    if (maybePatientId && typeof maybePatientId !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)("\"patientId\" must be a string.");
    }
    if (maybeAppointmentId && typeof maybeAppointmentId !== 'string') {
        throw (0, utils_1.INVALID_INPUT_ERROR)("\"appointmentId\" must be a string.");
    }
    if (maybePatientId && (0, utils_1.isValidUUID)(maybePatientId) === false) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"patientId" must be a valid UUID.');
    }
    if (maybeAppointmentId && (0, utils_1.isValidUUID)(maybeAppointmentId) === false) {
        throw (0, utils_1.INVALID_INPUT_ERROR)('"appointmentId" must be a valid UUID.');
    }
    var patientId = maybePatientId;
    var appointmentId = maybeAppointmentId;
    // todo: avoid "as"
    var attachment = maybeAttachment;
    return {
        secrets: secrets,
        fileType: fileType,
        attachment: attachment,
        patientId: patientId,
        appointmentId: patientId ? undefined : appointmentId,
    };
};
