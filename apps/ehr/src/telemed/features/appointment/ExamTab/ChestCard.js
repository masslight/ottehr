"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChestCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var ChestCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('chest'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Chest" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('chest')} rightComponent={<components_1.ExamCommentField name="chest-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('chest')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="chest" group="normal"/>,
                Abnormal: <components_1.ExamFieldsFactory card="chest" group="abnormal"/>,
            },
        ]}/>);
};
exports.ChestCard = ChestCard;
//# sourceMappingURL=ChestCard.js.map