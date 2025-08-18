"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoseCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var NoseCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('nose'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Nose" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('nose')} rightComponent={<components_1.ExamCommentField name="nose-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('nose')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="nose" group="normal"/>,
                Abnormal: <components_1.ExamFieldsFactory card="nose" group="abnormal"/>,
            },
        ]}/>);
};
exports.NoseCard = NoseCard;
//# sourceMappingURL=NoseCard.js.map