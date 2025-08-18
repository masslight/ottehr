"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useExamCardCollapsed = void 0;
var featureFlags_1 = require("../../features/css-module/context/featureFlags");
var exam_cards_store_1 = require("../state/appointment/exam-cards.store");
var useExamCardCollapsed = function (cardName) {
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    /* eslint-disable react-hooks/rules-of-hooks */
    var isCollapsed = css
        ? (0, exam_cards_store_1.useInPersonExamCardsStore)(function (state) { return state[cardName]; })
        : (0, exam_cards_store_1.useExamCardsStore)(function (state) { return state[cardName]; });
    var onSwitch = function () {
        if (css) {
            exam_cards_store_1.useInPersonExamCardsStore.setState(function (prevState) {
                var _a;
                return (_a = {},
                    _a[cardName] = !prevState[cardName],
                    _a);
            });
        }
        else {
            exam_cards_store_1.useExamCardsStore.setState(function (prevState) {
                var _a;
                return (_a = {}, _a[cardName] = !prevState[cardName], _a);
            });
        }
    };
    return [isCollapsed, onSwitch];
};
exports.useExamCardCollapsed = useExamCardCollapsed;
//# sourceMappingURL=useExamCardCollapsed.js.map