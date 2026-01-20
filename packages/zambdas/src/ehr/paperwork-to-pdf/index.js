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
exports.index = void 0;
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var presigned_file_urls_1 = require("../../shared/presigned-file-urls");
var document_1 = require("./document");
var draw_1 = require("./draw");
var ZAMBDA_NAME = 'paperwork-to-pdf';
var oystehrToken;
// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
var m2mToken;
exports.index = (0, shared_1.wrapHandler)(ZAMBDA_NAME, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, questionnaireResponseId, secrets, oystehr, paperworkResources, questionnaireResponse, listResources, appointment, schedule, location_1, document_2, pdfDocument, timestamp, fileName, baseFileUrl, presignedUrl, _b, error_1, docRefs, error_2, ENVIRONMENT;
    var _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 13, , 14]);
                _a = validateInput(input), questionnaireResponseId = _a.questionnaireResponseId, secrets = _a.secrets;
                return [4 /*yield*/, createOystehr(secrets)];
            case 1:
                oystehr = _e.sent();
                return [4 /*yield*/, (0, shared_1.checkOrCreateM2MClientToken)(m2mToken, secrets)];
            case 2:
                m2mToken = _e.sent();
                return [4 /*yield*/, (0, utils_1.getPaperworkResources)(oystehr, questionnaireResponseId)];
            case 3:
                paperworkResources = _e.sent();
                if (!paperworkResources)
                    throw new Error('Paperwork not submitted');
                questionnaireResponse = paperworkResources.questionnaireResponse, listResources = paperworkResources.listResources, appointment = paperworkResources.appointment, schedule = paperworkResources.schedule, location_1 = paperworkResources.location;
                if (!questionnaireResponse)
                    throw new Error('QuestionnaireResponse not found');
                return [4 /*yield*/, (0, document_1.createDocument)(questionnaireResponse, appointment, oystehr, schedule, location_1)];
            case 4:
                document_2 = _e.sent();
                return [4 /*yield*/, (0, draw_1.generatePdf)(document_2)];
            case 5:
                pdfDocument = _e.sent();
                timestamp = luxon_1.DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
                fileName = "".concat(utils_1.PAPERWORK_PDF_BASE_NAME, "-").concat(questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.id, "-").concat((_c = questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.meta) === null || _c === void 0 ? void 0 : _c.versionId, "-").concat(timestamp, ".pdf");
                baseFileUrl = (0, presigned_file_urls_1.makeZ3Url)({
                    secrets: secrets,
                    fileName: fileName,
                    bucketName: utils_1.BUCKET_NAMES.PAPERWORK,
                    patientID: document_2.patientInfo.id,
                });
                console.log('Uploading file to bucket, ', utils_1.BUCKET_NAMES.PAPERWORK);
                presignedUrl = void 0;
                _e.label = 6;
            case 6:
                _e.trys.push([6, 10, , 11]);
                return [4 /*yield*/, (0, shared_1.createPresignedUrl)(m2mToken, baseFileUrl, 'upload')];
            case 7:
                presignedUrl = _e.sent();
                _b = shared_1.uploadObjectToZ3;
                return [4 /*yield*/, pdfDocument.save()];
            case 8: return [4 /*yield*/, _b.apply(void 0, [_e.sent(), presignedUrl])];
            case 9:
                _e.sent();
                return [3 /*break*/, 11];
            case 10:
                error_1 = _e.sent();
                throw new Error('failed uploading pdf to z3', { cause: error_1 });
            case 11: return [4 /*yield*/, (0, utils_1.createFilesDocumentReferences)({
                    files: [
                        {
                            url: baseFileUrl,
                            title: utils_1.PAPERWORK_PDF_ATTACHMENT_TITLE,
                        },
                    ],
                    type: {
                        coding: [
                            {
                                system: 'http://loinc.org',
                                code: utils_1.EXPORTED_QUESTIONNAIRE_CODE,
                                display: utils_1.PAPERWORK_PDF_ATTACHMENT_TITLE,
                            },
                        ],
                        text: utils_1.PAPERWORK_PDF_ATTACHMENT_TITLE,
                    },
                    dateCreated: luxon_1.DateTime.now().toUTC().toISO(),
                    searchParams: __spreadArray([
                        {
                            name: 'subject',
                            value: "Patient/".concat(document_2.patientInfo.id),
                        },
                        {
                            name: 'type',
                            value: utils_1.EXPORTED_QUESTIONNAIRE_CODE,
                        }
                    ], (((_d = questionnaireResponse.encounter) === null || _d === void 0 ? void 0 : _d.reference)
                        ? [{ name: 'encounter', value: questionnaireResponse.encounter.reference }]
                        : []), true),
                    references: __assign({ subject: { reference: "Patient/".concat(document_2.patientInfo.id) } }, (questionnaireResponse.encounter && {
                        context: { encounter: [questionnaireResponse.encounter] },
                    })),
                    oystehr: oystehr,
                    generateUUID: crypto_1.randomUUID,
                    listResources: listResources,
                    meta: {
                        tag: [{ code: utils_1.OTTEHR_MODULE.IP }, { code: utils_1.OTTEHR_MODULE.TM }],
                    },
                })];
            case 12:
                docRefs = (_e.sent()).docRefs;
                return [2 /*return*/, {
                        statusCode: 200,
                        body: JSON.stringify({
                            documentReference: 'DocumentReference/' + docRefs[0].id,
                        }),
                    }];
            case 13:
                error_2 = _e.sent();
                ENVIRONMENT = (0, utils_1.getSecret)(utils_1.SecretsKeys.ENVIRONMENT, input.secrets);
                return [2 /*return*/, (0, shared_1.topLevelCatch)(ZAMBDA_NAME, error_2, ENVIRONMENT)];
            case 14: return [2 /*return*/];
        }
    });
}); });
function validateInput(input) {
    var questionnaireResponseId = (0, shared_1.validateJsonBody)(input).questionnaireResponseId;
    return {
        questionnaireResponseId: (0, shared_1.validateString)(questionnaireResponseId, 'questionnaireResponseId'),
        secrets: input.secrets,
    };
}
function createOystehr(secrets) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(oystehrToken == null)) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, shared_1.getAuth0Token)(secrets)];
                case 1:
                    oystehrToken = _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, (0, shared_1.createOystehrClient)(oystehrToken, secrets)];
            }
        });
    });
}
