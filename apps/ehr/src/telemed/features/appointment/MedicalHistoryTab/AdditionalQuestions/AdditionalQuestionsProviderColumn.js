"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdditionalQuestionsProviderColumnSkeleton = exports.AdditionalQuestionsProviderColumn = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var constants_1 = require("../../../../../constants");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var components_1 = require("../components");
var AdditionalQuestionsProviderColumn = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'isChartDataLoading']), chartData = _a.chartData, isChartDataLoading = _a.isChartDataLoading;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
      {constants_1.ADDITIONAL_QUESTIONS.map(function (question, index) {
            var _a, _b;
            var value = (_b = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _a === void 0 ? void 0 : _a.find(function (observation) { return observation.field === question.field; })) === null || _b === void 0 ? void 0 : _b.value;
            return (<react_1.default.Fragment key={question.field}>
            {isReadOnly ? (<components_1.AdditionalQuestionView label={question.label} value={value} isLoading={isChartDataLoading} field={question.field}/>) : (<components_1.AdditionalQuestionEdit label={question.label} field={question.field} value={value} isChartDataLoading={isChartDataLoading}/>)}
            {index < constants_1.ADDITIONAL_QUESTIONS.length - 1 && <material_1.Divider />}
          </react_1.default.Fragment>);
        })}
    </material_1.Box>);
};
exports.AdditionalQuestionsProviderColumn = AdditionalQuestionsProviderColumn;
var AdditionalQuestionsProviderColumnSkeleton = function () {
    return (<material_1.Skeleton variant="rounded" width="100%">
      <material_1.TextField multiline rows={3}/>
    </material_1.Skeleton>);
};
exports.AdditionalQuestionsProviderColumnSkeleton = AdditionalQuestionsProviderColumnSkeleton;
//# sourceMappingURL=AdditionalQuestionsProviderColumn.js.map