"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSearchPagination = void 0;
var addSearchPagination = function (url, pagination) {
    var params = [];
    if (pagination.pageSize)
        params.push("_count=".concat(pagination.pageSize));
    if (pagination.offset)
        params.push("_offset=".concat(pagination.offset));
    params.push('_total=accurate');
    return "".concat(url).concat(url.includes('?') ? '&' : '?').concat(params.join('&'));
};
exports.addSearchPagination = addSearchPagination;
//# sourceMappingURL=addSearchPagination.js.map