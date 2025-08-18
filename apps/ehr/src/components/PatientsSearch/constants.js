"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLUMN_CONFIG = exports.SEARCH_CONFIG = void 0;
exports.SEARCH_CONFIG = {
    DEFAULT_PAGE_SIZE: 15,
    ROWS_PER_PAGE_OPTIONS: [5, 15, 30, 50],
    DEFAULT_SORT: {
        field: 'name',
        order: 'asc',
    },
};
exports.COLUMN_CONFIG = {
    pid: {
        width: '10%',
    },
    name: {
        width: '15%',
    },
    email: {
        width: '15%',
    },
    dob: {
        width: '10%',
    },
    phone: {
        width: '10%',
    },
    address: {
        width: '20%',
    },
    lastVisit: {
        width: '20%',
    },
};
//# sourceMappingURL=constants.js.map