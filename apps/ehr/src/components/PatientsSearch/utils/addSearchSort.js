"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSearchSort = void 0;
var addSearchSort = function (url, options) {
    var params = [];
    var sortField = '';
    switch (options.field) {
        case 'name':
            sortField = 'family,given';
            break;
        case 'dob':
            sortField = 'birthdate';
            break;
        default:
            sortField = 'family,given';
    }
    if (options.order === 'desc')
        sortField = '-' + sortField;
    params.push("_sort=".concat(sortField, ",_id"));
    return "".concat(url).concat(url.includes('?') ? '&' : '?').concat(params.join('&'));
};
exports.addSearchSort = addSearchSort;
//# sourceMappingURL=addSearchSort.js.map