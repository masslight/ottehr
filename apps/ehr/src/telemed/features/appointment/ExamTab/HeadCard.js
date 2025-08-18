"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeadCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var HeadCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('head'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Head" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('head')} rightComponent={<components_1.ExamCommentField name="head-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('head')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="head" group="normal"/>,
            },
        ]}/>);
};
exports.HeadCard = HeadCard;
//# sourceMappingURL=HeadCard.js.map