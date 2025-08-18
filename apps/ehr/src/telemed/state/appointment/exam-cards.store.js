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
exports.useInPersonExamCardsStore = exports.IN_PERSON_EXAM_CARDS_INITIAL = exports.useExamCardsStore = exports.EXAM_CARDS_INITIAL = void 0;
var zustand_1 = require("zustand");
exports.EXAM_CARDS_INITIAL = {
    vitals: true,
    general: false,
    head: false,
    eyes: false,
    nose: true,
    ears: true,
    mouth: true,
    neck: true,
    chest: false,
    back: true,
    skin: false,
    abdomen: true,
    musculoskeletal: false,
    neurological: false,
    psych: true,
};
exports.useExamCardsStore = (0, zustand_1.create)()(function () { return (__assign({}, exports.EXAM_CARDS_INITIAL)); });
exports.IN_PERSON_EXAM_CARDS_INITIAL = {
    general: false,
    skin: false,
    hair: false,
    nails: false,
    head: false,
    eyes: false,
    ears: false,
    nose: false,
    mouth: false,
    teeth: false,
    pharynx: false,
    neck: false,
    heart: false,
    lungs: false,
    abdomen: false,
    back: false,
    rectal: false,
    extremities: false,
    musculoskeletal: false,
    neurologic: false,
    psychiatric: false,
};
exports.useInPersonExamCardsStore = (0, zustand_1.create)()(function () { return (__assign({}, exports.IN_PERSON_EXAM_CARDS_INITIAL)); });
//# sourceMappingURL=exam-cards.store.js.map