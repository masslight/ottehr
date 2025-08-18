"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeckCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var NeckCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('neck'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Neck" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('neck')} rightComponent={<components_1.ExamCommentField name="neck-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('neck')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="neck" group="normal"/>,
            },
        ]}/>);
};
exports.NeckCard = NeckCard;
//# sourceMappingURL=NeckCard.js.map