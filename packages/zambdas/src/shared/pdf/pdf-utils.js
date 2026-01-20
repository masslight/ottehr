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
exports.calculateAge = exports.BLACK_LINE_STYLE = exports.SEPARATED_LINE_STYLE = exports.rgbNormalized = exports.PdfDocumentReferencePublishedStatuses = void 0;
exports.savePdfLocally = savePdfLocally;
exports.isDocumentPublished = isDocumentPublished;
exports.handleBadSpaces = handleBadSpaces;
exports.splitLongStringToPageSize = splitLongStringToPageSize;
exports.createPdfClient = createPdfClient;
exports.getPdfLogo = getPdfLogo;
// cSpell:ignore annot, annots
var node_fs_1 = require("node:fs");
var fontkit_1 = require("@pdf-lib/fontkit");
var aws_serverless_1 = require("@sentry/aws-serverless");
var pdf_lib_1 = require("pdf-lib");
var utils_1 = require("utils");
var pdf_consts_1 = require("./pdf-consts");
// For testing needs
function savePdfLocally(pdfBytes) {
    // Write the Uint8Array to a file
    node_fs_1.default.writeFile('myTestFile.pdf', pdfBytes, function (err) {
        if (err) {
            console.error('Error saving PDF:', err);
        }
        else {
            console.log('PDF saved successfully!');
        }
    });
}
exports.PdfDocumentReferencePublishedStatuses = {
    published: 'final',
    unpublished: 'preliminary',
};
function isDocumentPublished(doc) {
    return doc.docStatus === exports.PdfDocumentReferencePublishedStatuses.published;
}
function handleBadSpaces(text) {
    // https://github.com/nodejs/node/issues/46123
    // replacing U+202f with simple whitespace due to bug in NodeJS v18.11 - 18.5
    // for PDFs to work correctly
    return text.replace(' ', ' ');
}
function splitLongStringToPageSize(text, font, fontSize, desiredWidth) {
    var inputStrings = text.split('\n'); // handle new lines first
    var resultStrings = [];
    inputStrings.forEach(function (str) {
        var words = str.split(' ');
        var validLine = '';
        var lineWidth = 0;
        words.forEach(function (word) {
            var wordWidth = font.widthOfTextAtSize(word + ' ', fontSize);
            if (lineWidth + wordWidth <= desiredWidth) {
                validLine = "".concat(validLine.concat(word), " ");
                lineWidth += wordWidth;
            }
            else {
                resultStrings.push(validLine);
                validLine = word + ' ';
                lineWidth = wordWidth;
            }
        });
        resultStrings.push(validLine);
    });
    return resultStrings;
}
var rgbNormalized = function (r, g, b) { return (0, pdf_lib_1.rgb)(r / 255, g / 255, b / 255); };
exports.rgbNormalized = rgbNormalized;
function createPdfClient(initialStyles) {
    return __awaiter(this, void 0, void 0, function () {
        var pdfDoc, page, pageLeftBound, pageRightBound, currXPos, currYPos, bottomOfPageHeaderYPos, pageTextWidth, pageStyles, pages, currentPageIndex, addNewPage, numberPages, drawText, drawStartXPosSpecifiedText, drawTextSequential, drawImage, drawLabelValueRow, newLine, getCurrentPageIndex, getTotalPages, setPageByIndex, getX, getY, setX, setY, getLeftBound, getRightBound, setLeftBound, setRightBound, getTextDimensions, save, embedFont, embedStandardFont, embedImage, embedJpg, embedPdfFromBase64, embedImageFromBase64, drawSeparatedLine, setPageStyles, drawVariableWidthColumns, drawLink, getPageTopY;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pdf_lib_1.PDFDocument.create()];
                case 1:
                    pdfDoc = _a.sent();
                    pdfDoc.registerFontkit(fontkit_1.default);
                    pageLeftBound = 0;
                    pageRightBound = 0;
                    currXPos = 0;
                    currYPos = 0;
                    bottomOfPageHeaderYPos = 0;
                    pageTextWidth = function () {
                        return pageRightBound - pageLeftBound;
                    };
                    pageStyles = initialStyles.initialPage;
                    pages = [];
                    addNewPage = function (styles, newLeftBound, newRightBound) {
                        var _a, _b, _c;
                        console.log('\nAdding new page');
                        console.log("currentPageIndex is ".concat(currentPageIndex, " of ").concat(pages.length, " pages"));
                        var addedBrandNewPage = false;
                        // figure out if we just need to run on to a pre-existing page or truly add a new one
                        if (currentPageIndex !== undefined && currentPageIndex < pages.length - 1) {
                            console.log('Current page is not the last page. Setting page to the next page');
                            page = pages[currentPageIndex + 1];
                        }
                        else {
                            console.log('Current page was the last page. Adding brand new page');
                            page = pdfDoc.addPage();
                            addedBrandNewPage = true;
                            page.setSize(styles.width, styles.height);
                            pageStyles = styles;
                            pages.push(page);
                        }
                        var _d = page.getSize(), height = _d.height, width = _d.width;
                        // Start at the top of the page then move down as elements are added to the PDF. If there is a header, then we need to set currYPos differently
                        currYPos = height - ((_a = styles.pageMargins.top) !== null && _a !== void 0 ? _a : 0); // top of page. Content starts after this point
                        currYPos -= pdf_consts_1.Y_POS_GAP; //by default, we have some kind of gap without this subtraction
                        pageLeftBound = newLeftBound ? newLeftBound : (_b = styles.pageMargins.left) !== null && _b !== void 0 ? _b : 0;
                        pageRightBound = newRightBound ? newRightBound : width - ((_c = styles.pageMargins.right) !== null && _c !== void 0 ? _c : 0);
                        currXPos = pageLeftBound;
                        if (currentPageIndex !== undefined) {
                            currentPageIndex++;
                            console.log("Incrementing page index to ".concat(currentPageIndex));
                        }
                        else
                            currentPageIndex = 0;
                        if (!addedBrandNewPage && styles.setHeadline && currentPageIndex !== 0) {
                            console.log("On the next page and there is a header, setting currY pos to bottomOfPageHeaderYPos");
                            currYPos = bottomOfPageHeaderYPos;
                            console.log("currYPos is ".concat(currYPos, ". bottomOfPageHeaderYPos is ").concat(bottomOfPageHeaderYPos));
                        }
                        if (addedBrandNewPage && styles.setHeadline) {
                            console.log('addedBrandNewPage is true and styles.setHeadline is defined. settingHeadline');
                            styles.setHeadline();
                            bottomOfPageHeaderYPos = currYPos;
                        }
                        console.log('Done with new page\n');
                    };
                    // adding initial page when initializing pdfClient
                    addNewPage(initialStyles.initialPage);
                    numberPages = function (textStyle) {
                        console.log('Numbering pages');
                        var bottomMargin = pageStyles.pageMargins.bottom;
                        if (!bottomMargin) {
                            console.warn('Unable to number pages, no bottom margin is set or no space is available.');
                            return;
                        }
                        var midMargin = bottomMargin / 2;
                        var textHeight = getTextDimensions('Page 1 of 2', textStyle).height;
                        if (textHeight >= midMargin) {
                            console.warn('Unable to number pages, text height exceeds half of margin available space.');
                            return;
                        }
                        var font = textStyle.font, fontSize = textStyle.fontSize, color = textStyle.color, side = textStyle.side;
                        var totalPages = pages.length;
                        // set current page back to index 0
                        // for each page, go through each one, write the page number, and then continue
                        for (var i = 0; i < totalPages; i++) {
                            currXPos = pageLeftBound;
                            // set y to middle of the margin
                            currYPos = midMargin;
                            currentPageIndex = i;
                            setPageByIndex(currentPageIndex);
                            var text = "Page ".concat(i + 1, " of ").concat(totalPages);
                            var lineWidth = getTextDimensions(text, textStyle).width;
                            console.log("currXPos is ".concat(currXPos, ". currYPos is ").concat(currYPos, ". currentPageIndex is ").concat(currentPageIndex, ". Writing text '").concat(text, "'"));
                            if (side === 'right')
                                currXPos = pageLeftBound + pageTextWidth() - lineWidth;
                            else if (side === 'center')
                                currXPos = pageLeftBound + (pageTextWidth() - lineWidth) / 2;
                            page.drawText(text, {
                                font: font,
                                size: fontSize,
                                x: currXPos,
                                y: currYPos,
                                color: color,
                            });
                            console.log("After draw text. currXPos is ".concat(currXPos, ". currYPos is ").concat(currYPos, ". currentPageIndex is ").concat(currentPageIndex, ". Wrote text '").concat(text, "'"));
                        }
                        return;
                    };
                    drawText = function (text, textStyle) {
                        var font = textStyle.font, fontSize = textStyle.fontSize, color = textStyle.color, side = textStyle.side, spacing = textStyle.spacing;
                        currXPos = pageLeftBound;
                        splitLongStringToPageSize(text, font, fontSize, pageTextWidth()).forEach(function (line, index) {
                            var _a;
                            var _b = getTextDimensions(line, textStyle), lineWidth = _b.width, lineHeight = _b.height;
                            if (currYPos - lineHeight < ((_a = pageStyles.pageMargins.bottom) !== null && _a !== void 0 ? _a : 0))
                                addNewPage(pageStyles, pageLeftBound, pageRightBound);
                            if (index !== 0)
                                currYPos -= lineHeight + spacing; // skip first and add new line before writing text
                            if (side === 'right')
                                currXPos = pageLeftBound + pageTextWidth() - lineWidth;
                            else if (side === 'center')
                                currXPos = pageLeftBound + (pageTextWidth() - lineWidth) / 2;
                            page.drawText(line, {
                                font: font,
                                size: fontSize,
                                x: currXPos,
                                y: currYPos,
                                color: color,
                            });
                        });
                        if (textStyle.newLineAfter) {
                            var currentTextHeight = font.heightAtSize(fontSize);
                            currYPos -= currentTextHeight + spacing;
                            currXPos = pageLeftBound;
                        }
                    };
                    drawStartXPosSpecifiedText = function (text, textStyle, startingXPos, bounds) {
                        console.log('In drawStartXPosSpecifiedText');
                        var font = textStyle.font, fontSize = textStyle.fontSize, spacing = textStyle.spacing;
                        var leftBound = (bounds === null || bounds === void 0 ? void 0 : bounds.leftBound) !== undefined ? bounds.leftBound : pageLeftBound;
                        var rightBound = (bounds === null || bounds === void 0 ? void 0 : bounds.rightBound) !== undefined ? bounds.rightBound : pageRightBound;
                        var currentTextHeight = font.heightAtSize(fontSize);
                        if (startingXPos < leftBound)
                            currXPos = leftBound;
                        else if (startingXPos >= rightBound) {
                            newLine(currentTextHeight);
                            currXPos = leftBound;
                        }
                        else
                            currXPos = startingXPos;
                        console.log("Drawing at xPos: ".concat(currXPos, ". String to draw is ").concat(text));
                        drawTextSequential(text, textStyle, { leftBound: currXPos, rightBound: pageRightBound });
                        if (textStyle.newLineAfter) {
                            console.log('>>>TextStyle included newline');
                            currYPos -= currentTextHeight + spacing;
                            currXPos = leftBound;
                        }
                        console.log('Done in drawStartXPosSpecifiedText');
                        return { endXPos: currXPos, endYPos: currYPos };
                    };
                    drawTextSequential = function (text, textStyle, bounds) {
                        var _a;
                        console.log('\nin drawTextSequential');
                        var font = textStyle.font, fontSize = textStyle.fontSize, color = textStyle.color, spacing = textStyle.spacing;
                        var _b = getTextDimensions(text, textStyle), lineWidth = _b.width, lineHeight = _b.height;
                        var leftBound = (bounds === null || bounds === void 0 ? void 0 : bounds.leftBound) !== undefined ? bounds.leftBound : pageLeftBound;
                        var rightBound = (bounds === null || bounds === void 0 ? void 0 : bounds.rightBound) !== undefined ? bounds.rightBound : pageRightBound;
                        if ((bounds === null || bounds === void 0 ? void 0 : bounds.leftBound) !== undefined)
                            currXPos = leftBound;
                        console.log("Text is '".concat(text, "'\n\n      lineWidth is ").concat(lineWidth, "\n\n      lineHeight is ").concat(lineHeight, "\n\n      currXpos is ").concat(currXPos, "\n\n      leftBound is ").concat(leftBound, "\n\n      rightBound is ").concat(rightBound, "\n"));
                        // if the text contains \n, we need to recursively handle each of those ourselves, otherwise
                        // pdf-lib will try to do it for us, but with unpredictable line break spacing
                        if (text.includes('\n')) {
                            console.log('Found return character in text. recursively drawing each line');
                            var lines = text.split('\n');
                            for (var i = 0; i < lines.length; i++) {
                                console.log("Drawing split line: '".concat(lines[i], "'"));
                                drawTextSequential(lines[i], textStyle, bounds);
                                if (i < lines.length - 1) {
                                    newLine(lineHeight + spacing + 2);
                                }
                            }
                            return;
                        }
                        // Add a new page if there's no space on the current page
                        if (currYPos - lineHeight < ((_a = pageStyles.pageMargins.bottom) !== null && _a !== void 0 ? _a : 0)) {
                            addNewPage(pageStyles, pageLeftBound, pageRightBound);
                            currXPos = leftBound;
                        }
                        // Calculate available space on the current line
                        var availableWidth = rightBound - currXPos;
                        var totalWidth = rightBound - leftBound;
                        console.log("AvailableWidth is ".concat(availableWidth, ". Total width is ").concat(totalWidth));
                        // If the text fits within the current line, draw it directly
                        if (lineWidth < totalWidth) {
                            console.log('lineWidth of text fits between left and right bounds');
                            if (lineWidth > availableWidth) {
                                console.log("lineWidth ".concat(lineWidth, " is greater than available width ").concat(availableWidth, ". Adding newline and drawing."));
                                newLine(lineHeight + spacing);
                            }
                            page.drawText(text, {
                                font: font,
                                size: fontSize,
                                x: currXPos,
                                y: currYPos,
                                color: color,
                            });
                            currXPos += lineWidth;
                            // If textStyle specifies to move to the next line after drawing
                            if (textStyle.newLineAfter) {
                                currYPos -= lineHeight + spacing;
                                currXPos = leftBound;
                            }
                        }
                        else {
                            console.log('text will not fit between left and right bounds. Need to split text');
                            // If the text is too wide, find the part that fits
                            var fittingText = '';
                            var remainingText = text;
                            var currentWidth = 0;
                            // APPROACH 1: Split on spaces
                            // determine what fits based on word breaks to avoid cutting words off with linebreaks
                            var words = remainingText.split(' ');
                            var firstWordWidth = getTextDimensions(words[0], textStyle).width;
                            var splitMethodIsWords = true;
                            var elements = words;
                            var separator = ' ';
                            var widthOfSeparator = getTextDimensions(separator, textStyle).width;
                            // APPROACH 2: if the first word is itself bigger than the total width (rightBound - leftBound), then we need a different approach
                            // it's ok just to check the first word, because if subsequent words are too long, we recurse anyway
                            console.log("words[0] is ".concat(words[0], ". firstWordWidth is ").concat(firstWordWidth));
                            if (firstWordWidth + widthOfSeparator > totalWidth) {
                                splitMethodIsWords = false;
                                elements = remainingText.split('');
                                separator = '';
                                widthOfSeparator = 0;
                            }
                            console.log("Splitting method is ".concat(splitMethodIsWords ? 'words' : 'characters'));
                            for (var i = 0; i < elements.length; i++) {
                                var elementWidth = getTextDimensions(elements[i], textStyle).width;
                                if (currentWidth + elementWidth + widthOfSeparator > availableWidth) {
                                    fittingText = elements.slice(0, i).join(separator);
                                    remainingText = elements.slice(i, undefined).join(separator);
                                    break;
                                }
                                currentWidth += elementWidth + widthOfSeparator;
                            }
                            // Draw the fitting part on the current line
                            page.drawText(fittingText, {
                                font: font,
                                size: fontSize,
                                x: currXPos,
                                y: currYPos,
                                color: color,
                            });
                            // Move to the next line and reset x position
                            newLine(lineHeight);
                            // Recursively call the function with the remaining text
                            console.log('recursively calling drawTextSequential');
                            drawTextSequential(remainingText, textStyle, bounds);
                        }
                    };
                    drawImage = function (img, styles, textStyle) {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                        var width = page.getSize().width;
                        var height = (textStyle ? getTextDimensions('A', textStyle) : { height: styles.height }).height;
                        if (currYPos - height < ((_a = pageStyles.pageMargins.bottom) !== null && _a !== void 0 ? _a : 0))
                            addNewPage(pageStyles, pageLeftBound, pageRightBound);
                        currYPos -= (_c = (_b = styles.margin) === null || _b === void 0 ? void 0 : _b.top) !== null && _c !== void 0 ? _c : 0;
                        currXPos = styles.center ? (width - styles.width) / 2 : currXPos + ((_e = (_d = styles.margin) === null || _d === void 0 ? void 0 : _d.left) !== null && _e !== void 0 ? _e : 0);
                        page.drawImage(img, {
                            x: currXPos,
                            y: currYPos,
                            width: styles.width,
                            height: styles.height,
                        });
                        // space after image
                        if (styles.center) {
                            currYPos -= styles.height + ((_g = (_f = styles.margin) === null || _f === void 0 ? void 0 : _f.bottom) !== null && _g !== void 0 ? _g : 0);
                        }
                        else {
                            currXPos += styles.width + ((_j = (_h = styles.margin) === null || _h === void 0 ? void 0 : _h.right) !== null && _j !== void 0 ? _j : 0);
                        }
                    };
                    drawLabelValueRow = function (label, value, labelStyle, valueStyle, options) {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                        var drawDivider = (_a = options === null || options === void 0 ? void 0 : options.drawDivider) !== null && _a !== void 0 ? _a : false;
                        var dividerMargin = (_b = options === null || options === void 0 ? void 0 : options.dividerMargin) !== null && _b !== void 0 ? _b : 4;
                        var defaultValue = (_c = options === null || options === void 0 ? void 0 : options.defaultValue) !== null && _c !== void 0 ? _c : '-';
                        var spacing = (_d = options === null || options === void 0 ? void 0 : options.spacing) !== null && _d !== void 0 ? _d : Math.max((_e = labelStyle.spacing) !== null && _e !== void 0 ? _e : 0, (_f = valueStyle.spacing) !== null && _f !== void 0 ? _f : 0);
                        var labelValueGap = (_g = options === null || options === void 0 ? void 0 : options.labelValueGap) !== null && _g !== void 0 ? _g : 10;
                        var displayValue = !value || value.trim() === '' ? defaultValue : value;
                        var availableWidth = pageRightBound - pageLeftBound;
                        var maxLabelWidth = availableWidth * 0.5;
                        var maxValueWidth = availableWidth * 0.5 - labelValueGap;
                        var labelLines = splitLongStringToPageSize(label, labelStyle.font, labelStyle.fontSize, maxLabelWidth);
                        var valueLines = splitLongStringToPageSize(displayValue, valueStyle.font, valueStyle.fontSize, maxValueWidth);
                        var labelHeight = labelStyle.font.heightAtSize(labelStyle.fontSize) * labelLines.length;
                        var valueHeight = valueStyle.font.heightAtSize(valueStyle.fontSize) * valueLines.length;
                        var maxHeight = Math.max(labelHeight, valueHeight);
                        if (currYPos - maxHeight < ((_h = pageStyles.pageMargins.bottom) !== null && _h !== void 0 ? _h : 0)) {
                            addNewPage(pageStyles, pageLeftBound, pageRightBound);
                        }
                        var startY = currYPos;
                        var startX = pageLeftBound;
                        var labelY = startY;
                        for (var i = 0; i < labelLines.length; i++) {
                            var line = labelLines[i];
                            var yPos = labelY - labelStyle.font.heightAtSize(labelStyle.fontSize, { descender: false });
                            page.drawText(line, {
                                font: labelStyle.font,
                                size: labelStyle.fontSize,
                                x: startX,
                                y: yPos,
                                color: labelStyle.color,
                            });
                            labelY -= labelStyle.font.heightAtSize(labelStyle.fontSize);
                        }
                        var valueY = startY;
                        for (var i = 0; i < valueLines.length; i++) {
                            var line = valueLines[i];
                            var lineWidth = valueStyle.font.widthOfTextAtSize(line, valueStyle.fontSize);
                            var yPos = valueY - valueStyle.font.heightAtSize(valueStyle.fontSize, { descender: false });
                            var valueX = pageRightBound - lineWidth;
                            page.drawText(line, {
                                font: valueStyle.font,
                                size: valueStyle.fontSize,
                                x: valueX,
                                y: yPos,
                                color: valueStyle.color,
                            });
                            valueY -= valueStyle.font.heightAtSize(valueStyle.fontSize);
                        }
                        currYPos = Math.min(labelY, valueY) - spacing;
                        currXPos = pageLeftBound;
                        if (drawDivider) {
                            var dividerStyle = (_j = options === null || options === void 0 ? void 0 : options.dividerStyle) !== null && _j !== void 0 ? _j : {
                                thickness: 1,
                                color: (0, exports.rgbNormalized)(0xdf, 0xe5, 0xe9),
                                margin: { top: dividerMargin, bottom: dividerMargin },
                            };
                            page.drawLine({
                                color: dividerStyle.color,
                                thickness: dividerStyle.thickness,
                                start: { x: pageLeftBound, y: currYPos - dividerMargin },
                                end: { x: pageRightBound, y: currYPos - dividerMargin },
                            });
                            currYPos -= dividerMargin * 2 - dividerStyle.thickness;
                        }
                        else {
                            currYPos -= spacing;
                            currXPos = pageLeftBound;
                        }
                    };
                    newLine = function (yDrop) {
                        // add check if it's gonna fit in current page or we gonna need new one
                        currYPos -= yDrop;
                        currXPos = pageLeftBound;
                    };
                    getCurrentPageIndex = function () {
                        return currentPageIndex !== null && currentPageIndex !== void 0 ? currentPageIndex : 0;
                    };
                    getTotalPages = function () {
                        return pages.length;
                    };
                    setPageByIndex = function (pageIndex) {
                        if (!pages.length)
                            throw new Error('Cannot set page. No pages exist');
                        if (pageIndex >= pages.length || pageIndex < 0)
                            throw new Error('Page index is out of bounds');
                        page = pages[pageIndex];
                    };
                    getX = function () {
                        return currXPos;
                    };
                    getY = function () {
                        return currYPos;
                    };
                    setX = function (x) {
                        currXPos = x;
                    };
                    setY = function (y) {
                        currYPos = y;
                    };
                    getLeftBound = function () {
                        return pageLeftBound;
                    };
                    getRightBound = function () {
                        return pageRightBound;
                    };
                    setLeftBound = function (newBound) {
                        pageLeftBound = newBound;
                    };
                    setRightBound = function (newBound) {
                        pageRightBound = newBound;
                    };
                    getTextDimensions = function (text, textStyle) {
                        var font = textStyle.font, fontSize = textStyle.fontSize;
                        return {
                            width: font.widthOfTextAtSize(text, fontSize),
                            height: font.heightAtSize(fontSize),
                        };
                    };
                    save = function () { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, pdfDoc.save()];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        });
                    }); };
                    embedFont = function (file) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, pdfDoc.embedFont(new Uint8Array(file))];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        });
                    }); };
                    embedStandardFont = function (font) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, pdfDoc.embedFont(font)];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        });
                    }); };
                    embedImage = function (file) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, pdfDoc.embedPng(new Uint8Array(file))];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        });
                    }); };
                    embedJpg = function (file) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, pdfDoc.embedJpg(new Uint8Array(file))];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        });
                    }); };
                    embedPdfFromBase64 = function (base64String) { return __awaiter(_this, void 0, void 0, function () {
                        var byteArray, sourcePdf, totalPages, embeddedPages, _i, embeddedPages_1, embeddedPage, page_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    console.log('decoding base64');
                                    byteArray = Uint8Array.from(atob(base64String), function (c) { return c.charCodeAt(0); });
                                    console.log('getting total page count');
                                    return [4 /*yield*/, pdf_lib_1.PDFDocument.load(byteArray)];
                                case 1:
                                    sourcePdf = _a.sent();
                                    totalPages = sourcePdf.getPageCount();
                                    console.log("will embed ".concat(totalPages, " pages"));
                                    console.log('embedding PDF bytes');
                                    return [4 /*yield*/, pdfDoc.embedPdf(byteArray, Array.from({ length: totalPages }, function (_, i) { return i; }))];
                                case 2:
                                    embeddedPages = _a.sent();
                                    console.log('adding embedded pages');
                                    for (_i = 0, embeddedPages_1 = embeddedPages; _i < embeddedPages_1.length; _i++) {
                                        embeddedPage = embeddedPages_1[_i];
                                        page_1 = pdfDoc.addPage([embeddedPage.width, embeddedPage.height]);
                                        page_1.drawPage(embeddedPage, {
                                            x: 0,
                                            y: 0,
                                            width: embeddedPage.width,
                                            height: embeddedPage.height,
                                        });
                                    }
                                    console.log('done handling pdf attachment within pdf');
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    embedImageFromBase64 = function (base64String, imgType) { return __awaiter(_this, void 0, void 0, function () {
                        var byteArray, image, _a, page, _b, pageWidth, pageHeight, imgWidth, imgHeight, DEFAULT_MARGIN, ITEM_WIDTH, IMAGE_MAX_HEIGHT, scale, drawWidth, drawHeight;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    console.log('decoding base64');
                                    byteArray = Uint8Array.from(atob(base64String), function (c) { return c.charCodeAt(0); });
                                    console.log("embedding ".concat(imgType, " IMG bytes"));
                                    if (!(imgType === 'PNG')) return [3 /*break*/, 2];
                                    return [4 /*yield*/, pdfDoc.embedPng(byteArray)];
                                case 1:
                                    _a = _c.sent();
                                    return [3 /*break*/, 4];
                                case 2: return [4 /*yield*/, pdfDoc.embedJpg(byteArray)];
                                case 3:
                                    _a = _c.sent();
                                    _c.label = 4;
                                case 4:
                                    image = _a;
                                    page = pdfDoc.addPage();
                                    _b = page.getSize(), pageWidth = _b.width, pageHeight = _b.height;
                                    imgWidth = image.width, imgHeight = image.height;
                                    DEFAULT_MARGIN = 25;
                                    ITEM_WIDTH = pageWidth - DEFAULT_MARGIN * 2;
                                    IMAGE_MAX_HEIGHT = pageHeight - pageHeight * 0.25;
                                    scale = Math.max(image.width / ITEM_WIDTH, image.height / IMAGE_MAX_HEIGHT);
                                    drawWidth = scale > 1 ? image.width / scale : image.width;
                                    drawHeight = scale > 1 ? image.height / scale : image.height;
                                    console.log('drawing the image attachment on a new page', imgWidth, imgHeight);
                                    page.drawImage(image, {
                                        x: DEFAULT_MARGIN,
                                        y: pageHeight - drawHeight - DEFAULT_MARGIN,
                                        width: drawWidth,
                                        height: drawHeight,
                                    });
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    drawSeparatedLine = function (lineStyle) {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
                        var startX = pageLeftBound + ((_b = (_a = lineStyle.margin) === null || _a === void 0 ? void 0 : _a.left) !== null && _b !== void 0 ? _b : 0);
                        var endX = pageRightBound - ((_d = (_c = lineStyle.margin) === null || _c === void 0 ? void 0 : _c.right) !== null && _d !== void 0 ? _d : 0);
                        // we should add 16 to move line in between strings and then subtract margins
                        var coordY = currYPos + 16 - ((_f = (_e = lineStyle.margin) === null || _e === void 0 ? void 0 : _e.top) !== null && _f !== void 0 ? _f : 0);
                        page.drawLine({
                            color: lineStyle.color,
                            thickness: lineStyle.thickness,
                            start: { x: startX, y: coordY },
                            end: { x: endX, y: coordY },
                        });
                        currYPos -= ((_h = (_g = lineStyle.margin) === null || _g === void 0 ? void 0 : _g.top) !== null && _h !== void 0 ? _h : 0) + lineStyle.thickness + ((_k = (_j = lineStyle.margin) === null || _j === void 0 ? void 0 : _j.bottom) !== null && _k !== void 0 ? _k : 0);
                    };
                    setPageStyles = function (newStyles) {
                        pageStyles = newStyles;
                    };
                    drawVariableWidthColumns = function (columns, yPosStartOfColumn, startPageIndex) {
                        console.log('drawing variable width columns');
                        if (!columns.length)
                            return;
                        var maxEndXPos = columns.reduce(function (acc, col) {
                            console.log("col.startXPos + col.width: ".concat(col.startXPos, " + ").concat(col.width));
                            var colEndXPos = col.startXPos + col.width;
                            return colEndXPos > acc ? colEndXPos : acc;
                        }, 0);
                        var pageWidth = pageRightBound - pageLeftBound;
                        var DEFAULT_COL_GAP = 15;
                        console.log("maxEndXPos: ".concat(maxEndXPos, ". PageRightBound: ").concat(pageRightBound, ". PageWidth: ").concat(pageWidth));
                        if (maxEndXPos > pageRightBound) {
                            console.warn("Columns and content exceed page width. Will attempt to split into even columns with a ".concat(DEFAULT_COL_GAP, "pt gap"));
                            // determine what equal columns and gaps would be
                            var numGaps = columns.length - 1;
                            var totalGapWidth = numGaps * DEFAULT_COL_GAP;
                            var totalAvailableContentWidth = pageWidth - totalGapWidth;
                            var equalColumnWidth = totalAvailableContentWidth / columns.length;
                            for (var i = 0; i < columns.length; i++) {
                                var newStartingPos = pageLeftBound + (equalColumnWidth + DEFAULT_COL_GAP) * i;
                                columns[i] = __assign(__assign({}, columns[i]), { startXPos: newStartingPos, width: equalColumnWidth });
                            }
                        }
                        var maxPageIndex = currentPageIndex;
                        var minYPos = currYPos;
                        console.log("before columns. maxPageIndex: ".concat(maxPageIndex, ". minYPos: ").concat(minYPos));
                        columns.forEach(function (col, idx) {
                            console.log("\n\n>>>Drawing column ".concat(idx, " for ").concat(JSON.stringify(__assign(__assign({}, col), { textStyle: undefined }))));
                            // if a new page got added on a previous column, we need the next column to go back to the previous page
                            // continue writing, and if that column needs to run onto a new page, it needs to run onto the pre-existing new page
                            console.log("Starting column on page index ".concat(startPageIndex));
                            setPageByIndex(startPageIndex);
                            currentPageIndex = startPageIndex;
                            console.log("yPosStartOfColumn is ".concat(yPosStartOfColumn, ". Current yPos is ").concat(currYPos));
                            console.log("Setting yPos to ".concat(yPosStartOfColumn));
                            currYPos = yPosStartOfColumn;
                            var content = col.content, textStyle = col.textStyle, width = col.width, startXPos = col.startXPos;
                            console.log("This is getY at start of column ".concat(currYPos, " for col ").concat(col.content));
                            drawTextSequential("".concat(content), textStyle, {
                                leftBound: startXPos,
                                rightBound: startXPos + width,
                            });
                            console.log("This is getY at end of column ".concat(currYPos, " for col ").concat(col.content, ". currentPageIndex is ").concat(currentPageIndex));
                            // if a column took us to the top of the next page, we want to track that, because when we're done writing columns, page index and y need to go back there
                            if (maxPageIndex === undefined) {
                                // not sure when this would happen but ok
                                maxPageIndex = currentPageIndex;
                            }
                            else if (currentPageIndex > maxPageIndex) {
                                maxPageIndex = currentPageIndex;
                                minYPos = currYPos;
                            }
                            else if (maxPageIndex === currentPageIndex && currYPos < minYPos) {
                                minYPos = currYPos;
                            }
                        });
                        // set the cursor back to the lowest point we got while drawing columns
                        console.log("Done drawing columns. Setting current page index to ".concat(maxPageIndex, " and currYPos to ").concat(minYPos));
                        setPageByIndex(maxPageIndex);
                        currentPageIndex = maxPageIndex;
                        currYPos = minYPos;
                    };
                    drawLink = function (text, url, style) {
                        var _a = getTextDimensions(text, style), width = _a.width, height = _a.height;
                        var x = currXPos;
                        var y = currYPos;
                        page.drawText(text, {
                            x: x,
                            y: y,
                            size: style.fontSize,
                            font: style.font,
                            color: style.color,
                        });
                        var linkAnnotation = pdfDoc.context.obj({
                            Type: pdf_lib_1.PDFName.of('Annot'),
                            Subtype: pdf_lib_1.PDFName.of('Link'),
                            Rect: pdfDoc.context.obj([pdf_lib_1.PDFNumber.of(x), pdf_lib_1.PDFNumber.of(y), pdf_lib_1.PDFNumber.of(x + width), pdf_lib_1.PDFNumber.of(y + height)]),
                            Border: pdfDoc.context.obj([pdf_lib_1.PDFNumber.of(0), pdf_lib_1.PDFNumber.of(0), pdf_lib_1.PDFNumber.of(0)]),
                            A: pdfDoc.context.obj({
                                Type: pdf_lib_1.PDFName.of('Action'),
                                S: pdf_lib_1.PDFName.of('URI'),
                                URI: pdf_lib_1.PDFString.of(url),
                            }),
                        });
                        var linkRef = pdfDoc.context.register(linkAnnotation);
                        var existingAnnots = page.node.Annots();
                        if (existingAnnots) {
                            existingAnnots.push(linkRef);
                        }
                        else {
                            page.node.set(pdf_lib_1.PDFName.of('Annots'), pdfDoc.context.obj([linkRef]));
                        }
                        currXPos += width;
                        if (style.newLineAfter) {
                            currYPos -= height + style.spacing;
                            currXPos = pageLeftBound;
                        }
                    };
                    getPageTopY = function () {
                        var _a;
                        var height = page.getSize().height;
                        return height - ((_a = pageStyles.pageMargins.top) !== null && _a !== void 0 ? _a : 0) - pdf_consts_1.Y_POS_GAP;
                    };
                    return [2 /*return*/, {
                            addNewPage: addNewPage,
                            drawText: drawText,
                            drawTextSequential: drawTextSequential,
                            drawStartXPosSpecifiedText: drawStartXPosSpecifiedText,
                            drawImage: drawImage,
                            drawLabelValueRow: drawLabelValueRow,
                            newLine: newLine,
                            getX: getX,
                            getY: getY,
                            getPageTopY: getPageTopY,
                            setX: setX,
                            setY: setY,
                            save: save,
                            embedFont: embedFont,
                            embedStandardFont: embedStandardFont,
                            embedImage: embedImage,
                            embedJpg: embedJpg,
                            embedPdfFromBase64: embedPdfFromBase64,
                            embedImageFromBase64: embedImageFromBase64,
                            drawSeparatedLine: drawSeparatedLine,
                            getLeftBound: getLeftBound,
                            getRightBound: getRightBound,
                            setLeftBound: setLeftBound,
                            setRightBound: setRightBound,
                            getTextDimensions: getTextDimensions,
                            setPageStyles: setPageStyles,
                            drawVariableWidthColumns: drawVariableWidthColumns,
                            getCurrentPageIndex: getCurrentPageIndex,
                            setPageByIndex: setPageByIndex,
                            getTotalPages: getTotalPages,
                            drawLink: drawLink,
                            numberPages: numberPages,
                        }];
            }
        });
    });
}
exports.SEPARATED_LINE_STYLE = {
    thickness: 1,
    color: (0, exports.rgbNormalized)(227, 230, 239),
    margin: {
        top: 8,
        bottom: 8,
    },
};
exports.BLACK_LINE_STYLE = __assign(__assign({}, exports.SEPARATED_LINE_STYLE), { color: (0, exports.rgbNormalized)(0, 0, 0) });
var calculateAge = function (dob) {
    var dobDate = new Date(dob);
    var today = new Date();
    var age = today.getFullYear() - dobDate.getFullYear();
    var monthDiff = today.getMonth() - dobDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
        return age - 1;
    }
    return age;
};
exports.calculateAge = calculateAge;
function getPdfLogo() {
    return __awaiter(this, void 0, void 0, function () {
        var url, res, _a, _b, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    url = (0, utils_1.getLogoFor)('pdf');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 5, , 6]);
                    if (!url) {
                        return [2 /*return*/, node_fs_1.default.readFileSync('./assets/logo.png')];
                    }
                    if (!url.startsWith('http')) return [3 /*break*/, 4];
                    return [4 /*yield*/, fetch(url)];
                case 2:
                    res = _c.sent();
                    if (!res.ok) {
                        throw new Error("Failed to fetch logo: ".concat(res.status, " ").concat(res.statusText));
                    }
                    _b = (_a = Buffer).from;
                    return [4 /*yield*/, res.arrayBuffer()];
                case 3: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                case 4: return [2 /*return*/, node_fs_1.default.readFileSync(url)];
                case 5:
                    error_1 = _c.sent();
                    console.warn("Could not load PDF logo from \"".concat(url || './assets/logo.png', "\": ").concat(error_1.message));
                    (0, aws_serverless_1.captureException)(error_1);
                    return [2 /*return*/, undefined];
                case 6: return [2 /*return*/];
            }
        });
    });
}
