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
exports.generatePdf = generatePdf;
var pdf_lib_1 = require("pdf-lib");
var helpers_1 = require("../../shared/helpers");
var pdf_utils_1 = require("../../shared/pdf/pdf-utils");
var document_1 = require("./document");
var PAGE_WIDTH = pdf_lib_1.PageSizes.A4[0];
var PAGE_HEIGHT = pdf_lib_1.PageSizes.A4[1];
var DEFAULT_MARGIN = 25;
var PAGE_CONTENT_BOTTOM_MARGIN = 50;
var PATIENT_NAME_FONT_SIZE = 18;
var PID_FONT_SIZE = 12;
var SECTION_TITLE_FONT_SIZE = 16;
var SECTION_TITLE_MARGIN = 10;
var SECTION_BOTTOM_MARGIN = 20;
var DIVIDER_LINE_THICKNESS = 1;
var DIVIDER_LINE_COLOR = (0, pdf_utils_1.rgbNormalized)(0xdf, 0xe5, 0xe9);
var PATIENT_INFO_DIVIDER_MARGIN = 16;
var ITEM_DIVIDER_MARGIN = 8;
var ITEM_WIDTH = (PAGE_WIDTH - DEFAULT_MARGIN * 3) / 2;
var ITEM_FONT_SIZE = 12;
var ITEM_MAX_CHARS_PER_LINE = 25;
var IMAGE_MAX_HEIGHT = PAGE_HEIGHT / 4;
var PAGE_NUMBER_COLOR = (0, pdf_utils_1.rgbNormalized)(0x66, 0x66, 0x66);
var PAGE_NUMBER_FONT_SIZE = 10;
function generatePdf(document) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfDocument, helveticaFont, helveticaBoldFont, firstPage, y;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pdf_lib_1.PDFDocument.create()];
                case 1:
                    pdfDocument = _a.sent();
                    return [4 /*yield*/, pdfDocument.embedFont(pdf_lib_1.StandardFonts.Helvetica)];
                case 2:
                    helveticaFont = _a.sent();
                    return [4 /*yield*/, pdfDocument.embedFont(pdf_lib_1.StandardFonts.HelveticaBold)];
                case 3:
                    helveticaBoldFont = _a.sent();
                    firstPage = pdfDocument.addPage();
                    firstPage.setSize(PAGE_WIDTH, PAGE_HEIGHT);
                    y = drawStamp(document.visitInfo, firstPage, helveticaBoldFont, helveticaFont);
                    y = drawPatientInfo(document.patientInfo, firstPage, PAGE_HEIGHT - DEFAULT_MARGIN, helveticaBoldFont, helveticaFont);
                    drawSections(document.sections, firstPage, y, helveticaBoldFont, helveticaFont);
                    return [4 /*yield*/, drawImageItems(document.imageItems, pdfDocument, helveticaFont)];
                case 4:
                    _a.sent();
                    drawPageNumbers(pdfDocument, helveticaFont);
                    return [2 /*return*/, pdfDocument];
            }
        });
    });
}
function drawStamp(visit, page, titleFont, regularFont) {
    var y = PAGE_HEIGHT - DEFAULT_MARGIN;
    y = drawTextRightAligned('PAPERWORK', page, {
        x: PAGE_WIDTH - DEFAULT_MARGIN,
        y: y,
        font: titleFont,
        size: 20,
    });
    y = drawTextRightAligned("".concat(visit.type, " | ").concat(visit.time, " | ").concat(visit.date), page, {
        x: PAGE_WIDTH - DEFAULT_MARGIN,
        y: y,
        font: regularFont,
        size: 12,
    });
    if (visit.location) {
        y = drawTextRightAligned(visit.location, page, {
            x: PAGE_WIDTH - DEFAULT_MARGIN,
            y: y,
            font: regularFont,
            size: 12,
        });
    }
    return y;
}
function drawPatientInfo(patientInfo, page, y, patientNameFont, pidFont) {
    y = drawTextLeftAligned(patientInfo.name, page, {
        x: DEFAULT_MARGIN,
        y: y,
        font: patientNameFont,
        size: PATIENT_NAME_FONT_SIZE,
    });
    y = drawTextLeftAligned("PID: ".concat(patientInfo.id), page, {
        x: DEFAULT_MARGIN,
        y: y,
        font: pidFont,
        size: PID_FONT_SIZE,
    });
    y = drawLine({
        x: DEFAULT_MARGIN,
        y: y,
        width: PAGE_WIDTH - DEFAULT_MARGIN * 2,
        thickness: DIVIDER_LINE_THICKNESS,
        color: DIVIDER_LINE_COLOR,
        margin: PATIENT_INFO_DIVIDER_MARGIN,
    }, page);
    return y;
}
function drawSections(sections, page, y, titleFont, itemFont) {
    var leftRowPage = page;
    var leftRowY = y;
    var rightRowPage = page;
    var rightRowY = y;
    for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
        var section = sections_1[_i];
        var leftRowPageIndex = getPageIndex(leftRowPage);
        var rightRowPageIndex = getPageIndex(rightRowPage);
        if (leftRowPageIndex < rightRowPageIndex || (leftRowPageIndex === rightRowPageIndex && leftRowY >= rightRowY)) {
            var _a = drawSection(section, leftRowPage, DEFAULT_MARGIN, leftRowY, titleFont, itemFont), pageAfterSectionDraw = _a[0], yAfterSectionDraw = _a[1];
            leftRowPage = pageAfterSectionDraw;
            leftRowY = yAfterSectionDraw;
        }
        else {
            var _b = drawSection(section, rightRowPage, DEFAULT_MARGIN * 2 + ITEM_WIDTH, rightRowY, titleFont, itemFont), pageAfterSectionDraw = _b[0], yAfterSectionDraw = _b[1];
            rightRowPage = pageAfterSectionDraw;
            rightRowY = yAfterSectionDraw;
        }
    }
}
function drawSection(section, page, x, y, titleFont, itemFont) {
    var _a = drawSectionTitle(section.title, page, x, y, titleFont), pageAfterSectionTitleDraw = _a[0], yAfterSectionTitleDraw = _a[1];
    page = pageAfterSectionTitleDraw;
    y = yAfterSectionTitleDraw;
    for (var _i = 0, _b = section.items; _i < _b.length; _i++) {
        var item = _b[_i];
        var _c = drawItem(item, page, x, y, itemFont), pageAfterItemDraw = _c[0], yAfterItemDraw = _c[1];
        page = pageAfterItemDraw;
        y = yAfterItemDraw;
        y = drawLine({
            x: x,
            y: y,
            width: ITEM_WIDTH,
            thickness: DIVIDER_LINE_THICKNESS,
            color: DIVIDER_LINE_COLOR,
            margin: ITEM_DIVIDER_MARGIN,
        }, page);
    }
    return [page, y - SECTION_BOTTOM_MARGIN];
}
function drawSectionTitle(title, page, x, y, font) {
    var lines = splitOnLines(title, 30);
    var height = calculateTextHeight(lines, { font: font, fontSize: SECTION_TITLE_FONT_SIZE });
    if (y - height < PAGE_CONTENT_BOTTOM_MARGIN) {
        page = getNextPage(page);
        y = PAGE_HEIGHT - DEFAULT_MARGIN;
    }
    y = drawTextLeftAligned(lines, page, {
        x: x,
        y: y,
        font: font,
        size: SECTION_TITLE_FONT_SIZE,
    });
    y -= SECTION_TITLE_MARGIN;
    return [page, y];
}
function drawItem(item, page, x, y, font) {
    var question = item.question, answer = item.answer;
    var questionLines = splitOnLines(question, ITEM_MAX_CHARS_PER_LINE);
    var answerLines = splitOnLines(answer, ITEM_MAX_CHARS_PER_LINE);
    var questionHeight = calculateTextHeight(questionLines, { font: font, fontSize: ITEM_FONT_SIZE });
    var answerHeight = calculateTextHeight(answerLines, { font: font, fontSize: ITEM_FONT_SIZE });
    if (y - Math.max(questionHeight, answerHeight) < PAGE_CONTENT_BOTTOM_MARGIN) {
        page = getNextPage(page);
        y = PAGE_HEIGHT - DEFAULT_MARGIN;
    }
    var questionY = drawTextLeftAligned(questionLines, page, {
        font: font,
        size: ITEM_FONT_SIZE,
        lineHeight: ITEM_FONT_SIZE,
        x: x,
        y: y,
    });
    var answerY = drawTextRightAligned(answerLines, page, {
        font: font,
        size: ITEM_FONT_SIZE,
        x: x + ITEM_WIDTH,
        y: y,
    });
    return [page, Math.min(questionY, answerY)];
}
function drawImageItems(imageItems, document, titleFont) {
    return __awaiter(this, void 0, void 0, function () {
        var leftRowY, rightRowY, page, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    leftRowY = PAGE_HEIGHT - DEFAULT_MARGIN;
                    rightRowY = leftRowY;
                    page = document.addPage();
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < imageItems.length)) return [3 /*break*/, 5];
                    if (i % 6 === 0 && i !== 0) {
                        page = document.addPage();
                        page.setSize(PAGE_WIDTH, PAGE_HEIGHT);
                        leftRowY = PAGE_HEIGHT - DEFAULT_MARGIN;
                        rightRowY = leftRowY;
                    }
                    return [4 /*yield*/, drawImageItem(imageItems[i], page, DEFAULT_MARGIN, leftRowY, titleFont)];
                case 2:
                    leftRowY = _a.sent();
                    if (!(i + 1 < imageItems.length)) return [3 /*break*/, 4];
                    return [4 /*yield*/, drawImageItem(imageItems[i + 1], page, DEFAULT_MARGIN * 2 + ITEM_WIDTH, rightRowY, titleFont)];
                case 3:
                    rightRowY = _a.sent();
                    _a.label = 4;
                case 4:
                    i += 2;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/, Math.max(leftRowY, rightRowY)];
            }
        });
    });
}
function drawImageItem(imageItem, page, x, y, titleFont) {
    return __awaiter(this, void 0, void 0, function () {
        var imageBytes, image, _a, scale, drawWidth, drawHeight;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    y = drawTextLeftAligned(splitOnLines(imageItem.title, 45), page, {
                        x: x,
                        y: y,
                        font: titleFont,
                        size: ITEM_FONT_SIZE,
                    });
                    return [4 /*yield*/, imageItem.imageBytes];
                case 1:
                    imageBytes = _b.sent();
                    if (!(imageItem.imageType === document_1.ImageType.JPG)) return [3 /*break*/, 3];
                    return [4 /*yield*/, page.doc.embedJpg(imageBytes)];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 5];
                case 3: return [4 /*yield*/, page.doc.embedPng(imageBytes)];
                case 4:
                    _a = _b.sent();
                    _b.label = 5;
                case 5:
                    image = _a;
                    scale = Math.max(image.width / ITEM_WIDTH, image.height / IMAGE_MAX_HEIGHT);
                    drawWidth = scale > 1 ? image.width / scale : image.width;
                    drawHeight = scale > 1 ? image.height / scale : image.height;
                    page.drawImage(image, {
                        x: x,
                        y: y - drawHeight - DEFAULT_MARGIN,
                        width: drawWidth,
                        height: drawHeight,
                    });
                    return [2 /*return*/, y - IMAGE_MAX_HEIGHT - 2 * DEFAULT_MARGIN];
            }
        });
    });
}
function drawPageNumbers(pdfDocument, font) {
    pdfDocument.getPages().forEach(function (page, index) {
        drawTextLeftAligned("Page ".concat(index + 1, " of ").concat(pdfDocument.getPageCount()), page, {
            x: DEFAULT_MARGIN,
            y: DEFAULT_MARGIN + font.heightAtSize(PAGE_NUMBER_FONT_SIZE),
            font: font,
            color: PAGE_NUMBER_COLOR,
            size: PAGE_NUMBER_FONT_SIZE,
        });
    });
}
function drawTextLeftAligned(text, page, options) {
    var font = (0, helpers_1.assertDefined)(options.font, 'options.font');
    var fontSize = (0, helpers_1.assertDefined)(options.size, 'options.size');
    var optionsY = (0, helpers_1.assertDefined)(options.y, 'options.y');
    var y = optionsY - font.heightAtSize(ITEM_FONT_SIZE, { descender: false });
    page.drawText(text, __assign(__assign({}, options), { y: y }));
    return optionsY - font.heightAtSize(fontSize) * ((text.match(/\n/g) || []).length + 1);
}
function drawTextRightAligned(text, page, options) {
    var lines = text.split('\n');
    var font = (0, helpers_1.assertDefined)(options.font, 'options.font');
    var fontSize = (0, helpers_1.assertDefined)(options.size, 'options.size');
    var x = (0, helpers_1.assertDefined)(options.x, 'options.x');
    var optionsY = (0, helpers_1.assertDefined)(options.y, 'options.y');
    var y = optionsY - font.heightAtSize(ITEM_FONT_SIZE, { descender: false });
    for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
        var line = lines_1[_i];
        var lineWidth = font.widthOfTextAtSize(line, fontSize);
        page.drawText(line, __assign(__assign({}, options), { x: x - lineWidth, y: y }));
        y -= font.heightAtSize(fontSize);
    }
    return optionsY - font.heightAtSize(fontSize) * lines.length;
}
function drawLine(line, page) {
    page.drawLine({
        color: line.color,
        thickness: line.thickness,
        start: { x: line.x, y: line.y - line.margin },
        end: { x: line.x + line.width, y: line.y - line.margin },
    });
    return line.y - line.margin * 2 + line.thickness;
}
function splitOnLines(text, maxCharsPerLine) {
    var words = text.split(' ').flatMap(function (word) {
        if (word.length < maxCharsPerLine) {
            return [word];
        }
        var segmentStart = 0;
        var restLength = word.length;
        var segments = [];
        while (restLength > 0) {
            segments.push(word.substring(segmentStart, Math.min(segmentStart + maxCharsPerLine, word.length)));
            segmentStart += maxCharsPerLine;
            restLength -= maxCharsPerLine;
        }
        return segments;
    });
    var lines = [];
    var currentLine = words[0];
    for (var i = 1; i < words.length; i++) {
        var word = words[i];
        if (currentLine.length + word.length < maxCharsPerLine) {
            currentLine += ' ' + word;
        }
        else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }
    return lines.join('\n');
}
function getNextPage(page) {
    var pdfDocument = page.doc;
    var currentPageIndex = getPageIndex(page);
    if (currentPageIndex === pdfDocument.getPageCount() - 1) {
        var page_1 = pdfDocument.addPage();
        page_1.setSize(PAGE_WIDTH, PAGE_HEIGHT);
        return page_1;
    }
    return pdfDocument.getPage(currentPageIndex + 1);
}
function getPageIndex(page) {
    return page.doc.getPages().indexOf(page);
}
function calculateTextHeight(text, options) {
    return options.font.heightAtSize(options.fontSize) * ((text.match(/\n/g) || []).length + 1);
}
