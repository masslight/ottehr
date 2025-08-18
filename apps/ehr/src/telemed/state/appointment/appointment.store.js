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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAppointmentStore = void 0;
var zustand_1 = require("zustand");
var APPOINTMENT_INITIAL = {
    appointment: undefined,
    patient: undefined,
    location: undefined,
    locationVirtual: undefined,
    practitioner: undefined,
    encounter: {},
    questionnaireResponse: undefined,
    patientPhotoUrls: [],
    schoolWorkNoteUrls: [],
    isAppointmentLoading: false,
    isChartDataLoading: false,
    chartData: undefined,
    currentTab: 'hpi',
    reviewAndSignData: undefined,
};
exports.useAppointmentStore = (0, zustand_1.create)()(function (set) { return (__assign(__assign({}, APPOINTMENT_INITIAL), { setPartialChartData: function (data) {
        set(function (state) {
            var _a;
            return ({
                chartData: __assign(__assign(__assign({}, state.chartData), { patientId: ((_a = state.chartData) === null || _a === void 0 ? void 0 : _a.patientId) || '' }), data),
            });
        });
    }, updateObservation: function (newObservation) {
        return set(function (state) {
            var _a;
            var currentObservations = ((_a = state.chartData) === null || _a === void 0 ? void 0 : _a.observations) || [];
            var updatedObservations = __spreadArray([], currentObservations, true);
            var existingObservationIndex = updatedObservations.findIndex(function (observation) { return observation.field === newObservation.field; });
            var updatedObservation = __assign({}, updatedObservations[existingObservationIndex]);
            if (existingObservationIndex !== -1 && 'value' in newObservation) {
                if (!('note' in newObservation) && 'note' in updatedObservation)
                    delete updatedObservation.note;
                updatedObservations[existingObservationIndex] = __assign(__assign(__assign({}, updatedObservation), { value: newObservation.value }), ('note' in newObservation && { note: newObservation.note }));
            }
            else {
                updatedObservations.push(newObservation);
            }
            return {
                chartData: __assign(__assign({}, state.chartData), { observations: updatedObservations }),
            };
        });
    } })); });
//# sourceMappingURL=appointment.store.js.map