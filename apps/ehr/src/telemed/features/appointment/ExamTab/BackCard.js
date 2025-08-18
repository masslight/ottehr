"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var BackCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('back'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Back" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('back')} rightComponent={<components_1.ExamCommentField name="back-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('back')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="back" group="normal"/>,
                Abnormal: <components_1.ExamFieldsFactory card="back" group="abnormal"/>,
            },
        ]}/>);
};
exports.BackCard = BackCard;
//# sourceMappingURL=BackCard.js.map