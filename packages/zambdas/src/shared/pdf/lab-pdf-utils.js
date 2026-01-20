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
exports.LABS_PDF_LEFT_INDENTATION_XPOS = exports.drawFourColumnText = exports.drawFieldLineRight = exports.drawFieldLineBoldHeader = exports.drawFieldLine = exports.LAB_PDF_STYLES = void 0;
exports.getPdfClientForLabsPDFs = getPdfClientForLabsPDFs;
exports.getTextStylesForLabsPDF = getTextStylesForLabsPDF;
// cSpell:ignore Hyperlegible
var node_fs_1 = require("node:fs");
var pdf_lib_1 = require("pdf-lib");
var pdf_consts_1 = require("./pdf-consts");
var pdf_utils_1 = require("./pdf-utils");
exports.LAB_PDF_STYLES = {
    color: {
        red: (0, pdf_utils_1.rgbNormalized)(255, 0, 0),
        purple: (0, pdf_utils_1.rgbNormalized)(77, 21, 183),
        black: (0, pdf_utils_1.rgbNormalized)(0, 0, 0),
        grey: (0, pdf_utils_1.rgbNormalized)(102, 102, 102),
    },
};
function getPdfClientForLabsPDFs() {
    return __awaiter(this, void 0, void 0, function () {
        var initialPageStyles, pdfClient, textStyles, callIcon, faxIcon, locationIcon;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    initialPageStyles = pdf_consts_1.PDF_CLIENT_STYLES;
                    return [4 /*yield*/, (0, pdf_utils_1.createPdfClient)(initialPageStyles)];
                case 1:
                    pdfClient = _a.sent();
                    return [4 /*yield*/, getTextStylesForLabsPDF(pdfClient)];
                case 2:
                    textStyles = _a.sent();
                    return [4 /*yield*/, pdfClient.embedImage(node_fs_1.default.readFileSync('./assets/call.png'))];
                case 3:
                    callIcon = _a.sent();
                    return [4 /*yield*/, pdfClient.embedImage(node_fs_1.default.readFileSync('./assets/fax.png'))];
                case 4:
                    faxIcon = _a.sent();
                    return [4 /*yield*/, pdfClient.embedImage(node_fs_1.default.readFileSync('./assets/location_on.png'))];
                case 5:
                    locationIcon = _a.sent();
                    return [2 /*return*/, { pdfClient: pdfClient, callIcon: callIcon, faxIcon: faxIcon, locationIcon: locationIcon, textStyles: textStyles, initialPageStyles: initialPageStyles }];
            }
        });
    });
}
function getTextStylesForLabsPDF(pdfClient) {
    return __awaiter(this, void 0, void 0, function () {
        var fontRegular, fontBold, e_1, textStyles;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 6]);
                    return [4 /*yield*/, pdfClient.embedFont(node_fs_1.default.readFileSync('./assets/AtkinsonHyperlegibleMono-Regular.ttf'))];
                case 1:
                    fontRegular = _a.sent();
                    return [4 /*yield*/, pdfClient.embedFont(node_fs_1.default.readFileSync('./assets/AtkinsonHyperlegibleMono-Bold.ttf'))];
                case 2:
                    fontBold = _a.sent();
                    console.log('Using AtkinsonHyperlegibleMono font');
                    return [3 /*break*/, 6];
                case 3:
                    e_1 = _a.sent();
                    console.warn('Font not available. Defaulting to Courier', e_1);
                    return [4 /*yield*/, pdfClient.embedStandardFont(pdf_lib_1.StandardFonts.Courier)];
                case 4:
                    fontRegular = _a.sent();
                    return [4 /*yield*/, pdfClient.embedStandardFont(pdf_lib_1.StandardFonts.CourierBold)];
                case 5:
                    fontBold = _a.sent();
                    return [3 /*break*/, 6];
                case 6:
                    textStyles = {
                        blockHeader: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE,
                            spacing: pdf_consts_1.STANDARD_FONT_SPACING,
                            font: fontBold,
                            newLineAfter: true,
                        },
                        header: {
                            fontSize: pdf_consts_1.HEADER_FONT_SIZE,
                            spacing: pdf_consts_1.STANDARD_FONT_SPACING,
                            font: fontBold,
                            color: exports.LAB_PDF_STYLES.color.purple,
                            newLineAfter: true,
                        },
                        headerRight: {
                            fontSize: pdf_consts_1.HEADER_FONT_SIZE,
                            spacing: pdf_consts_1.STANDARD_FONT_SPACING,
                            font: fontBold,
                            side: 'right',
                            color: exports.LAB_PDF_STYLES.color.purple,
                        },
                        subHeaderRight: {
                            fontSize: pdf_consts_1.SUB_HEADER_FONT_SIZE,
                            spacing: pdf_consts_1.STANDARD_FONT_SPACING,
                            font: fontBold,
                            side: 'right',
                            color: exports.LAB_PDF_STYLES.color.grey,
                        },
                        fieldHeader: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE,
                            font: fontRegular,
                            spacing: 1,
                        },
                        fieldHeaderRight: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE,
                            font: fontRegular,
                            spacing: 1,
                            side: 'right',
                        },
                        text: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE,
                            spacing: 6,
                            font: fontRegular,
                        },
                        textBold: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE,
                            spacing: 6,
                            font: fontBold,
                        },
                        textBoldRight: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE,
                            spacing: 6,
                            font: fontBold,
                            side: 'right',
                        },
                        textRight: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE,
                            spacing: 6,
                            font: fontRegular,
                            side: 'right',
                        },
                        textNote: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE - 1,
                            spacing: 6,
                            font: fontRegular,
                        },
                        fieldText: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE,
                            spacing: 6,
                            font: fontRegular,
                            side: 'right',
                            newLineAfter: true,
                        },
                        textGrey: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE,
                            spacing: 6,
                            font: fontRegular,
                            color: exports.LAB_PDF_STYLES.color.grey,
                        },
                        textGreyBold: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE,
                            spacing: 6,
                            font: fontBold,
                            color: exports.LAB_PDF_STYLES.color.grey,
                        },
                        pageNumber: {
                            fontSize: 10,
                            spacing: 6,
                            font: fontRegular,
                            color: exports.LAB_PDF_STYLES.color.grey,
                            side: 'right',
                        },
                        pageHeaderGreyBold: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE - 4,
                            spacing: 6,
                            font: fontBold,
                            color: exports.LAB_PDF_STYLES.color.grey,
                        },
                        pageHeaderGrey: {
                            fontSize: pdf_consts_1.STANDARD_FONT_SIZE - 4,
                            spacing: 6,
                            font: fontRegular,
                            color: exports.LAB_PDF_STYLES.color.grey,
                        },
                    };
                    return [2 /*return*/, textStyles];
            }
        });
    });
}
var drawFieldLine = function (pdfClient, textStyles, fieldName, fieldValue) {
    pdfClient.drawTextSequential(fieldName, textStyles.text);
    pdfClient.drawTextSequential(' ', textStyles.textBold);
    pdfClient.drawTextSequential(fieldValue, textStyles.textBold);
    return pdfClient;
};
exports.drawFieldLine = drawFieldLine;
var drawFieldLineBoldHeader = function (pdfClient, textStyles, fieldName, fieldValue) {
    pdfClient.drawTextSequential(fieldName, textStyles.textBold);
    pdfClient.drawTextSequential(' ', textStyles.text);
    pdfClient.drawTextSequential(fieldValue, textStyles.text);
    return pdfClient;
};
exports.drawFieldLineBoldHeader = drawFieldLineBoldHeader;
var drawFieldLineRight = function (pdfClient, textStyles, fieldName, fieldValue) {
    pdfClient.drawStartXPosSpecifiedText(fieldName, textStyles.text, 285);
    pdfClient.drawTextSequential(' ', textStyles.textBold);
    pdfClient.drawTextSequential(fieldValue, textStyles.textBold, {
        leftBound: pdfClient.getX(),
        rightBound: pdfClient.getRightBound(),
    });
    return pdfClient;
};
exports.drawFieldLineRight = drawFieldLineRight;
var drawFourColumnText = function (pdfClient, textStyles, columnOne, columnTwo, columnThree, columnFour, color) {
    var fontSize = pdf_consts_1.STANDARD_FONT_SIZE;
    var fontStyleTemp = { fontSize: fontSize, color: color };
    pdfClient.drawStartXPosSpecifiedText(columnOne.name, __assign(__assign({}, (columnOne.isBold ? textStyles.textBold : textStyles.text)), fontStyleTemp), columnOne.startXPos);
    pdfClient.drawStartXPosSpecifiedText(columnTwo.name, __assign(__assign({}, (columnTwo.isBold ? textStyles.textBold : textStyles.text)), fontStyleTemp), columnTwo.startXPos);
    pdfClient.drawStartXPosSpecifiedText(columnThree.name, __assign(__assign({}, (columnThree.isBold ? textStyles.textBold : textStyles.text)), fontStyleTemp), columnThree.startXPos);
    pdfClient.drawStartXPosSpecifiedText(columnFour.name, __assign(__assign({}, (columnFour.isBold ? textStyles.textBold : textStyles.text)), fontStyleTemp), columnFour.startXPos);
    return pdfClient;
};
exports.drawFourColumnText = drawFourColumnText;
exports.LABS_PDF_LEFT_INDENTATION_XPOS = 50;
