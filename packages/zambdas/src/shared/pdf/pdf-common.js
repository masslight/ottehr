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
exports.createConfiguredSection = exports.fieldFilter = exports.createSectionConfig = exports.generatePdf = void 0;
var node_fs_1 = require("node:fs");
var utils_1 = require("utils");
var presigned_file_urls_1 = require("../presigned-file-urls");
var pdf_consts_1 = require("./pdf-consts");
var pdf_utils_1 = require("./pdf-utils");
var createImageLoader = function (token) { return ({
    loadImage: function (url) { return __awaiter(void 0, void 0, void 0, function () {
        var presignedUrl, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Loading image from: ".concat(url));
                    return [4 /*yield*/, (0, utils_1.getPresignedURL)(url, token)];
                case 1:
                    presignedUrl = _a.sent();
                    return [4 /*yield*/, fetch(presignedUrl)];
                case 2:
                    res = _a.sent();
                    return [4 /*yield*/, res.arrayBuffer()];
                case 3: return [2 /*return*/, _a.sent()];
            }
        });
    }); },
    embedImage: function (client, imageData, url) { return __awaiter(void 0, void 0, void 0, function () {
        var urlLower, isPng, isJpeg, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    urlLower = url.toLowerCase();
                    isPng = urlLower.endsWith('.png');
                    isJpeg = urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg');
                    if (!isPng) return [3 /*break*/, 2];
                    console.log("Embedding PNG image from ".concat(url));
                    return [4 /*yield*/, client.embedImage(Buffer.from(imageData))];
                case 1: return [2 /*return*/, _b.sent()];
                case 2:
                    if (!isJpeg) return [3 /*break*/, 4];
                    console.log("Embedding JPEG image from ".concat(url));
                    return [4 /*yield*/, client.embedJpg(Buffer.from(imageData))];
                case 3: return [2 /*return*/, _b.sent()];
                case 4:
                    console.warn("Unknown image extension for ".concat(url, ", attempting JPEG"));
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 7, , 9]);
                    return [4 /*yield*/, client.embedJpg(Buffer.from(imageData))];
                case 6: return [2 /*return*/, _b.sent()];
                case 7:
                    _a = _b.sent();
                    console.warn("Failed as JPEG, trying PNG for ".concat(url));
                    return [4 /*yield*/, client.embedImage(Buffer.from(imageData))];
                case 8: return [2 /*return*/, _b.sent()];
                case 9: return [2 /*return*/];
            }
        });
    }); },
}); };
var collectImageReferences = function (data, sections) {
    var imageRefs = [];
    for (var _i = 0, sections_1 = sections; _i < sections_1.length; _i++) {
        var section = sections_1[_i];
        var sectionData = section.dataSelector(data);
        if (!sectionData)
            continue;
        if (section.extractImages) {
            var refs = section.extractImages(sectionData);
            imageRefs.push.apply(imageRefs, refs);
        }
    }
    return imageRefs;
};
var loadAndEmbedImages = function (imageRefs, pdfClient, imageLoader) { return __awaiter(void 0, void 0, void 0, function () {
    var images, uniqueRefs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                images = {};
                uniqueRefs = Array.from(new Map(imageRefs.map(function (ref) { return [ref.key, ref]; })).values());
                console.log("Loading ".concat(uniqueRefs.length, " unique images..."));
                return [4 /*yield*/, Promise.all(uniqueRefs.map(function (ref) { return __awaiter(void 0, void 0, void 0, function () {
                        var imageData, embeddedImage, error_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 3, , 4]);
                                    return [4 /*yield*/, imageLoader.loadImage(ref.url)];
                                case 1:
                                    imageData = _a.sent();
                                    return [4 /*yield*/, imageLoader.embedImage(pdfClient, imageData, ref.url)];
                                case 2:
                                    embeddedImage = _a.sent();
                                    images[ref.key] = embeddedImage;
                                    console.log("Successfully loaded image: ".concat(ref.key));
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_1 = _a.sent();
                                    console.error("Failed to load image ".concat(ref.key, " from ").concat(ref.url, ":"), error_1);
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); }))];
            case 1:
                _a.sent();
                console.log("Loaded ".concat(Object.keys(images).length, " images successfully"));
                return [2 /*return*/, images];
        }
    });
}); };
var renderPdfHeader = function (pdfClient, data, config, styles, assets) {
    var headerStartY = pdfClient.getY();
    var pageWidth = pdfClient.getRightBound() - pdfClient.getLeftBound();
    var columnWidth = pageWidth / 2;
    var leftX = pdfClient.getLeftBound();
    var rightX = leftX + columnWidth;
    var leftHeight = 0;
    var rightHeight = 0;
    var originalLeft = pdfClient.getLeftBound();
    var originalRight = pdfClient.getRightBound();
    pdfClient.setLeftBound(rightX + 10);
    pdfClient.setRightBound(originalRight);
    pdfClient.drawText(config.title, styles.textStyles.header);
    if (config.rightSection) {
        var rightData = config.rightSection.dataSelector(data);
        if (rightData !== undefined) {
            var shouldRender = config.rightSection.shouldRender ? config.rightSection.shouldRender(rightData) : true;
            if (shouldRender) {
                var rightAlignedStyles = createRightAlignedStyles(styles);
                config.rightSection.render(pdfClient, rightData, rightAlignedStyles, assets);
            }
        }
    }
    rightHeight = headerStartY - pdfClient.getY();
    if (config.leftSection) {
        var leftData = config.leftSection.dataSelector(data);
        if (leftData !== undefined) {
            var shouldRender = config.leftSection.shouldRender ? config.leftSection.shouldRender(leftData) : true;
            if (shouldRender) {
                pdfClient.setLeftBound(leftX);
                pdfClient.setRightBound(leftX + columnWidth - 10);
                pdfClient.setY(headerStartY);
                config.leftSection.render(pdfClient, leftData, styles, assets);
                leftHeight = headerStartY - pdfClient.getY();
            }
        }
    }
    pdfClient.setLeftBound(originalLeft);
    pdfClient.setRightBound(originalRight);
    var maxHeight = Math.max(leftHeight, rightHeight);
    pdfClient.setY(headerStartY - maxHeight);
    pdfClient.drawSeparatedLine(styles.lineStyles.separator);
};
var createRightAlignedStyles = function (styles) {
    var rightAlignedTextStyles = {};
    for (var _i = 0, _a = Object.entries(styles.textStyles); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], style = _b[1];
        rightAlignedTextStyles[key] = __assign(__assign({}, style), { side: 'right' });
    }
    return __assign(__assign({}, styles), { textStyles: rightAlignedTextStyles });
};
var renderPdf = function (data, config, token) { return __awaiter(void 0, void 0, void 0, function () {
    var pdfClient, baseAssets, allSections, imageRefs, images, imageLoader, assets, styles;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, pdf_utils_1.createPdfClient)(pdf_consts_1.PDF_CLIENT_STYLES)];
            case 1:
                pdfClient = _a.sent();
                return [4 /*yield*/, loadPdfAssets(pdfClient, config.assetPaths)];
            case 2:
                baseAssets = _a.sent();
                allSections = __spreadArray(__spreadArray(__spreadArray([], (config.header.leftSection ? [config.header.leftSection] : []), true), (config.header.rightSection ? [config.header.rightSection] : []), true), config.sections, true);
                imageRefs = collectImageReferences(data, allSections);
                images = {};
                if (!(imageRefs.length > 0 && token)) return [3 /*break*/, 4];
                console.log("Found ".concat(imageRefs.length, " images to load"));
                imageLoader = createImageLoader(token);
                return [4 /*yield*/, loadAndEmbedImages(imageRefs, pdfClient, imageLoader)];
            case 3:
                images = _a.sent();
                _a.label = 4;
            case 4:
                assets = __assign(__assign({}, baseAssets), { images: images });
                styles = config.styleFactory(assets);
                renderPdfHeader(pdfClient, data, config.header, styles, assets);
                renderBodySections(pdfClient, data, config.sections, styles, assets);
                return [4 /*yield*/, pdfClient.save()];
            case 5: return [2 /*return*/, _a.sent()];
        }
    });
}); };
var renderBodySections = function (pdfClient, data, sections, styles, assets) {
    var originalLeft = pdfClient.getLeftBound();
    var originalRight = pdfClient.getRightBound();
    var pageWidth = originalRight - originalLeft;
    var columnWidth = pageWidth / 2;
    var currentColumn = 'left';
    var leftColumnY = pdfClient.getY();
    var rightColumnY = pdfClient.getY();
    var leftColumnPage = pdfClient.getCurrentPageIndex();
    var rightColumnPage = pdfClient.getCurrentPageIndex();
    for (var _i = 0, sections_2 = sections; _i < sections_2.length; _i++) {
        var section = sections_2[_i];
        var sectionData = section.dataSelector(data);
        if (sectionData === undefined)
            continue;
        if (section.shouldRender && !section.shouldRender(sectionData)) {
            continue;
        }
        var layout = section.preferredWidth || 'full';
        if (layout === 'full') {
            var maxPage_1 = Math.max(leftColumnPage, rightColumnPage);
            pdfClient.setPageByIndex(maxPage_1);
            var targetY = void 0;
            if (leftColumnPage === rightColumnPage) {
                targetY = Math.max(leftColumnY, rightColumnY);
            }
            else if (leftColumnPage > rightColumnPage) {
                targetY = leftColumnY;
            }
            else {
                targetY = rightColumnY;
            }
            pdfClient.setY(targetY);
            pdfClient.setLeftBound(originalLeft);
            pdfClient.setRightBound(originalRight);
            if (section.title) {
                pdfClient.drawText(section.title, styles.textStyles.subHeader);
            }
            section.render(pdfClient, sectionData, styles, assets);
            leftColumnY = pdfClient.getY();
            rightColumnY = pdfClient.getY();
            leftColumnPage = pdfClient.getCurrentPageIndex();
            rightColumnPage = pdfClient.getCurrentPageIndex();
            currentColumn = 'left';
        }
        else if (layout === 'column') {
            if (currentColumn === 'left') {
                pdfClient.setPageByIndex(leftColumnPage);
                pdfClient.setLeftBound(originalLeft);
                pdfClient.setRightBound(originalLeft + columnWidth - 10);
                pdfClient.setY(leftColumnY);
                if (section.title) {
                    pdfClient.drawText(section.title, styles.textStyles.subHeader);
                }
                section.render(pdfClient, sectionData, styles, assets);
                var newLeftColumnPage = pdfClient.getCurrentPageIndex();
                leftColumnY = pdfClient.getY();
                if (newLeftColumnPage > leftColumnPage) {
                    rightColumnPage = newLeftColumnPage;
                    pdfClient.setPageByIndex(rightColumnPage);
                    rightColumnY = pdfClient.getPageTopY();
                }
                leftColumnPage = newLeftColumnPage;
                currentColumn = 'right';
            }
            else {
                pdfClient.setPageByIndex(rightColumnPage);
                pdfClient.setLeftBound(originalLeft + columnWidth + 10);
                pdfClient.setRightBound(originalRight);
                pdfClient.setY(rightColumnY);
                if (section.title) {
                    pdfClient.drawText(section.title, styles.textStyles.subHeader);
                }
                section.render(pdfClient, sectionData, styles, assets);
                var newRightColumnPage = pdfClient.getCurrentPageIndex();
                rightColumnY = pdfClient.getY();
                if (newRightColumnPage > rightColumnPage) {
                    leftColumnPage = newRightColumnPage;
                    pdfClient.setPageByIndex(leftColumnPage);
                    leftColumnY = pdfClient.getPageTopY();
                }
                rightColumnPage = newRightColumnPage;
                currentColumn = 'left';
            }
        }
    }
    pdfClient.setLeftBound(originalLeft);
    pdfClient.setRightBound(originalRight);
    var maxPage = Math.max(leftColumnPage, rightColumnPage);
    pdfClient.setPageByIndex(maxPage);
    var finalY;
    if (leftColumnPage === rightColumnPage) {
        finalY = Math.max(leftColumnY, rightColumnY);
    }
    else if (leftColumnPage > rightColumnPage) {
        finalY = leftColumnY;
    }
    else {
        finalY = rightColumnY;
    }
    pdfClient.setY(finalY);
};
var loadPdfAssets = function (pdfClient, paths) { return __awaiter(void 0, void 0, void 0, function () {
    var fonts, icons, _i, _a, _b, key, path, _c, _d, _e, _f, _g, key, path, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                fonts = {};
                if (!paths.fonts) return [3 /*break*/, 4];
                _i = 0, _a = Object.entries(paths.fonts);
                _k.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                _b = _a[_i], key = _b[0], path = _b[1];
                _c = fonts;
                _d = key;
                return [4 /*yield*/, pdfClient.embedFont(node_fs_1.default.readFileSync(path))];
            case 2:
                _c[_d] = _k.sent();
                _k.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4:
                if (!paths.icons) return [3 /*break*/, 8];
                icons = {};
                _e = 0, _f = Object.entries(paths.icons);
                _k.label = 5;
            case 5:
                if (!(_e < _f.length)) return [3 /*break*/, 8];
                _g = _f[_e], key = _g[0], path = _g[1];
                _h = icons;
                _j = key;
                return [4 /*yield*/, pdfClient.embedImage(node_fs_1.default.readFileSync(path))];
            case 6:
                _h[_j] = _k.sent();
                _k.label = 7;
            case 7:
                _e++;
                return [3 /*break*/, 5];
            case 8: return [2 /*return*/, { fonts: fonts, icons: icons }];
        }
    });
}); };
var uploadPdfToStorage = function (pdfBytes, metadata, secrets, token) { return __awaiter(void 0, void 0, void 0, function () {
    var patientId, fileName, bucketName, baseFileUrl;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                patientId = metadata.patientId, fileName = metadata.fileName, bucketName = metadata.bucketName;
                baseFileUrl = (0, presigned_file_urls_1.makeZ3Url)({
                    secrets: secrets,
                    fileName: fileName,
                    bucketName: bucketName,
                    patientID: patientId,
                });
                return [4 /*yield*/, (0, utils_1.uploadPDF)(pdfBytes, baseFileUrl, token, patientId)];
            case 1:
                _a.sent();
                return [2 /*return*/, { title: fileName, uploadURL: baseFileUrl }];
        }
    });
}); };
var generatePdf = function (input, composer, renderConfig, uploadMetadata, secrets, token) { return __awaiter(void 0, void 0, void 0, function () {
    var data, pdfBytes, pdfInfo;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                console.log('Composing PDF data...');
                data = composer(input);
                console.log('Rendering PDF...');
                return [4 /*yield*/, renderPdf(data, renderConfig, token)];
            case 1:
                pdfBytes = _a.sent();
                console.log('Uploading PDF...');
                return [4 /*yield*/, uploadPdfToStorage(pdfBytes, uploadMetadata, secrets, token)];
            case 2:
                pdfInfo = _a.sent();
                return [2 /*return*/, { pdfInfo: pdfInfo, attached: data.attachmentDocRefs }];
        }
    });
}); };
exports.generatePdf = generatePdf;
var createSectionConfig = function (configKey) {
    var _a;
    var section = utils_1.PATIENT_RECORD_CONFIG.FormFields[configKey];
    var isHidden = Array.isArray(section.linkId)
        ? utils_1.PATIENT_RECORD_CONFIG.hiddenFormSections.some(function (hiddenSection) { return section.linkId.includes(hiddenSection); })
        : utils_1.PATIENT_RECORD_CONFIG.hiddenFormSections.includes(section.linkId);
    return {
        configKey: configKey,
        isHidden: isHidden,
        hiddenFields: new Set((_a = section.hiddenFields) !== null && _a !== void 0 ? _a : []),
    };
};
exports.createSectionConfig = createSectionConfig;
var fieldFilter = function (config) {
    return function (fieldKey) {
        return !config.hiddenFields.has(fieldKey);
    };
};
exports.fieldFilter = fieldFilter;
var createConfiguredSection = function (configKey, sectionFactory) {
    var config = (0, exports.createSectionConfig)(configKey);
    var shouldShow = (0, exports.fieldFilter)(config);
    var section = sectionFactory(shouldShow);
    return __assign(__assign({}, section), { skip: config.isHidden });
};
exports.createConfiguredSection = createConfiguredSection;
