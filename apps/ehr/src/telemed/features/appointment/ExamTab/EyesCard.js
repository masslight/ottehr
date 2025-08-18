"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EyesCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var EyesCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('eyes'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Eyes" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('eyes')} rightComponent={<components_1.ExamCommentField name="eyes-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('eyes')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="eyes" group="normal"/>,
                Abnormal: <components_1.ExamFieldsFactory card="eyes" group="abnormal"/>,
            },
            {
                'Right eye': <components_1.ExamFieldsFactory card="eyes" group="rightEye" radio/>,
                'Left eye': <components_1.ExamFieldsFactory card="eyes" group="leftEye" radio/>,
            },
        ]}/>);
};
exports.EyesCard = EyesCard;
//# sourceMappingURL=EyesCard.js.map