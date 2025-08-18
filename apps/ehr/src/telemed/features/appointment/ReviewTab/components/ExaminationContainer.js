"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExaminationContainer = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var components_1 = require("../../../../components");
var useExamObservations_1 = require("../../../../hooks/useExamObservations");
var state_1 = require("../../../../state");
var ExamReviewComment_1 = require("./ExamReviewComment");
var ExamReviewGroup_1 = require("./ExamReviewGroup");
var ExaminationContainer = function (props) {
    var noTitle = props.noTitle;
    // const { questionnaireResponse } = getSelectors(useAppointmentStore, ['questionnaireResponse']);
    var examObservations = (0, state_1.useExamObservationsStore)();
    var rashesValues = (0, useExamObservations_1.useExamObservations)(utils_1.rashesFields).value;
    var noRashesItem = utils_1.examObservationFieldsDetailsArray
        .filter(function (details) { return details.card === 'skin' && ['normal', 'abnormal'].includes(details.group); })
        .filter(function (details) { return examObservations[details.field].value; });
    var rashesLabels = utils_1.examObservationFieldsDetailsArray
        .filter(function (details) { return details.card === 'skin' && details.group === 'form'; })
        .filter(function (details) { return examObservations[details.field].value; })
        .map(function (details) { return (0, utils_1.parseRashesFieldToName)(details.field, rashesValues); });
    var abnormalMusculoskeletalLabels = utils_1.examObservationFieldsDetailsArray
        .filter(function (details) { return details.card === 'musculoskeletal' && details.group === 'form'; })
        .filter(function (details) { return examObservations[details.field].value; })
        .map(function (details) { return (0, utils_1.parseMusculoskeletalFieldToName)(details.field); });
    // const vitalsTempC =
    //   getQuestionnaireResponseByLinkId('vitals-temperature', questionnaireResponse)?.answer?.[0]?.valueString || 'N/A';
    // const vitalsTempF = convertTemperature(vitalsTempC, 'fahrenheit');
    // const vitalsTemp = vitalsTempC === 'N/A' ? 'N/A' : `${vitalsTempC}°C / ${vitalsTempF}°F`;
    // const vitalsPulse =
    //   getQuestionnaireResponseByLinkId('vitals-pulse', questionnaireResponse)?.answer?.[0]?.valueString || 'N/A';
    // const vitalsHR =
    //   getQuestionnaireResponseByLinkId('vitals-hr', questionnaireResponse)?.answer?.[0]?.valueString || 'N/A';
    // const vitalsRR =
    //   getQuestionnaireResponseByLinkId('vitals-rr', questionnaireResponse)?.answer?.[0]?.valueString || 'N/A';
    // const vitalsBP =
    //   getQuestionnaireResponseByLinkId('vitals-bp', questionnaireResponse)?.answer?.[0]?.valueString || 'N/A';
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer}>
      {!noTitle && (<material_1.Typography variant="h5" color="primary.dark">
          Examination
        </material_1.Typography>)}

      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/*<Box sx={{ display: 'flex', gap: 4 }}>*/}
        {/*  <AssessmentTitle>Vitals (patient provided):</AssessmentTitle>*/}
        {/*  <Typography>*/}
        {/*    <b>Temp:</b> {vitalsTemp}*/}
        {/*  </Typography>*/}
        {/*  <Typography>*/}
        {/*    <b>Pulse Ox:</b> {vitalsPulse}*/}
        {/*  </Typography>*/}
        {/*  <Typography>*/}
        {/*    <b>HR:</b> {vitalsHR}*/}
        {/*  </Typography>*/}
        {/*  <Typography>*/}
        {/*    <b>RR:</b> {vitalsRR}*/}
        {/*  </Typography>*/}
        {/*  <Typography>*/}
        {/*    <b>BP:</b> {vitalsBP}*/}
        {/*  </Typography>*/}
        {/*</Box>*/}

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="General:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'general' && ['normal', 'abnormal'].includes(details.group); })
            .filter(function (details) { return examObservations[details.field].value; })} extraItems={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'general' && details.group === 'dropdown'; })
            .filter(function (details) { return examObservations[details.field].value; })
            .map(function (details) { return ({ label: "".concat(details.label, " distress"), abnormal: details.abnormal }); })}/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['general-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Head:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'head'; })
            .filter(function (details) { return examObservations[details.field].value; })}/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['head-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Eyes:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'eyes' && ['normal', 'abnormal'].includes(details.group); })
            .filter(function (details) { return examObservations[details.field].value; })}/>

          <ExamReviewGroup_1.ExamReviewGroup label="Right eye:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.group === 'rightEye'; })
            .map(function (details) { return (__assign(__assign({}, details), { value: examObservations[details.field].value })); })} radio/>

          <ExamReviewGroup_1.ExamReviewGroup label="Left eye:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.group === 'leftEye'; })
            .map(function (details) { return (__assign(__assign({}, details), { value: examObservations[details.field].value })); })} radio/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['eyes-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Nose:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'nose' && ['normal', 'abnormal'].includes(details.group); })
            .filter(function (details) { return examObservations[details.field].value; })}/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['nose-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Right ear:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.group === 'rightEar'; })
            .map(function (details) { return (__assign(__assign({}, details), { value: examObservations[details.field].value })); })} radio/>

          <ExamReviewGroup_1.ExamReviewGroup label="Left ear:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.group === 'leftEar'; })
            .map(function (details) { return (__assign(__assign({}, details), { value: examObservations[details.field].value })); })} radio/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['ears-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Mouth:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'mouth'; })
            .filter(function (details) { return examObservations[details.field].value; })}/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['mouth-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Neck:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'neck'; })
            .filter(function (details) { return examObservations[details.field].value; })}/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['neck-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Chest:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'chest'; })
            .filter(function (details) { return examObservations[details.field].value; })}/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['chest-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Back:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'back'; })
            .filter(function (details) { return examObservations[details.field].value; })}/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['back-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Skin:" items={noRashesItem.length ? noRashesItem : [{ label: 'Rashes', abnormal: true }]}/>

          {rashesLabels.length > 0 && <material_1.Typography>{rashesLabels.join(', ')}</material_1.Typography>}

          <ExamReviewComment_1.ExamReviewComment item={examObservations['skin-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Abdomen:" items={utils_1.examObservationFieldsDetailsArray
            .map(function (details) {
            return details.group === 'dropdown' ? __assign(__assign({}, details), { label: "Tender ".concat(details.label) }) : details;
        })
            .filter(function (details) { return details.card === 'abdomen'; })
            .filter(function (details) { return examObservations[details.field].value; })}/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['abdomen-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Extremities/Musculoskeletal:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'musculoskeletal' && ['normal', 'abnormal'].includes(details.group); })
            .filter(function (details) { return examObservations[details.field].value; })} extraItems={abnormalMusculoskeletalLabels.length > 0 ? [{ label: 'Abnormal', abnormal: true }] : undefined}/>

          {abnormalMusculoskeletalLabels.length > 0 && (<material_1.Box sx={{ maxWidth: '400px' }}>
              <components_1.ActionsList data={abnormalMusculoskeletalLabels} getKey={function (value) { return value; }} renderItem={function (value) { return value; }} divider gap={0.5}/>
            </material_1.Box>)}

          <ExamReviewComment_1.ExamReviewComment item={examObservations['extremities-musculoskeletal-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Neurological:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'neurological'; })
            .filter(function (details) { return examObservations[details.field].value; })}/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['neurological-comment']}/>
        </material_1.Box>

        <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <ExamReviewGroup_1.ExamReviewGroup label="Psych:" items={utils_1.examObservationFieldsDetailsArray
            .filter(function (details) { return details.card === 'psych'; })
            .filter(function (details) { return examObservations[details.field].value; })}/>

          <ExamReviewComment_1.ExamReviewComment item={examObservations['psych-comment']}/>
        </material_1.Box>
      </material_1.Box>
    </material_1.Box>);
};
exports.ExaminationContainer = ExaminationContainer;
//# sourceMappingURL=ExaminationContainer.js.map