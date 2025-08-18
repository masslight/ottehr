"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Examination = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var telemed_1 = require("../../../telemed");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var appointment_1 = require("../../../telemed/features/appointment");
var ExamReadOnly_1 = require("../components/examination/ExamReadOnly");
var Examination = function () {
    var isReadOnly = (0, telemed_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
      {isReadOnly ? (<ExamReadOnly_1.ExamReadOnly />) : (<material_1.Stack spacing={1}>
          <PageTitle_1.PageTitle label="Examination" showIntakeNotesButton={false}/>
          {utils_1.IN_PERSON_EXAM_CARDS.map(function (card) { return (<appointment_1.CollapsibleExamCardContainer key={card} label={String(card).charAt(0).toUpperCase() + String(card).slice(1)} cardName={card} rightComponent={<appointment_1.ExamCommentField name={"".concat(card, "-comment")}/>} grid={[
                    {
                        Normal: <appointment_1.ExamFieldsFactory card={card} group="normal"/>,
                        Abnormal: <appointment_1.ExamFieldsFactory card={card} group="abnormal"/>,
                    },
                ]}/>); })}
        </material_1.Stack>)}
    </material_1.Box>);
};
exports.Examination = Examination;
//# sourceMappingURL=Examination.js.map