"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EarsCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var EarsCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('ears'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Ears" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('ears')} rightComponent={<components_1.ExamCommentField name="ears-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('ears')}/>} grid={[
            {
                'Right ear': <components_1.ExamFieldsFactory card="ears" group="rightEar" radio/>,
                'Left ear': <components_1.ExamFieldsFactory card="ears" group="leftEar" radio/>,
            },
        ]}/>);
};
exports.EarsCard = EarsCard;
//# sourceMappingURL=EarsCard.js.map