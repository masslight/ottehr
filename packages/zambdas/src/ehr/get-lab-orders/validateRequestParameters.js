"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), searchBy = _a.searchBy, orderableItemCode = _a.orderableItemCode, visitDate = _a.visitDate, _b = _a.itemsPerPage, itemsPerPage = _b === void 0 ? utils_1.DEFAULT_LABS_ITEMS_PER_PAGE : _b, _c = _a.pageIndex, pageIndex = _c === void 0 ? 0 : _c;
    if (!searchBy.field || !searchBy.value) {
        throw new Error("Missing searchBy field or value: ".concat(JSON.stringify(searchBy)));
    }
    if (searchBy.field === 'encounterIds' && !Array.isArray(searchBy.value)) {
        throw new Error('Invalid encounterIds. Must be an array');
    }
    if (typeof itemsPerPage !== 'number' || isNaN(itemsPerPage) || itemsPerPage < 1) {
        throw new Error('Invalid parameter: itemsPerPage must be a number greater than 0');
    }
    if (typeof pageIndex !== 'number' || isNaN(pageIndex) || pageIndex < 0) {
        throw new Error('Invalid parameter: pageIndex must be a number greater than or equal to 0');
    }
    return {
        searchBy: searchBy,
        orderableItemCode: orderableItemCode,
        visitDate: visitDate,
        itemsPerPage: itemsPerPage,
        pageIndex: pageIndex,
        secrets: input.secrets,
    };
}
