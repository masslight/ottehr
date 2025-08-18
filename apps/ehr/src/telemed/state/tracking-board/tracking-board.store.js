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
exports.useTrackingBoardStore = void 0;
var luxon_1 = require("luxon");
var zustand_1 = require("zustand");
var utils_1 = require("../../utils");
var TRACKING_BOARD_INITIAL = {
    appointments: [],
    isAppointmentsLoading: false,
    alignment: 'my-patients',
    date: luxon_1.DateTime.local(),
    selectedStates: null,
    providers: null,
    locationsIds: null,
    groups: null,
    unsignedFor: utils_1.UnsignedFor.under12,
    availableStates: [],
    visitTypes: [],
    showOnlyNext: false,
};
exports.useTrackingBoardStore = (0, zustand_1.create)()(function (set) { return (__assign(__assign({}, TRACKING_BOARD_INITIAL), { setAlignment: function (_, alignment) {
        if (alignment !== null) {
            set(function () { return ({
                alignment: alignment,
            }); });
        }
    }, setAppointments: function (appointments) {
        set(function () { return ({
            appointments: appointments,
        }); });
    } })); });
//# sourceMappingURL=tracking-board.store.js.map