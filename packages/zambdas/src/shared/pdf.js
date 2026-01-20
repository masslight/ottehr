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
exports.createPatientPaymentReceiptPdf = void 0;
exports.createPdfBytes = createPdfBytes;
var fontkit_1 = require("@pdf-lib/fontkit");
var diacritics_1 = require("diacritics");
var fs_1 = require("fs");
var pdf_lib_1 = require("pdf-lib");
var utils_1 = require("utils");
var lambda_1 = require("./lambda");
var pdf_utils_1 = require("./pdf/pdf-utils");
var ConsentDetailLabel;
(function (ConsentDetailLabel) {
    ConsentDetailLabel["lastName"] = "Patient last name";
    ConsentDetailLabel["firstName"] = "Patient first name";
    ConsentDetailLabel["dob"] = "Date of birth";
    ConsentDetailLabel["signedBy"] = "Signed by";
    ConsentDetailLabel["signature"] = "Signature";
    ConsentDetailLabel["dateSigned"] = "Date signed";
    ConsentDetailLabel["relationship"] = "Signer's relationship to patient";
})(ConsentDetailLabel || (ConsentDetailLabel = {}));
// https://www.fileformat.info/info/unicode/category/Zs/list.htm
var UNICODE_SPACE_SEPARATORS = [
    '\u0020',
    '\u00A0',
    '\u1680',
    '\u2000',
    '\u2001',
    '\u2002',
    '\u2003',
    '\u2004',
    '\u2005',
    '\u2006',
    '\u2007',
    '\u2008',
    '\u2009',
    '\u200A',
    '\u202F',
    '\u205F',
    '\u3000',
];
function drawFirstPage(_a) {
    return __awaiter(this, arguments, void 0, function (_b) {
        var page, _c, width, height, timesRomanFont, helveticaFont, dancingSignatureFont, helveticaSupportedChars, scriptSupportedChars, rbgNormalized, styles, drawHeader, drawDetail, patientDetails, additionalDetails, sections, headerTextHeight, detailTextHeight, currYPos, logoBuffer, img, imgDimensions, sIndex, dIndex, _i, sections_1, section, _d, _e, detail;
        var _this = this;
        var _f, _g, _h, _j;
        var patient = _b.patient, consentSigner = _b.consentSigner, dateTime = _b.dateTime, ipAddress = _b.ipAddress, pdfDoc = _b.pdfDoc, pdfInfo = _b.pdfInfo, numPages = _b.numPages, secrets = _b.secrets, timezone = _b.timezone, facilityName = _b.facilityName;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    pdfDoc.registerFontkit(fontkit_1.default);
                    page = pdfDoc.addPage();
                    page.setSize(pdf_lib_1.PageSizes.A4[0], pdf_lib_1.PageSizes.A4[1]);
                    _c = page.getSize(), width = _c.width, height = _c.height;
                    return [4 /*yield*/, pdfDoc.embedFont(pdf_lib_1.StandardFonts.TimesRoman)];
                case 1:
                    timesRomanFont = _k.sent();
                    return [4 /*yield*/, pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica)];
                case 2:
                    helveticaFont = _k.sent();
                    return [4 /*yield*/, pdfDoc.embedFont(new Uint8Array(fs_1.default.readFileSync('./assets/DancingScript-Regular.otf')))];
                case 3:
                    dancingSignatureFont = _k.sent();
                    helveticaSupportedChars = helveticaFont.getCharacterSet();
                    scriptSupportedChars = dancingSignatureFont.getCharacterSet();
                    rbgNormalized = function (r, g, b) { return (0, pdf_lib_1.rgb)(r / 255, g / 255, b / 255); };
                    styles = {
                        header: {
                            font: timesRomanFont,
                            fontSize: 16,
                        },
                        detail: {
                            font: helveticaFont,
                            fontSize: 10,
                            horizontalRuleWidth: 470,
                            horizontalRuleThickness: 1,
                        },
                        spacing: {
                            detail: 7,
                            header: 10,
                            section: 28,
                            horizontalRule: 7,
                        },
                        margin: {
                            x: 63,
                            y: 69,
                        },
                    };
                    drawHeader = function (text, yPos) {
                        page.drawText(text, {
                            x: styles.margin.x,
                            y: yPos,
                            size: styles.header.fontSize,
                            font: styles.header.font,
                        });
                    };
                    drawDetail = function (detail, drawHR, yPos) { return __awaiter(_this, void 0, void 0, function () {
                        var alignRight, valueFont, supportedChars, detailValueChars, unknownChar, numOutOfRange, unsupportedCodePoints, i, codePoint, newChar, newCharCodePoint, environment, errMessage;
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    alignRight = function (text, font) {
                                        var textWidth = font.widthOfTextAtSize(text, styles.detail.fontSize);
                                        return styles.margin.x + styles.detail.horizontalRuleWidth - textWidth;
                                    };
                                    page.drawText(detail.label, {
                                        font: styles.detail.font,
                                        size: styles.detail.fontSize,
                                        x: styles.margin.x,
                                        y: yPos,
                                    });
                                    valueFont = (_a = detail.valueFont) !== null && _a !== void 0 ? _a : styles.detail.font;
                                    switch (valueFont) {
                                        case helveticaFont:
                                            supportedChars = helveticaSupportedChars;
                                            break;
                                        case dancingSignatureFont:
                                            supportedChars = scriptSupportedChars;
                                            break;
                                        default:
                                            throw new Error("Failed to get supported character set for ".concat(valueFont.name));
                                    }
                                    if (!Object.values(ConsentDetailLabel).includes(detail.label)) return [3 /*break*/, 2];
                                    detailValueChars = __spreadArray([], detail.value.replace(/\s/g, ' '), true);
                                    unknownChar = '?';
                                    numOutOfRange = 0;
                                    unsupportedCodePoints = [];
                                    // console.log('og: ', detail.value);
                                    for (i = 0; i < detailValueChars.length; i++) {
                                        codePoint = detailValueChars[i].codePointAt(0);
                                        if (codePoint === undefined) {
                                            detailValueChars[i] = unknownChar;
                                            numOutOfRange++;
                                            console.warn('no code point found for character: ', detailValueChars[i]);
                                        }
                                        else if (!supportedChars.includes(codePoint)) {
                                            newChar = (0, diacritics_1.remove)(detailValueChars[i]);
                                            newCharCodePoint = __spreadArray([], newChar, true)[0].codePointAt(0);
                                            if (newCharCodePoint === undefined) {
                                                newChar = unknownChar;
                                                numOutOfRange++;
                                                console.warn('no code point found for character: ', newChar);
                                            }
                                            else if (!supportedChars.includes(newCharCodePoint)) {
                                                // Replace unsupported unicode space separators with single space
                                                // Anything else is a valid unicode character but not supported by pdf-lib so replace with '?'
                                                // e.g. \u0456 should be replaced with '?'
                                                newChar = UNICODE_SPACE_SEPARATORS.includes(newChar) ? ' ' : unknownChar;
                                                // Convert decimal code point to "U+xxxx" format
                                                unsupportedCodePoints.push("U+".concat(newCharCodePoint.toString(16).padStart(4, '0')));
                                            }
                                            detailValueChars[i] = newChar;
                                        }
                                    }
                                    detail.value = detailValueChars.join('');
                                    if (!(numOutOfRange || unsupportedCodePoints.length)) return [3 /*break*/, 2];
                                    environment = (0, utils_1.getSecret)('ENVIRONMENT', secrets);
                                    errMessage = "[".concat(environment, "]").concat(unsupportedCodePoints.length
                                        ? " Found unsupported characters in consent PDF with code points ".concat(unsupportedCodePoints.join(', '), ".")
                                        : '').concat(numOutOfRange ? " Found ".concat(numOutOfRange, " characters outside of unicode code point range.") : '');
                                    console.warn(errMessage);
                                    return [4 /*yield*/, (0, lambda_1.triggerSlackAlarm)(errMessage, secrets)];
                                case 1:
                                    _b.sent();
                                    _b.label = 2;
                                case 2:
                                    // console.log(
                                    //   'about to draw',
                                    //   detail.value,
                                    //   [...detail.value].map((char) => char.codePointAt(0))
                                    // );
                                    page.drawText(detail.value, {
                                        font: valueFont,
                                        size: styles.detail.fontSize,
                                        x: alignRight(detail.value, valueFont),
                                        y: yPos,
                                    });
                                    if (drawHR) {
                                        page.drawLine({
                                            color: rbgNormalized(227, 230, 239),
                                            thickness: styles.detail.horizontalRuleThickness,
                                            start: { x: styles.margin.x, y: yPos - styles.spacing.horizontalRule },
                                            end: { x: styles.margin.x + styles.detail.horizontalRuleWidth, y: yPos - styles.spacing.horizontalRule },
                                        });
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    patientDetails = [
                        { label: ConsentDetailLabel.firstName, value: ((_g = (_f = patient.name) === null || _f === void 0 ? void 0 : _f[0].given) === null || _g === void 0 ? void 0 : _g[0].trim()) || '' },
                        { label: ConsentDetailLabel.lastName, value: ((_j = (_h = patient.name) === null || _h === void 0 ? void 0 : _h[0].family) === null || _j === void 0 ? void 0 : _j.trim()) || '' },
                        { label: ConsentDetailLabel.dob, value: (0, utils_1.formatDateTimeToLocaleString)((patient === null || patient === void 0 ? void 0 : patient.birthDate) || '', 'date') },
                        { label: ConsentDetailLabel.signedBy, value: consentSigner.fullName.trim() },
                        { label: ConsentDetailLabel.signature, value: consentSigner.signature.trim(), valueFont: dancingSignatureFont },
                        { label: ConsentDetailLabel.dateSigned, value: (0, utils_1.formatDateTimeToLocaleString)(dateTime, 'datetime', timezone) },
                        { label: ConsentDetailLabel.relationship, value: consentSigner.relationship },
                    ];
                    additionalDetails = [
                        { label: 'Form title', value: pdfInfo.formTitle },
                        { label: 'Page count', value: numPages.toString() },
                    ];
                    if (facilityName) {
                        additionalDetails.push({ label: 'Facility name', value: facilityName });
                    }
                    additionalDetails.push({ label: 'IP address', value: ipAddress });
                    sections = [
                        { header: 'Patient Details', body: patientDetails },
                        { header: 'Additional Details', body: additionalDetails },
                    ];
                    headerTextHeight = styles.header.font.heightAtSize(styles.header.fontSize);
                    detailTextHeight = styles.detail.font.heightAtSize(styles.detail.fontSize);
                    currYPos = height - styles.margin.y;
                    return [4 /*yield*/, (0, pdf_utils_1.getPdfLogo)()];
                case 4:
                    logoBuffer = _k.sent();
                    if (!logoBuffer) return [3 /*break*/, 6];
                    return [4 /*yield*/, pdfDoc.embedPng(new Uint8Array(logoBuffer))];
                case 5:
                    img = _k.sent();
                    imgDimensions = img.scale(0.3);
                    currYPos -= imgDimensions.height / 2;
                    if (img)
                        page.drawImage(img, {
                            x: (width - imgDimensions.width) / 2, // center image along x-axis
                            y: currYPos,
                            width: imgDimensions.width,
                            height: imgDimensions.height,
                        });
                    currYPos -= imgDimensions.height / 2; // space after image
                    _k.label = 6;
                case 6:
                    sIndex = 0;
                    dIndex = 0;
                    _i = 0, sections_1 = sections;
                    _k.label = 7;
                case 7:
                    if (!(_i < sections_1.length)) return [3 /*break*/, 13];
                    section = sections_1[_i];
                    drawHeader(section.header, currYPos);
                    currYPos -= headerTextHeight + styles.spacing.header; // space between header and first detail
                    _d = 0, _e = section.body;
                    _k.label = 8;
                case 8:
                    if (!(_d < _e.length)) return [3 /*break*/, 11];
                    detail = _e[_d];
                    return [4 /*yield*/, drawDetail(detail, dIndex < section.body.length - 1, currYPos)];
                case 9:
                    _k.sent();
                    currYPos -= detailTextHeight; // space between details
                    if (dIndex < section.body.length - 1) {
                        // additional space between details, except for the last detail in dArr
                        currYPos -= styles.detail.horizontalRuleThickness + styles.spacing.horizontalRule + styles.spacing.detail;
                        dIndex++;
                    }
                    _k.label = 10;
                case 10:
                    _d++;
                    return [3 /*break*/, 8];
                case 11:
                    if (sIndex < sections.length - 1) {
                        currYPos -= styles.spacing.section; // space before next section header
                        sIndex++;
                    }
                    // reset detail index after each section
                    dIndex = 0;
                    _k.label = 12;
                case 12:
                    _i++;
                    return [3 /*break*/, 7];
                case 13:
                    // Oystehr ID
                    if (patient.id) {
                        page.drawText("Oystehr ID: ".concat(patient.id), {
                            font: styles.detail.font,
                            size: styles.detail.fontSize,
                            x: styles.margin.x,
                            y: styles.margin.y - detailTextHeight,
                        });
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function createPdfBytes(patient, consentSigner, dateTime, ipAddress, pdfInfo, secrets, timezone, facilityName) {
    return __awaiter(this, void 0, void 0, function () {
        var newPdf, document, copiedPages, pdfBytes;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('running PDFDocument.create()', JSON.stringify(pdfInfo));
                    return [4 /*yield*/, pdf_lib_1.PDFDocument.create()];
                case 1:
                    newPdf = _a.sent();
                    console.log('running PDFDocument.load');
                    return [4 /*yield*/, pdf_lib_1.PDFDocument.load(new Uint8Array(fs_1.default.readFileSync(pdfInfo.copyFromPath)))];
                case 2:
                    document = _a.sent();
                    console.log('drawing pdf page', JSON.stringify(newPdf));
                    console.log('drawing pdf page', JSON.stringify(newPdf), patient.id, JSON.stringify(consentSigner), dateTime, ipAddress, facilityName);
                    return [4 /*yield*/, drawFirstPage({
                            patient: patient,
                            consentSigner: consentSigner,
                            dateTime: dateTime,
                            ipAddress: ipAddress,
                            pdfDoc: newPdf,
                            pdfInfo: pdfInfo,
                            numPages: document.getPageCount(),
                            secrets: secrets,
                            timezone: timezone,
                            facilityName: facilityName,
                        })];
                case 3:
                    _a.sent();
                    console.log('copying pages');
                    return [4 /*yield*/, newPdf.copyPages(document, document.getPageIndices())];
                case 4:
                    copiedPages = _a.sent();
                    copiedPages.forEach(function (page) { return newPdf.addPage(page); });
                    console.log('running newPdf.save()');
                    return [4 /*yield*/, newPdf.save()];
                case 5:
                    pdfBytes = _a.sent();
                    return [2 /*return*/, pdfBytes];
            }
        });
    });
}
var patient_payment_receipt_pdf_1 = require("./pdf/patient-payment-receipt-pdf");
Object.defineProperty(exports, "createPatientPaymentReceiptPdf", { enumerable: true, get: function () { return patient_payment_receipt_pdf_1.createPatientPaymentReceiptPdf; } });
