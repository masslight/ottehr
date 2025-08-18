"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatusColor = void 0;
var getStatusColor = function (status) {
    switch (status) {
        case 'pending':
            return '#E0E0E0';
        case 'received':
            return '#90CAF9';
        case 'prelim':
            return '#A5D6A7';
        case 'sent':
            return '#CE93D8';
        case 'reviewed':
            return '#81C784';
        default:
            return '#E0E0E0';
    }
};
exports.getStatusColor = getStatusColor;
//# sourceMappingURL=labs.helpers.js.map