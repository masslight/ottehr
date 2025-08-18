"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdditionalQuestionsPatientColumn = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var constants_1 = require("../../../../../constants");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var components_1 = require("../components");
var AdditionalQuestionsPatientColumn = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'questionnaireResponse',
        'isAppointmentLoading',
    ]), questionnaireResponse = _a.questionnaireResponse, isAppointmentLoading = _a.isAppointmentLoading;
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
      {constants_1.ADDITIONAL_QUESTIONS.map(function (question, index) {
            var _a, _b, _c;
            var value = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)(question.field, questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString;
            return (<react_1.default.Fragment key={question.field}>
            <components_1.AdditionalQuestionView label={question.label} value={(0, utils_1.convertToBoolean)(value)} isLoading={isAppointmentLoading} field={question.field}/>
            {index < constants_1.ADDITIONAL_QUESTIONS.length - 1 && <material_1.Divider />}
          </react_1.default.Fragment>);
        })}
    </material_1.Box>);
};
exports.AdditionalQuestionsPatientColumn = AdditionalQuestionsPatientColumn;
//# sourceMappingURL=AdditionalQuestionsPatientColumn.js.map