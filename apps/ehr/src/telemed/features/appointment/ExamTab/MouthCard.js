"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MouthCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var MouthCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('mouth'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Mouth" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('mouth')} rightComponent={<components_1.ExamCommentField name="mouth-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('mouth')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="mouth" group="normal"/>,
                Abnormal: <components_1.ExamFieldsFactory card="mouth" group="abnormal"/>,
            },
        ]}/>);
};
exports.MouthCard = MouthCard;
//# sourceMappingURL=MouthCard.js.map