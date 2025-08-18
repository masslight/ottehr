"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeurologicalCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var NeurologicalCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('neurological'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Neurological" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('neurological')} rightComponent={<components_1.ExamCommentField name="neurological-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('neurological')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="neurological" group="normal"/>,
            },
        ]}/>);
};
exports.NeurologicalCard = NeurologicalCard;
//# sourceMappingURL=NeurologicalCard.js.map