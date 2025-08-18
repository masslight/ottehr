"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AOECard = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var AccordionCard_1 = require("../../../telemed/components/AccordionCard");
var AOEQuestion_1 = require("./AOEQuestion");
var AOECard = function (_a) {
    var questions = _a.questions, labQuestionnaireResponses = _a.labQuestionnaireResponses, isReadOnly = _a.isReadOnly, _b = _a.isCollapsed, isCollapsed = _b === void 0 ? false : _b;
    var _c = (0, react_1.useState)(isCollapsed), collapsed = _c[0], setCollapsed = _c[1];
    var _d = (0, react_1.useState)(false), isLoading = _d[0], _setLoading = _d[1];
    return (<>
      <AccordionCard_1.AccordionCard label={!labQuestionnaireResponses ? 'AOE Questions' : 'AOE Answers'} collapsed={collapsed} withBorder={false} onSwitch={function () {
            setCollapsed(function (prevState) { return !prevState; });
        }}>
        {isLoading ? (<material_1.CircularProgress />) : (<material_1.Paper sx={{ p: 3 }}>
            <material_1.Grid container sx={{ width: '100%' }} spacing={1}>
              {(questions === null || questions === void 0 ? void 0 : questions.length) ? (questions.map(function (question, index) {
                var _a;
                return (<AOEQuestion_1.AOEQuestion key={index} question={question} isReadOnly={isReadOnly} answer={(_a = labQuestionnaireResponses === null || labQuestionnaireResponses === void 0 ? void 0 : labQuestionnaireResponses.find(function (response) { return response.linkId === question.linkId; })) === null || _a === void 0 ? void 0 : _a.response}/>);
            })) : (<material_1.Typography>No questions</material_1.Typography>)}
            </material_1.Grid>
          </material_1.Paper>)}
      </AccordionCard_1.AccordionCard>
    </>);
};
exports.AOECard = AOECard;
//# sourceMappingURL=AOECard.js.map