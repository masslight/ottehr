"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdditionalQuestionsContainer = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var constants_1 = require("../../../../../constants");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var AssessmentTab_1 = require("../../AssessmentTab");
var AdditionalQuestionsContainer = function (_a) {
    var _b, _c, _d;
    var notes = _a.notes;
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var seenInLastThreeYearsObs = (_b = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _b === void 0 ? void 0 : _b.find(function (obs) { return obs.field === utils_1.SEEN_IN_LAST_THREE_YEARS_FIELD; });
    var historyObtainedFromObs = (_c = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _c === void 0 ? void 0 : _c.find(function (obs) { return obs.field === utils_1.HISTORY_OBTAINED_FROM_FIELD; });
    var currentASQObs = (_d = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _d === void 0 ? void 0 : _d.find(function (obs) { return obs.field === utils_1.ASQ_FIELD; });
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        Additional questions
      </material_1.Typography>
      {constants_1.ADDITIONAL_QUESTIONS.map(function (question, index) {
            var _a, _b;
            var value = (0, utils_1.convertBooleanToString)((_b = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _a === void 0 ? void 0 : _a.find(function (observation) { return observation.field === question.field; })) === null || _b === void 0 ? void 0 : _b.value);
            return value && value.length > 0 ? (<material_1.Box data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabAdditionalQuestion(question.field)}>
            <material_1.Typography key={index}>{"".concat(question.label, " - ").concat(value)}</material_1.Typography>
          </material_1.Box>) : null;
        })}

      {seenInLastThreeYearsObs && (<material_1.Typography>{"".concat(utils_1.SEEN_IN_LAST_THREE_YEARS_LABEL, " - ").concat(utils_1.recentVisitLabels[seenInLastThreeYearsObs.value])}</material_1.Typography>)}

      {historyObtainedFromObs && (<material_1.Typography>
          {"History obtained from - ".concat(utils_1.historySourceLabels[historyObtainedFromObs.value])}
          {historyObtainedFromObs.value === utils_1.HistorySourceKeys.NotObtainedOther
                ? ": ".concat(historyObtainedFromObs.note)
                : ''}
        </material_1.Typography>)}

      {currentASQObs && <material_1.Typography>{"ASQ - ".concat(utils_1.asqLabels[currentASQObs.value])}</material_1.Typography>}

      {notes && notes.length > 0 && (<>
          <AssessmentTab_1.AssessmentTitle>Screening notes</AssessmentTab_1.AssessmentTitle>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes === null || notes === void 0 ? void 0 : notes.map(function (note) { return <material_1.Typography key={note.resourceId}>{note.text}</material_1.Typography>; })}
          </material_1.Box>
        </>)}
    </material_1.Box>);
};
exports.AdditionalQuestionsContainer = AdditionalQuestionsContainer;
//# sourceMappingURL=AdditionalQuestionsContainer.js.map