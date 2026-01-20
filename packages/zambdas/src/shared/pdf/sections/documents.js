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
exports.createDocumentsSection = exports.extractAttachmentUrls = exports.composeDocumentsData = void 0;
var pdf_consts_1 = require("../pdf-consts");
var IMAGE_GAP = 20;
var composeDocumentsData = function (documents) {
    var photoIdFrontDocumentReference = documents === null || documents === void 0 ? void 0 : documents.find(function (doc) {
        return doc.content.some(function (item) { return item.attachment.title === 'photo-id-front'; });
    });
    var photoIdFront = {
        url: photoIdFrontDocumentReference === null || photoIdFrontDocumentReference === void 0 ? void 0 : photoIdFrontDocumentReference.content[0].attachment.url,
        title: photoIdFrontDocumentReference === null || photoIdFrontDocumentReference === void 0 ? void 0 : photoIdFrontDocumentReference.content[0].attachment.title,
        creation: photoIdFrontDocumentReference === null || photoIdFrontDocumentReference === void 0 ? void 0 : photoIdFrontDocumentReference.date,
        contentType: photoIdFrontDocumentReference === null || photoIdFrontDocumentReference === void 0 ? void 0 : photoIdFrontDocumentReference.content[0].attachment.contentType,
    };
    var photoIdBackDocumentReference = documents === null || documents === void 0 ? void 0 : documents.find(function (doc) {
        return doc.content.some(function (item) { return item.attachment.title === 'photo-id-back'; });
    });
    var photoIdBack = {
        url: photoIdBackDocumentReference === null || photoIdBackDocumentReference === void 0 ? void 0 : photoIdBackDocumentReference.content[0].attachment.url,
        title: photoIdBackDocumentReference === null || photoIdBackDocumentReference === void 0 ? void 0 : photoIdBackDocumentReference.content[0].attachment.title,
        creation: photoIdBackDocumentReference === null || photoIdBackDocumentReference === void 0 ? void 0 : photoIdBackDocumentReference.date,
        contentType: photoIdBackDocumentReference === null || photoIdBackDocumentReference === void 0 ? void 0 : photoIdBackDocumentReference.content[0].attachment.contentType,
    };
    var insuranceCardFrontDocumentReference = documents === null || documents === void 0 ? void 0 : documents.find(function (doc) {
        return doc.content.some(function (item) { return item.attachment.title === 'insurance-card-front'; });
    });
    var insuranceCardFront = {
        url: insuranceCardFrontDocumentReference === null || insuranceCardFrontDocumentReference === void 0 ? void 0 : insuranceCardFrontDocumentReference.content[0].attachment.url,
        title: insuranceCardFrontDocumentReference === null || insuranceCardFrontDocumentReference === void 0 ? void 0 : insuranceCardFrontDocumentReference.content[0].attachment.title,
        creation: insuranceCardFrontDocumentReference === null || insuranceCardFrontDocumentReference === void 0 ? void 0 : insuranceCardFrontDocumentReference.date,
        contentType: insuranceCardFrontDocumentReference === null || insuranceCardFrontDocumentReference === void 0 ? void 0 : insuranceCardFrontDocumentReference.content[0].attachment.contentType,
    };
    var insuranceCardBackDocumentReference = documents === null || documents === void 0 ? void 0 : documents.find(function (doc) {
        return doc.content.some(function (item) { return item.attachment.title === 'insurance-card-back'; });
    });
    var insuranceCardBack = {
        url: insuranceCardBackDocumentReference === null || insuranceCardBackDocumentReference === void 0 ? void 0 : insuranceCardBackDocumentReference.content[0].attachment.url,
        title: insuranceCardBackDocumentReference === null || insuranceCardBackDocumentReference === void 0 ? void 0 : insuranceCardBackDocumentReference.content[0].attachment.title,
        creation: insuranceCardBackDocumentReference === null || insuranceCardBackDocumentReference === void 0 ? void 0 : insuranceCardBackDocumentReference.date,
        contentType: insuranceCardBackDocumentReference === null || insuranceCardBackDocumentReference === void 0 ? void 0 : insuranceCardBackDocumentReference.content[0].attachment.contentType,
    };
    var secondaryInsuranceCardFrontDocumentReference = documents === null || documents === void 0 ? void 0 : documents.find(function (doc) {
        return doc.content.some(function (item) { return item.attachment.title === 'insurance-card-front-2'; });
    });
    var secondaryInsuranceCardFront = {
        url: secondaryInsuranceCardFrontDocumentReference === null || secondaryInsuranceCardFrontDocumentReference === void 0 ? void 0 : secondaryInsuranceCardFrontDocumentReference.content[0].attachment.url,
        title: secondaryInsuranceCardFrontDocumentReference === null || secondaryInsuranceCardFrontDocumentReference === void 0 ? void 0 : secondaryInsuranceCardFrontDocumentReference.content[0].attachment.title,
        creation: secondaryInsuranceCardFrontDocumentReference === null || secondaryInsuranceCardFrontDocumentReference === void 0 ? void 0 : secondaryInsuranceCardFrontDocumentReference.date,
        contentType: secondaryInsuranceCardFrontDocumentReference === null || secondaryInsuranceCardFrontDocumentReference === void 0 ? void 0 : secondaryInsuranceCardFrontDocumentReference.content[0].attachment.contentType,
    };
    var secondaryInsuranceCardBackDocumentReference = documents === null || documents === void 0 ? void 0 : documents.find(function (doc) {
        return doc.content.some(function (item) { return item.attachment.title === 'insurance-card-back-2'; });
    });
    var secondaryInsuranceCardBack = {
        url: secondaryInsuranceCardBackDocumentReference === null || secondaryInsuranceCardBackDocumentReference === void 0 ? void 0 : secondaryInsuranceCardBackDocumentReference.content[0].attachment.url,
        title: secondaryInsuranceCardBackDocumentReference === null || secondaryInsuranceCardBackDocumentReference === void 0 ? void 0 : secondaryInsuranceCardBackDocumentReference.content[0].attachment.title,
        creation: secondaryInsuranceCardBackDocumentReference === null || secondaryInsuranceCardBackDocumentReference === void 0 ? void 0 : secondaryInsuranceCardBackDocumentReference.date,
        contentType: secondaryInsuranceCardBackDocumentReference === null || secondaryInsuranceCardBackDocumentReference === void 0 ? void 0 : secondaryInsuranceCardBackDocumentReference.content[0].attachment.contentType,
    };
    return {
        photoIdFront: photoIdFront,
        photoIdBack: photoIdBack,
        insuranceCardFront: insuranceCardFront,
        insuranceCardBack: insuranceCardBack,
        secondaryInsuranceCardFront: secondaryInsuranceCardFront,
        secondaryInsuranceCardBack: secondaryInsuranceCardBack,
    };
};
exports.composeDocumentsData = composeDocumentsData;
var extractAttachmentUrls = function (documentsData) {
    return Object.values(documentsData)
        .map(function (doc) { return doc.url; })
        .filter(function (url) { return Boolean(url); });
};
exports.extractAttachmentUrls = extractAttachmentUrls;
var createDocumentsSection = function () { return ({
    dataSelector: function (data) { return data.documents; },
    extractImages: function (documents) {
        return Object.entries(documents)
            .filter(function (_a) {
            var _ = _a[0], value = _a[1];
            return !!value.url;
        })
            .map(function (_a) {
            var _ = _a[0], value = _a[1];
            return ({
                url: value.url,
                key: value.title,
            });
        });
    },
    preferredWidth: 'full',
    render: function (client, documents, styles, assets) { return __awaiter(void 0, void 0, void 0, function () {
        var images, getContainSize, drawSection;
        return __generator(this, function (_a) {
            if (!(assets === null || assets === void 0 ? void 0 : assets.images))
                return [2 /*return*/];
            images = assets.images;
            getContainSize = function (origWidth, origHeight, maxWidth, maxHeight) {
                var scale = Math.min(maxWidth / origWidth, maxHeight / origHeight);
                var width = Math.round(origWidth * scale);
                var height = Math.round(origHeight * scale);
                return {
                    width: width,
                    height: height,
                    offsetX: Math.round((maxWidth - width) / 2),
                    offsetY: Math.round((maxHeight - height) / 2),
                };
            };
            drawSection = function (title, frontKey, backKey) {
                var frontDoc = documents[frontKey];
                var backDoc = documents[backKey];
                var hasFront = (frontDoc === null || frontDoc === void 0 ? void 0 : frontDoc.title) && images[frontDoc.title];
                var hasBack = (backDoc === null || backDoc === void 0 ? void 0 : backDoc.title) && images[backDoc.title];
                if (!hasFront && !hasBack)
                    return;
                client.drawText(title, styles.textStyles.regular);
                client.newLine(130);
                var imageWidth = (client.getRightBound() - client.getLeftBound()) / 2 - IMAGE_GAP / 2;
                var imageHeight = Math.round(imageWidth / 2);
                if (hasFront) {
                    var _a = getContainSize(images[frontDoc.title].width, images[frontDoc.title].height, imageWidth, imageHeight), width = _a.width, height = _a.height, offsetX = _a.offsetX, offsetY = _a.offsetY;
                    client.drawImage(images[frontDoc.title], {
                        width: width,
                        height: height,
                        center: false,
                        margin: { top: offsetY, left: offsetX, right: IMAGE_GAP / 2, bottom: 0 },
                    });
                }
                if (hasBack) {
                    var _b = getContainSize(images[backDoc.title].width, images[backDoc.title].height, imageWidth, imageHeight), width = _b.width, height = _b.height, offsetX = _b.offsetX, offsetY = _b.offsetY;
                    client.drawImage(images[backDoc.title], {
                        width: width,
                        height: height,
                        center: false,
                        margin: { top: offsetY, left: IMAGE_GAP / 2 + offsetX, right: 0, bottom: 0 },
                    });
                }
                client.newLine(40);
            };
            client.addNewPage(pdf_consts_1.PDF_CLIENT_STYLES.initialPage);
            drawSection('Primary Insurance Card', 'insuranceCardFront', 'insuranceCardBack');
            drawSection('Secondary Insurance Card', 'secondaryInsuranceCardFront', 'secondaryInsuranceCardBack');
            drawSection('Photo ID', 'photoIdFront', 'photoIdBack');
            return [2 /*return*/];
        });
    }); },
}); };
exports.createDocumentsSection = createDocumentsSection;
