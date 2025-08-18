"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkinCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var SkinCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('skin'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Skin" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('skin')} rightComponent={<components_1.ExamCommentField name="skin-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('skin')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="skin" group="normal"/>,
                Abnormal: (<>
              <components_1.RashesForm />
            </>),
            },
        ]}/>);
};
exports.SkinCard = SkinCard;
//# sourceMappingURL=SkinCard.js.map