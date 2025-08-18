"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MusculoskeletalCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var MusculoskeletalCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('musculoskeletal'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Extremities/Musculoskeletal" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('musculoskeletal')} rightComponent={<components_1.ExamCommentField name="extremities-musculoskeletal-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('musculoskeletal')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="musculoskeletal" group="normal"/>,
                Abnormal: <components_1.MusculoskeletalForm />,
            },
        ]}/>);
};
exports.MusculoskeletalCard = MusculoskeletalCard;
//# sourceMappingURL=MusculoskeletalCard.js.map