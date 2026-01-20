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
exports.createReceiptPdf = createReceiptPdf;
var fs_1 = require("fs");
var pdf_lib_1 = require("pdf-lib");
var utils_1 = require("utils");
var presigned_file_urls_1 = require("../presigned-file-urls");
var z3Utils_1 = require("../z3Utils");
var pdf_utils_1 = require("./pdf-utils");
function createReceiptPdfBytes(data) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfClientStyles, pdfClient, RubikFont, RubikFontBold, logoBuffer, logo, textStyles, imgStyles, drawBlockHeader, drawFieldLine;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pdfClientStyles = {
                        initialPage: {
                            width: pdf_lib_1.PageSizes.A4[0],
                            height: pdf_lib_1.PageSizes.A4[1],
                            pageMargins: {
                                left: 40,
                                top: 40,
                                right: 40,
                                bottom: 40,
                            },
                        },
                    };
                    return [4 /*yield*/, (0, pdf_utils_1.createPdfClient)(pdfClientStyles)];
                case 1:
                    pdfClient = _a.sent();
                    return [4 /*yield*/, pdfClient.embedFont(fs_1.default.readFileSync('./assets/Rubik-Regular.otf'))];
                case 2:
                    RubikFont = _a.sent();
                    return [4 /*yield*/, pdfClient.embedFont(fs_1.default.readFileSync('./assetsRubik-Bold.otf'))];
                case 3:
                    RubikFontBold = _a.sent();
                    return [4 /*yield*/, (0, pdf_utils_1.getPdfLogo)()];
                case 4:
                    logoBuffer = _a.sent();
                    if (!logoBuffer) return [3 /*break*/, 6];
                    return [4 /*yield*/, pdfClient.embedImage(logoBuffer)];
                case 5:
                    logo = _a.sent();
                    _a.label = 6;
                case 6:
                    textStyles = {
                        blockHeader: {
                            fontSize: 12,
                            spacing: 12,
                            font: RubikFontBold,
                            newLineAfter: true,
                        },
                        fieldHeader: {
                            fontSize: 12,
                            font: RubikFont,
                            spacing: 1,
                        },
                        fieldText: {
                            fontSize: 12,
                            spacing: 6,
                            font: RubikFont,
                            side: 'right',
                            newLineAfter: true,
                        },
                    };
                    imgStyles = {
                        width: 190,
                        height: 47,
                        center: true,
                    };
                    drawBlockHeader = function (text) {
                        pdfClient.drawText(text, textStyles.blockHeader);
                    };
                    drawFieldLine = function (fieldName, fieldValue) {
                        pdfClient.drawText(fieldName, textStyles.fieldHeader);
                        pdfClient.drawText(fieldValue, textStyles.fieldText);
                    };
                    if (logo)
                        pdfClient.drawImage(logo, imgStyles);
                    if (data.facility) {
                        drawFieldLine('Facility:', data.facility.name);
                        drawFieldLine('Facility Address:', data.facility.address);
                        drawFieldLine('Facility Phone:', data.facility.phone);
                        pdfClient.newLine(12);
                    }
                    drawFieldLine('Patient Name:', data.patient.name);
                    drawFieldLine('Patient DOB:', data.patient.dob);
                    drawFieldLine('Patient Account #:', data.patient.account);
                    pdfClient.newLine(36);
                    drawBlockHeader('Receipt of Payment');
                    pdfClient.newLine(12);
                    pdfClient.drawText('Credit Card Transaction Details(card ending, card type, authorization/transaction number)', textStyles.fieldHeader);
                    pdfClient.newLine(24);
                    drawFieldLine('Amount:', data.amount);
                    drawFieldLine('Date:', data.date);
                    return [4 /*yield*/, pdfClient.save()];
                case 7: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function uploadPDF(pdfBytes, token, baseFileUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var presignedUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, z3Utils_1.createPresignedUrl)(token, baseFileUrl, 'upload')];
                case 1:
                    presignedUrl = _a.sent();
                    return [4 /*yield*/, (0, z3Utils_1.uploadObjectToZ3)(pdfBytes, presignedUrl)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function createReceiptPdf(input, patient, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfBytes, bucketName, fileName, baseFileUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Creating Receipt PDF');
                    if (!patient.id) {
                        throw new Error('No patient id found for consent items');
                    }
                    return [4 /*yield*/, createReceiptPdfBytes(input).catch(function (error) {
                            throw new Error('failed creating pdfBytes: ' + error.message);
                        })];
                case 1:
                    pdfBytes = _a.sent();
                    bucketName = utils_1.BUCKET_NAMES.RECEIPTS;
                    fileName = 'Receipt.pdf';
                    baseFileUrl = (0, presigned_file_urls_1.makeZ3Url)({ secrets: secrets, fileName: fileName, bucketName: bucketName, patientID: patient.id });
                    return [4 /*yield*/, uploadPDF(pdfBytes, token, baseFileUrl).catch(function (error) {
                            throw new Error('failed uploading pdf to z3: ' + error.message);
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, { title: fileName, uploadURL: baseFileUrl }];
            }
        });
    });
}
