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
exports.createSchoolWorkNotePDF = createSchoolWorkNotePDF;
var fontkit_1 = require("@pdf-lib/fontkit");
var fs_1 = require("fs");
var pdf_lib_1 = require("pdf-lib");
var utils_1 = require("utils");
var presigned_file_urls_1 = require("../presigned-file-urls");
var z3Utils_1 = require("../z3Utils");
var pdf_utils_1 = require("./pdf-utils");
function createSchoolWorkNotePdfBytes(data) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfDoc, page, _a, height, width, dancingSignatureFont, RubikFont, RubikFontBold, styles, currYPos, currXPos, pageTextWidth, drawText, drawHeader, drawRegularText, drawDigitalSign, drawBullets, logoBuffer, img;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, pdf_lib_1.PDFDocument.create()];
                case 1:
                    pdfDoc = _b.sent();
                    pdfDoc.registerFontkit(fontkit_1.default);
                    page = pdfDoc.addPage();
                    page.setSize(pdf_lib_1.PageSizes.A4[0], pdf_lib_1.PageSizes.A4[1]);
                    _a = page.getSize(), height = _a.height, width = _a.width;
                    return [4 /*yield*/, pdfDoc.embedFont(new Uint8Array(fs_1.default.readFileSync('./assets/DancingScript-Regular.otf')))];
                case 2:
                    dancingSignatureFont = _b.sent();
                    return [4 /*yield*/, pdfDoc.embedFont(new Uint8Array(fs_1.default.readFileSync('./assets/Rubik-Regular.otf')))];
                case 3:
                    RubikFont = _b.sent();
                    return [4 /*yield*/, pdfDoc.embedFont(new Uint8Array(fs_1.default.readFileSync('./assets/Rubik-Bold.otf')))];
                case 4:
                    RubikFontBold = _b.sent();
                    styles = {
                        image: {
                            width: 110,
                            height: 28,
                        },
                        header: {
                            font: RubikFontBold,
                            fontSize: 20,
                        },
                        regularText: {
                            font: RubikFont,
                            fontSize: 16,
                        },
                        digitalSign: {
                            font: dancingSignatureFont,
                            fontSize: 22,
                        },
                        spacing: {
                            image: 65,
                            regularText: 2,
                            header: 25,
                            paragraph: 3,
                            block: 60,
                        },
                        margin: {
                            x: 40,
                            y: 40,
                            bulletList: 9,
                            bulletItem: 45,
                        },
                        color: {
                            grey: (0, pdf_utils_1.rgbNormalized)(143, 154, 167),
                        },
                    };
                    currYPos = height - styles.margin.y;
                    currXPos = styles.margin.x;
                    pageTextWidth = width - styles.margin.x * 2;
                    drawText = function (text, font, fontSize, color) {
                        var currentTextSize = font.heightAtSize(fontSize);
                        (0, pdf_utils_1.splitLongStringToPageSize)(text, font, fontSize, pageTextWidth).forEach(function (line) {
                            page.drawText(line, {
                                font: font,
                                size: fontSize,
                                x: currXPos,
                                y: currYPos,
                                color: color,
                            });
                            currYPos -= currentTextSize + styles.spacing.regularText;
                        });
                    };
                    drawHeader = function (text) {
                        drawText(text, styles.header.font, styles.header.fontSize);
                        currYPos -= styles.spacing.header; // space between header and first detail
                    };
                    drawRegularText = function (text, color) {
                        drawText(text, styles.regularText.font, styles.regularText.fontSize, color);
                        currYPos -= styles.spacing.regularText;
                    };
                    drawDigitalSign = function (text) {
                        drawText(text, styles.digitalSign.font, styles.digitalSign.fontSize);
                        currYPos -= styles.spacing.regularText;
                    };
                    drawBullets = function (bullets, nestedPosition) {
                        bullets.forEach(function (bullet) {
                            var bulletText = '\u2022  ' + (0, pdf_utils_1.handleBadSpaces)(bullet.text);
                            currXPos += nestedPosition * styles.margin.bulletItem;
                            drawText(bulletText, styles.regularText.font, styles.regularText.fontSize);
                            currXPos -= nestedPosition * styles.margin.bulletItem;
                            currYPos -= styles.spacing.regularText;
                            if (bullet.subItems)
                                drawBullets(bullet.subItems, nestedPosition + 1);
                        });
                    };
                    return [4 /*yield*/, (0, pdf_utils_1.getPdfLogo)()];
                case 5:
                    logoBuffer = _b.sent();
                    if (!logoBuffer) return [3 /*break*/, 7];
                    return [4 /*yield*/, pdfDoc.embedPng(new Uint8Array(logoBuffer))];
                case 6:
                    img = _b.sent();
                    currYPos -= styles.margin.y;
                    page.drawImage(img, {
                        x: styles.margin.x,
                        y: currYPos,
                        width: styles.image.width,
                        height: styles.image.height,
                    });
                    currYPos -= styles.image.height + styles.spacing.image; // space after image
                    _b.label = 7;
                case 7:
                    // add all sections to PDF
                    if (data.documentHeader)
                        drawHeader(data.documentHeader);
                    if (data.headerNote)
                        drawRegularText(data.headerNote);
                    currYPos -= styles.spacing.paragraph;
                    currXPos += styles.margin.bulletList;
                    if (data.bulletItems)
                        drawBullets(data.bulletItems, 0);
                    currXPos -= styles.margin.bulletList;
                    currYPos -= styles.spacing.paragraph;
                    if (data.footerNote)
                        drawRegularText(data.footerNote);
                    currYPos -= styles.spacing.block;
                    if (data.providerDetails) {
                        drawRegularText('Electronically signed by: ', styles.color.grey);
                        drawDigitalSign(data.providerDetails.name); // credentials are included in the name
                    }
                    return [4 /*yield*/, pdfDoc.save()];
                case 8: return [2 /*return*/, _b.sent()];
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
function createSchoolWorkNotePDF(input, patient, secrets, token) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfBytes, bucketName, fileName, baseFileUrl;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Creating consent PDFs');
                    if (!patient.id) {
                        throw new Error('No patient id found for consent items');
                    }
                    return [4 /*yield*/, createSchoolWorkNotePdfBytes(input).catch(function (error) {
                            throw new Error('failed creating pdfBytes: ' + error.message);
                        })];
                case 1:
                    pdfBytes = _a.sent();
                    bucketName = "".concat(utils_1.SCHOOL_WORK_NOTE, "s");
                    fileName = 'SchoolWorkNote.pdf';
                    baseFileUrl = (0, presigned_file_urls_1.makeZ3Url)({ secrets: secrets, fileName: fileName, patientID: patient.id, bucketName: bucketName });
                    return [4 /*yield*/, uploadPDF(pdfBytes, token, baseFileUrl).catch(function (error) {
                            throw new Error('failed uploading pdf to z3: ' + error.message);
                        })];
                case 2:
                    _a.sent();
                    // for testing
                    // savePdfLocally(pdfBytes);
                    return [2 /*return*/, { title: fileName, uploadURL: baseFileUrl }];
            }
        });
    });
}
