"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PsychCard = void 0;
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var PsychCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('psych'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<components_1.ExamCardContainer label="Psych" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('psych')} rightComponent={<components_1.ExamCommentField name="psych-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('psych')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="psych" group="normal"/>,
                Abnormal: <components_1.ExamFieldsFactory card="psych" group="abnormal"/>,
            },
        ]}/>);
};
exports.PsychCard = PsychCard;
//# sourceMappingURL=PsychCard.js.map