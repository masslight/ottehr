"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.structureQuestionnaireResponse = void 0;
var lodash_1 = require("lodash");
var utils_1 = require("utils");
var containedItemWithLinkId = function (item, linkId) {
    // note: if item.linkId === linkId, return item
    var itemLinkId = item.linkId, subItems = item.item;
    if (itemLinkId === linkId)
        return item;
    if (!subItems)
        return undefined;
    return subItems.find(function (subItem) { return containedItemWithLinkId(subItem, linkId); });
};
var structureQuestionnaireResponse = function (questionnaire, formValues, patientId) {
    var _a;
    var pageDict = new Map();
    var itemInput = (_a = questionnaire.item) !== null && _a !== void 0 ? _a : [];
    var qItems = (0, utils_1.mapQuestionnaireAndValueSetsToItemsList)(lodash_1.default.cloneDeep(itemInput), []);
    qItems.forEach(function (item) {
        pageDict.set(item.linkId, []);
    });
    Object.entries(formValues).forEach(function (_a) {
        var key = _a[0], value = _a[1];
        var parentItem = qItems === null || qItems === void 0 ? void 0 : qItems.find(function (item) { return containedItemWithLinkId(item, key); });
        if (parentItem) {
            var pageItems = pageDict.get(parentItem.linkId);
            var qItem = containedItemWithLinkId(parentItem, key);
            if (pageItems && qItem) {
                var answer = value != undefined ? (0, utils_1.makeQRResponseItem)(value, qItem) : undefined;
                if (answer) {
                    pageItems.push(answer);
                    pageDict.set(parentItem.linkId, pageItems);
                }
                else {
                    pageItems.push({ linkId: key });
                    pageDict.set(parentItem.linkId, pageItems);
                }
            }
        }
    });
    var qrItem = Array.from(pageDict.entries())
        .map(function (_a) {
        var linkId = _a[0], items = _a[1];
        var item = {
            linkId: linkId,
            item: items,
        };
        return item;
    })
        .filter(function (i) { var _a; return Boolean((_a = i.item) === null || _a === void 0 ? void 0 : _a.length); });
    return {
        resourceType: 'QuestionnaireResponse',
        questionnaire: "".concat(questionnaire.url, "|").concat(questionnaire.version),
        status: 'completed',
        subject: { reference: "Patient/".concat(patientId) },
        item: qrItem,
    };
};
exports.structureQuestionnaireResponse = structureQuestionnaireResponse;
//# sourceMappingURL=qr-structure.js.map