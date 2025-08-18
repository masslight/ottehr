"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamReadOnlyBlock = exports.ExamReadOnly = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var telemed_1 = require("../../../../telemed");
var ReviewTab_1 = require("../../../../telemed/features/appointment/ReviewTab");
var ExamReadOnly = function () {
    return (<telemed_1.AccordionCard label="Examination">
      <material_1.Box sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
        <exports.ExamReadOnlyBlock />
      </material_1.Box>
    </telemed_1.AccordionCard>);
};
exports.ExamReadOnly = ExamReadOnly;
var ExamReadOnlyBlock = function () {
    var examObservations = (0, telemed_1.useInPersonExamObservationsStore)();
    return (<>
      {utils_1.IN_PERSON_EXAM_CARDS.map(function (card) { return (<react_1.default.Fragment key={card}>
          <ReviewTab_1.ExamReviewGroup label={"".concat(String(card).charAt(0).toUpperCase() + String(card).slice(1), ":")} items={utils_1.inPersonExamObservationFieldsDetailsArray
                .filter(function (details) { return details.card === card; })
                .filter(function (details) { return examObservations[details.field].value; })}/>

          <ReviewTab_1.ExamReviewComment item={examObservations["".concat(card, "-comment")]}/>
        </react_1.default.Fragment>); })}
    </>);
};
exports.ExamReadOnlyBlock = ExamReadOnlyBlock;
//# sourceMappingURL=ExamReadOnly.js.map