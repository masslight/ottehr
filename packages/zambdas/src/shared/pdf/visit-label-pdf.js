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
exports.VISIT_LABEL_DOC_REF_DOCTYPE = void 0;
exports.createVisitLabelPDF = createVisitLabelPDF;
var crypto_1 = require("crypto");
var luxon_1 = require("luxon");
var pdf_lib_1 = require("pdf-lib");
var utils_1 = require("utils");
var presigned_file_urls_1 = require("../presigned-file-urls");
var z3Utils_1 = require("../z3Utils");
var external_labs_label_pdf_1 = require("./external-labs-label-pdf");
var pdf_consts_1 = require("./pdf-consts");
var pdf_utils_1 = require("./pdf-utils");
var VISIT_LABEL_PDF_BASE_NAME = 'VisitLabel';
exports.VISIT_LABEL_DOC_REF_DOCTYPE = {
    system: 'http://ottehr.org/fhir/StructureDefinition/visit-label',
    code: 'visit-label',
    display: 'Visit Label',
};
var DATE_FORMAT = 'MM/dd/yyyy';
var createVisitLabelPdfBytes = function (data) { return __awaiter(void 0, void 0, void 0, function () {
    var labelConfig, content, pdfClientStyles, pdfClient, CourierBold, Courier, baseFontSize, baseSpacing, textStyles, NEWLINE_Y_DROP, drawHeaderAndInlineText, getAgeString, patientId, patientFirstName, patientMiddleName, patientLastName, patientDateOfBirth, patientGender, visitDate, patientDOBString, ageString, renderAgeString;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                labelConfig = data.labelConfig, content = data.content;
                pdfClientStyles = (0, external_labs_label_pdf_1.convertLabeConfigToPdfClientStyles)(labelConfig);
                return [4 /*yield*/, (0, pdf_utils_1.createPdfClient)(pdfClientStyles)];
            case 1:
                pdfClient = _a.sent();
                // the pdf client initializes YPos to some non-zero number and it's causing huge gaps
                pdfClient.setY(pdfClient.getY() + pdf_consts_1.Y_POS_GAP - 15);
                return [4 /*yield*/, pdfClient.embedStandardFont(pdf_lib_1.StandardFonts.CourierBold)];
            case 2:
                CourierBold = _a.sent();
                return [4 /*yield*/, pdfClient.embedStandardFont(pdf_lib_1.StandardFonts.Courier)];
            case 3:
                Courier = _a.sent();
                baseFontSize = 7;
                baseSpacing = 2;
                textStyles = {
                    fieldText: {
                        fontSize: baseFontSize,
                        spacing: baseSpacing,
                        font: Courier,
                        newLineAfter: false,
                    },
                    fieldTextBold: {
                        fontSize: baseFontSize,
                        spacing: baseSpacing,
                        font: CourierBold,
                        newLineAfter: false,
                    },
                    fieldHeader: {
                        fontSize: baseFontSize,
                        font: CourierBold,
                        spacing: baseSpacing,
                    },
                };
                NEWLINE_Y_DROP = pdfClient.getTextDimensions('Any text used to get height', textStyles.fieldHeader).height + baseSpacing;
                drawHeaderAndInlineText = function (header, text) {
                    pdfClient.drawTextSequential("".concat(header, ": "), textStyles.fieldHeader);
                    pdfClient.drawTextSequential(text, textStyles.fieldTextBold);
                };
                getAgeString = function (dob) {
                    if (!dob || dob.toUTC() > luxon_1.DateTime.utc())
                        return '';
                    // get the date diff between now and the dob
                    // const ageInMonths = Math.round(DateTime.utc().diff(dob.toUTC(), ['months', 'weeks', 'days']).as('months'));
                    var _a = luxon_1.DateTime.utc().diff(dob.toUTC(), ['months', 'weeks', 'days']).toObject(), months = _a.months, weeks = _a.weeks, days = _a.days;
                    if (!months && !weeks && days !== undefined) {
                        return "".concat(days, " d");
                    }
                    if (!months && weeks !== undefined)
                        return "".concat(weeks, " wk");
                    if (months !== undefined) {
                        if (months <= 24)
                            return "".concat(months, " mo");
                        else {
                            return "".concat(Math.floor(months / 12), " yr");
                        }
                    }
                    throw new Error("Error processing age string for dob ".concat(dob));
                };
                patientId = content.patientId, patientFirstName = content.patientFirstName, patientMiddleName = content.patientMiddleName, patientLastName = content.patientLastName, patientDateOfBirth = content.patientDateOfBirth, patientGender = content.patientGender, visitDate = content.visitDate;
                drawHeaderAndInlineText('PID', patientId);
                pdfClient.newLine(NEWLINE_Y_DROP);
                pdfClient.drawTextSequential("".concat(patientLastName, ", ").concat(patientFirstName).concat(patientMiddleName ? ", ".concat(patientMiddleName) : ''), __assign(__assign({}, textStyles.fieldHeader), { fontSize: textStyles.fieldHeader.fontSize + 2 }));
                pdfClient.newLine(NEWLINE_Y_DROP);
                patientDOBString = patientDateOfBirth ? patientDateOfBirth.toFormat(DATE_FORMAT) : '';
                ageString = getAgeString(patientDateOfBirth);
                renderAgeString = ageString ? "(".concat(ageString, ")") : '';
                drawHeaderAndInlineText('DOB', "".concat(patientDOBString, " ").concat(renderAgeString, ", ").concat(patientGender));
                pdfClient.newLine(NEWLINE_Y_DROP);
                drawHeaderAndInlineText('Visit date', visitDate ? visitDate.toFormat(DATE_FORMAT) : '');
                return [4 /*yield*/, pdfClient.save()];
            case 4: return [2 /*return*/, _a.sent()];
        }
    });
}); };
function createVisitLabelPDFHelper(input, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfBytes, fileName, baseFileUrl, presignedUrl, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Creating external labs label pdf bytes');
                    return [4 /*yield*/, createVisitLabelPdfBytes(input).catch(function (error) {
                            throw new Error('failed creating visit label pdfBytes: ' + error.message);
                        })];
                case 1:
                    pdfBytes = _a.sent();
                    console.log("Created visit label pdf bytes");
                    fileName = "".concat(VISIT_LABEL_PDF_BASE_NAME, "-").concat(input.content.visitDate ? input.content.visitDate.toFormat(DATE_FORMAT) : '', ".pdf");
                    console.log("Creating base file url for file ".concat(fileName));
                    baseFileUrl = (0, presigned_file_urls_1.makeZ3Url)({
                        secrets: secrets,
                        fileName: fileName,
                        bucketName: utils_1.BUCKET_NAMES.VISIT_NOTES,
                        patientID: input.content.patientId,
                    });
                    console.log('Uploading file to bucket, ', utils_1.BUCKET_NAMES.VISIT_NOTES);
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, (0, z3Utils_1.createPresignedUrl)(token, baseFileUrl, 'upload')];
                case 3:
                    presignedUrl = _a.sent();
                    return [4 /*yield*/, (0, z3Utils_1.uploadObjectToZ3)(pdfBytes, presignedUrl)];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    throw new Error("failed uploading pdf ".concat(fileName, " to z3:  ").concat(JSON.stringify(error_1.message)));
                case 6: 
                // for testing
                // savePdfLocally(pdfBytes);
                return [2 /*return*/, { title: fileName, uploadURL: baseFileUrl }];
            }
        });
    });
}
function createVisitLabelPDF(labelConfig, encounterId, secrets, token, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfInfo, docRefs, presignedURL;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, createVisitLabelPDFHelper(labelConfig, secrets, token)];
                case 1:
                    pdfInfo = _b.sent();
                    console.log("This is the made pdfInfo", JSON.stringify(pdfInfo));
                    return [4 /*yield*/, (0, utils_1.createFilesDocumentReferences)({
                            files: [{ url: pdfInfo.uploadURL, title: pdfInfo.title }],
                            type: { coding: [exports.VISIT_LABEL_DOC_REF_DOCTYPE], text: 'Visit label' },
                            references: {
                                subject: {
                                    reference: "Patient/".concat(labelConfig.content.patientId),
                                },
                                context: {
                                    encounter: [{ reference: "Encounter/".concat(encounterId) }],
                                },
                            },
                            docStatus: 'final',
                            dateCreated: (_a = luxon_1.DateTime.now().setZone('UTC').toISO()) !== null && _a !== void 0 ? _a : '',
                            oystehr: oystehr,
                            searchParams: [{ name: 'encounter', value: "Encounter/".concat(encounterId) }],
                            generateUUID: crypto_1.randomUUID,
                            listResources: [], // this for whatever reason needs to get added otherwise the function never adds the new docRef to the returned array
                        })];
                case 2:
                    docRefs = (_b.sent()).docRefs;
                    console.log("These are the docRefs returned for the label: ", JSON.stringify(docRefs));
                    if (!docRefs.length) {
                        throw new Error('Unable to make docRefs for label');
                    }
                    return [4 /*yield*/, (0, utils_1.getPresignedURL)(pdfInfo.uploadURL, token)];
                case 3:
                    presignedURL = _b.sent();
                    if (!presignedURL) {
                        throw new Error('Failed to get presigned URL for visit label PDF');
                    }
                    return [2 /*return*/, { docRef: docRefs[0], presignedURL: presignedURL }];
            }
        });
    });
}
