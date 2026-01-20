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
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var presigned_file_urls_1 = require("../../shared/presigned-file-urls");
var validateRequestParameters_1 = require("./validateRequestParameters");
var oystehrToken;
var ZAMBDA_NAME = 'get-presigned-file-url';
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var result, error_1, ENVIRONMENT;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                if (!!oystehrToken) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, shared_1.getAuth0Token)(input.secrets)];
            case 1:
                oystehrToken = _a.sent();
                _a.label = 2;
            case 2: return [4 /*yield*/, makePresignedFileURL(input, shared_1.createOystehrClient, utils_1.getAppointmentResourceById, oystehrToken)];
            case 3:
                result = _a.sent();
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify(result),
                    }];
            case 4:
                error_1 = _a.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)('get-presigned-file-url', error_1, ENVIRONMENT)];
            case 5: return [2 /*return*/];
        }
    });
}); });
var makePresignedFileURL = function (input, createOystehrClient, getAppointmentResource, oystehrToken) { return __awaiter(void 0, void 0, void 0, function () {
    var validatedParameters, appointmentID, fileType, fileFormat, secrets, oystehr, appointment, patient, patientID, bucketName, fileURL, presignedURLRequest, presignedURLResponse;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                console.group('validateRequestParameters');
                validatedParameters = (0, validateRequestParameters_1.validateRequestParameters)(input);
                appointmentID = validatedParameters.appointmentID, fileType = validatedParameters.fileType, fileFormat = validatedParameters.fileFormat, secrets = validatedParameters.secrets;
                console.groupEnd();
                console.debug('validateRequestParameters success');
                oystehr = createOystehrClient(oystehrToken, secrets);
                console.log("getting appointment with id ".concat(appointmentID));
                return [4 /*yield*/, getAppointmentResource(appointmentID, oystehr)];
            case 1:
                appointment = _c.sent();
                if (!appointment) {
                    throw utils_1.APPOINTMENT_NOT_FOUND_ERROR;
                }
                patient = (_b = (_a = appointment === null || appointment === void 0 ? void 0 : appointment.participant.find(function (participantTemp) { var _a, _b; return (_b = (_a = participantTemp.actor) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.startsWith('Patient/'); })) === null || _a === void 0 ? void 0 : _a.actor) === null || _b === void 0 ? void 0 : _b.reference;
                if (!patient) {
                    throw new Error('Patient is not found');
                }
                patientID = patient.replace('Patient/', '');
                bucketName = '';
                if (fileType === utils_1.PHOTO_ID_FRONT_ID) {
                    bucketName = utils_1.BUCKET_NAMES.PHOTO_ID_CARDS;
                }
                else if (fileType === utils_1.PHOTO_ID_BACK_ID) {
                    bucketName = utils_1.BUCKET_NAMES.PHOTO_ID_CARDS;
                }
                else if (fileType === utils_1.INSURANCE_CARD_FRONT_ID) {
                    bucketName = utils_1.BUCKET_NAMES.INSURANCE_CARDS;
                }
                else if (fileType === utils_1.INSURANCE_CARD_BACK_ID) {
                    bucketName = utils_1.BUCKET_NAMES.INSURANCE_CARDS;
                }
                else if (fileType === utils_1.INSURANCE_CARD_FRONT_2_ID) {
                    bucketName = utils_1.BUCKET_NAMES.INSURANCE_CARDS;
                }
                else if (fileType === utils_1.INSURANCE_CARD_BACK_2_ID) {
                    bucketName = utils_1.BUCKET_NAMES.INSURANCE_CARDS;
                }
                else if (fileType === utils_1.SCHOOL_WORK_NOTE_SCHOOL_ID) {
                    bucketName = utils_1.BUCKET_NAMES.SCHOOL_WORK_NOTE_TEMPLATES;
                }
                else if (fileType === utils_1.SCHOOL_WORK_NOTE_WORK_ID) {
                    bucketName = utils_1.BUCKET_NAMES.SCHOOL_WORK_NOTE_TEMPLATES;
                }
                else if (fileType.startsWith(utils_1.PATIENT_PHOTO_ID_PREFIX)) {
                    bucketName = utils_1.BUCKET_NAMES.PATIENT_PHOTOS;
                }
                else {
                    throw Error('Unknown bucket');
                }
                fileURL = (0, presigned_file_urls_1.makeZ3Url)({
                    secrets: secrets,
                    bucketName: bucketName,
                    patientID: patientID,
                    fileType: fileType,
                    fileFormat: fileFormat,
                });
                return [4 /*yield*/, fetch(fileURL, {
                        method: 'POST',
                        headers: {
                            authorization: "Bearer ".concat(oystehrToken),
                        },
                        body: JSON.stringify({ action: 'upload' }),
                    })];
            case 2:
                presignedURLRequest = _c.sent();
                console.log('presigned URL request successfully made');
                return [4 /*yield*/, presignedURLRequest.json()];
            case 3:
                presignedURLResponse = _c.sent();
                console.log('presignedURLResponse', JSON.stringify(presignedURLResponse));
                return [2 /*return*/, { presignedURL: presignedURLResponse.signedUrl, z3URL: fileURL }];
        }
    });
}); };
