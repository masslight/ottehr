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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useClaimsQueueStore = void 0;
var zustand_1 = require("zustand");
var CLAIMS_QUEUE_INITIAL = {
    patient: undefined,
    visitId: undefined,
    claimId: undefined,
    teamMember: undefined,
    queue: undefined,
    dayInQueue: undefined,
    status: undefined,
    state: undefined,
    facilityGroup: undefined,
    facility: undefined,
    insurance: undefined,
    balance: undefined,
    dosFrom: undefined,
    dosTo: undefined,
    offset: 0,
    pageSize: 25,
    selectedRows: [],
    employees: [],
    organizations: [],
    facilities: [],
    insurancePlans: [],
    items: [],
};
exports.useClaimsQueueStore = (0, zustand_1.create)()(function () { return (__assign({}, CLAIMS_QUEUE_INITIAL)); });
//# sourceMappingURL=claims-queue.store.js.map