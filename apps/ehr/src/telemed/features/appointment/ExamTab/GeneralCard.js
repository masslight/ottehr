"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneralCard = void 0;
var material_1 = require("@mui/material");
var data_test_ids_1 = require("../../../../constants/data-test-ids");
var useExamCardCollapsed_1 = require("../../../hooks/useExamCardCollapsed");
var components_1 = require("./components");
var GeneralCard = function () {
    var _a = (0, useExamCardCollapsed_1.useExamCardCollapsed)('general'), isCollapsed = _a[0], onSwitch = _a[1];
    return (<material_1.Box>
      <components_1.ExamCardContainer label="General" collapsed={isCollapsed} onSwitch={onSwitch} dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCards('general')} rightComponent={<components_1.ExamCommentField name="general-comment" dataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabCardsComments('general')}/>} grid={[
            {
                Normal: <components_1.ExamFieldsFactory card="general" group="normal"/>,
                Abnormal: (<>
                <components_1.ExamFieldsFactory card="general" group="abnormal"/>
                <components_1.DistressDropdown />
              </>),
            },
        ]}/>
    </material_1.Box>);
};
exports.GeneralCard = GeneralCard;
//# sourceMappingURL=GeneralCard.js.map