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
exports.ImageType = void 0;
exports.createDocument = createDocument;
var utils_1 = require("utils");
var shared_1 = require("../../shared");
var ImageType;
(function (ImageType) {
    ImageType[ImageType["JPG"] = 0] = "JPG";
    ImageType[ImageType["PNG"] = 1] = "PNG";
})(ImageType || (exports.ImageType = ImageType = {}));
function createDocument(questionnaireResponse, appointment, oystehr, schedule, location) {
    return __awaiter(this, void 0, void 0, function () {
        var canonicalUrl, _a, url, version, questionnaire, _b, subjectType, subjectId, patient, type, timezone, _c, _d, date, _e, time, locationName;
        var _f, _g, _h, _j, _k, _l, _m;
        return __generator(this, function (_o) {
            switch (_o.label) {
                case 0:
                    canonicalUrl = (0, shared_1.assertDefined)(questionnaireResponse.questionnaire, 'questionnaireResponse.questionnaire');
                    _a = canonicalUrl.split('|'), url = _a[0], version = _a[1];
                    if (!url || !version) {
                        throw new Error("Invalid canonical URL format: ".concat(canonicalUrl, ". Expected format: \"url|version\""));
                    }
                    return [4 /*yield*/, (0, utils_1.getCanonicalQuestionnaire)({ url: url, version: version }, oystehr)];
                case 1:
                    questionnaire = _o.sent();
                    _b = ((_g = (_f = questionnaireResponse.subject) === null || _f === void 0 ? void 0 : _f.reference) !== null && _g !== void 0 ? _g : '').split('/'), subjectType = _b[0], subjectId = _b[1];
                    if (subjectType !== 'Patient') {
                        throw new Error("Only \"Patient\" subject is supported but was \"".concat(subjectType, "\""));
                    }
                    return [4 /*yield*/, oystehr.fhir.get({
                            resourceType: 'Patient',
                            id: subjectId,
                        })];
                case 2:
                    patient = _o.sent();
                    type = (0, utils_1.getAppointmentType)(appointment).type;
                    timezone = (0, shared_1.resolveTimezone)(schedule, location);
                    _c = (_h = (0, utils_1.formatDateToMDYWithTime)(appointment === null || appointment === void 0 ? void 0 : appointment.start, timezone !== null && timezone !== void 0 ? timezone : 'America/New_York')) !== null && _h !== void 0 ? _h : {}, _d = _c.date, date = _d === void 0 ? '' : _d, _e = _c.time, time = _e === void 0 ? '' : _e;
                    locationName = (_j = location === null || location === void 0 ? void 0 : location.name) !== null && _j !== void 0 ? _j : '';
                    return [2 /*return*/, {
                            patientInfo: {
                                name: ((_k = patient.name) === null || _k === void 0 ? void 0 : _k[0].family) + ', ' + ((_l = patient.name) === null || _l === void 0 ? void 0 : _l[0].given),
                                id: (_m = patient.id) !== null && _m !== void 0 ? _m : '',
                            },
                            visitInfo: {
                                type: type,
                                time: time,
                                date: date,
                                location: locationName,
                            },
                            sections: createSections(questionnaireResponse, questionnaire),
                            imageItems: createImageItems(questionnaireResponse, questionnaire, oystehr),
                        }];
            }
        });
    });
}
function findQuestionnaireItem(linkId, items) {
    if (!items)
        return undefined;
    for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
        var it = items_1[_i];
        if (!it)
            continue;
        if (it.linkId === linkId)
            return it;
        var found = findQuestionnaireItem(linkId, it.item);
        if (found)
            return found;
    }
    return undefined;
}
function createSections(questionnaireResponse, questionnaire) {
    var _a;
    function extractAnswerValue(answerItem) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        var v = (_j = (_g = (_f = (_e = (_d = (_c = (_b = (_a = answerItem === null || answerItem === void 0 ? void 0 : answerItem.valueString) !== null && _a !== void 0 ? _a : answerItem === null || answerItem === void 0 ? void 0 : answerItem.valueBoolean) !== null && _b !== void 0 ? _b : answerItem === null || answerItem === void 0 ? void 0 : answerItem.valueDecimal) !== null && _c !== void 0 ? _c : answerItem === null || answerItem === void 0 ? void 0 : answerItem.valueInteger) !== null && _d !== void 0 ? _d : answerItem === null || answerItem === void 0 ? void 0 : answerItem.valueDate) !== null && _e !== void 0 ? _e : answerItem === null || answerItem === void 0 ? void 0 : answerItem.valueTime) !== null && _f !== void 0 ? _f : answerItem === null || answerItem === void 0 ? void 0 : answerItem.valueDateTime) !== null && _g !== void 0 ? _g : (_h = answerItem === null || answerItem === void 0 ? void 0 : answerItem.valueQuantity) === null || _h === void 0 ? void 0 : _h.value) !== null && _j !== void 0 ? _j : (_k = answerItem === null || answerItem === void 0 ? void 0 : answerItem.valueReference) === null || _k === void 0 ? void 0 : _k.display;
        if (v == null)
            return null;
        return v.toString();
    }
    function collectItems(questionnaireResponseItems, parentQuestionnaireItems, groupName) {
        var _a;
        var collected = [];
        if (!questionnaireResponseItems)
            return collected;
        for (var _i = 0, questionnaireResponseItems_1 = questionnaireResponseItems; _i < questionnaireResponseItems_1.length; _i++) {
            var questionnaireResponseItem = questionnaireResponseItems_1[_i];
            if (!questionnaireResponseItem)
                continue;
            var questionnaireItem = findQuestionnaireItem(questionnaireResponseItem.linkId, parentQuestionnaireItems);
            if (!questionnaireItem) {
                questionnaireItem = findQuestionnaireItem(questionnaireResponseItem.linkId, questionnaire.item);
            }
            var questionText = questionnaireItem === null || questionnaireItem === void 0 ? void 0 : questionnaireItem.text;
            if (questionnaireResponseItem.answer && questionnaireResponseItem.answer.length > 0) {
                var answers = questionnaireResponseItem.answer
                    .flatMap(function (answer) {
                    var value = extractAnswerValue(answer);
                    return value == null ? [] : [value];
                })
                    .join();
                if (questionText && answers.length > 0) {
                    var item = { question: questionText, answer: answers };
                    if (groupName) {
                        item.group = groupName;
                    }
                    collected.push(item);
                }
            }
            if (questionnaireResponseItem.item && questionnaireResponseItem.item.length > 0) {
                var nextParentQItems = (_a = questionnaireItem === null || questionnaireItem === void 0 ? void 0 : questionnaireItem.item) !== null && _a !== void 0 ? _a : parentQuestionnaireItems;
                var childItems = collectItems(questionnaireResponseItem.item, nextParentQItems, questionText);
                collected.push.apply(collected, childItems);
            }
        }
        return collected;
    }
    return ((_a = questionnaireResponse.item) !== null && _a !== void 0 ? _a : []).flatMap(function (sectionItem) {
        var _a, _b;
        var sectionDef = findQuestionnaireItem(sectionItem.linkId, questionnaire.item);
        var title = (_a = sectionDef === null || sectionDef === void 0 ? void 0 : sectionDef.text) !== null && _a !== void 0 ? _a : sectionItem.linkId;
        var items = collectItems(sectionItem.item, (_b = sectionDef === null || sectionDef === void 0 ? void 0 : sectionDef.item) !== null && _b !== void 0 ? _b : questionnaire.item);
        if (!title || items.length === 0) {
            return [];
        }
        return {
            title: title,
            items: items,
        };
    });
}
function createImageItems(questionnaireResponse, questionnaire, oystehr) {
    var collected = [];
    collectImageItems(questionnaireResponse.item, questionnaire.item, oystehr, collected, questionnaire);
    return collected;
}
function collectImageItems(responseItems, parentQuestionnaireItems, oystehr, collected, questionnaire) {
    var _a, _b, _c, _d;
    if (!responseItems)
        return;
    for (var _i = 0, responseItems_1 = responseItems; _i < responseItems_1.length; _i++) {
        var item = responseItems_1[_i];
        var questionnaireItem = findQuestionnaireItem(item.linkId, parentQuestionnaireItems !== null && parentQuestionnaireItems !== void 0 ? parentQuestionnaireItems : questionnaire.item);
        var title = questionnaireItem === null || questionnaireItem === void 0 ? void 0 : questionnaireItem.text;
        var attachment = (_b = (_a = item.answer) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.valueAttachment;
        if ((attachment === null || attachment === void 0 ? void 0 : attachment.url) && (attachment === null || attachment === void 0 ? void 0 : attachment.contentType)) {
            var imageType = void 0;
            if (attachment.contentType === 'image/jpeg')
                imageType = ImageType.JPG;
            if (attachment.contentType === 'image/png')
                imageType = ImageType.PNG;
            if (imageType) {
                collected.push({
                    title: (_c = title !== null && title !== void 0 ? title : attachment.title) !== null && _c !== void 0 ? _c : item.linkId,
                    imageType: imageType,
                    imageBytes: downloadImage(attachment.url, oystehr),
                });
            }
        }
        if (item.item && item.item.length > 0) {
            collectImageItems(item.item, (_d = questionnaireItem === null || questionnaireItem === void 0 ? void 0 : questionnaireItem.item) !== null && _d !== void 0 ? _d : parentQuestionnaireItems, oystehr, collected, questionnaire);
        }
    }
}
function downloadImage(url, oystehr) {
    return __awaiter(this, void 0, void 0, function () {
        var pathTokens;
        return __generator(this, function (_a) {
            pathTokens = url.substring(url.indexOf('/z3/') + 4).split('/');
            return [2 /*return*/, oystehr.z3.downloadFile({
                    bucketName: pathTokens[0],
                    'objectPath+': pathTokens.slice(1).join('/'),
                })];
        });
    });
}
