"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbdomenCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var AbdomenCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('abdomen'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Abdomen" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('abdomen')} rightComponent={<components_1.ExamCommentField name="abdomen-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('abdomen')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="abdomen" group="normal"/>,
                Abnormal: (<>
              <components_1.TenderDropdown />
              <components_1.ExamFieldsFactory card="abdomen" group="abnormal"/>
            </>),
            },
        ]}/>);
};
exports.AbdomenCard = AbdomenCard;
//# sourceMappingURL=AbdomenCard.js.map