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
exports.useInPersonExamObservationsStore = exports.IN_PERSON_EXAM_OBSERVATIONS_INITIAL = exports.IN_PERSON_EXAM_OBSERVATIONS_FIELDS = exports.IN_PERSON_EXAM_OBSERVATIONS_CARDS = exports.useExamObservationsStore = exports.EXAM_OBSERVATIONS_INITIAL = exports.EXAM_OBSERVATIONS_FIELDS = exports.EXAM_OBSERVATIONS_CARDS = void 0;
var utils_1 = require("utils");
var zustand_1 = require("zustand");
exports.EXAM_OBSERVATIONS_CARDS = Object.values(utils_1.ExamObservationCardsDetails).reduce(function (previousValue, currentValue) {
    previousValue[currentValue.field] = { field: currentValue.field, note: currentValue.defaultValue };
    return previousValue;
}, {});
exports.EXAM_OBSERVATIONS_FIELDS = Object.values(utils_1.ExamObservationFieldsDetails).reduce(function (previousValue, currentValue) {
    previousValue[currentValue.field] = { field: currentValue.field, value: currentValue.defaultValue };
    return previousValue;
}, {});
exports.EXAM_OBSERVATIONS_INITIAL = __assign(__assign({}, exports.EXAM_OBSERVATIONS_CARDS), exports.EXAM_OBSERVATIONS_FIELDS);
exports.useExamObservationsStore = (0, zustand_1.create)()(function () { return (__assign({}, exports.EXAM_OBSERVATIONS_INITIAL)); });
exports.IN_PERSON_EXAM_OBSERVATIONS_CARDS = Object.values(utils_1.InPersonExamObservationCardsDetails).reduce(function (previousValue, currentValue) {
    previousValue[currentValue.field] = { field: currentValue.field, note: currentValue.defaultValue };
    return previousValue;
}, {});
exports.IN_PERSON_EXAM_OBSERVATIONS_FIELDS = Object.values(utils_1.InPersonExamObservationFieldsDetails).reduce(function (previousValue, currentValue) {
    previousValue[currentValue.field] = { field: currentValue.field, value: currentValue.defaultValue };
    return previousValue;
}, {});
exports.IN_PERSON_EXAM_OBSERVATIONS_INITIAL = __assign(__assign({}, exports.IN_PERSON_EXAM_OBSERVATIONS_CARDS), exports.IN_PERSON_EXAM_OBSERVATIONS_FIELDS);
exports.useInPersonExamObservationsStore = (0, zustand_1.create)()(function () { return (__assign({}, exports.IN_PERSON_EXAM_OBSERVATIONS_INITIAL)); });
//# sourceMappingURL=exam-observations.store.js.map