"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssessmentCard = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var featureFlags_1 = require("../../../../features/css-module/context/featureFlags");
var useChartData_1 = require("../../../../features/css-module/hooks/useChartData");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var components_1 = require("../../../components");
var PageTitle_1 = require("../../../components/PageTitle");
var hooks_1 = require("../../../hooks");
var state_1 = require("../../../state");
var AiPotentialDiagnosesCard_1 = require("./AiPotentialDiagnosesCard");
var components_2 = require("./components");
var AssessmentCard = function () {
    var encounter = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['encounter']).encounter;
    var chartData = (0, useChartData_1.useChartData)({
        encounterId: encounter.id || '',
        requestedFields: { cptCodes: {} },
        replaceStoreValues: true,
    }).chartData;
    // const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var emCode = chartData === null || chartData === void 0 ? void 0 : chartData.emCode;
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    return (<material_1.Stack spacing={1}>
      <PageTitle_1.PageTitle label="Assessment" showIntakeNotesButton={false}/>
      <AiPotentialDiagnosesCard_1.AiPotentialDiagnosesCard />
      <components_1.AccordionCard label={css ? undefined : 'Assessment'}>
        <components_1.DoubleColumnContainer divider leftColumn={<material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <components_2.DiagnosesContainer />
              {css && <components_2.MedicalDecisionContainer />}
            </material_1.Box>} rightColumn={<material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!css && <components_2.MedicalDecisionContainer />}
              {css ? (<components_2.BillingCodesContainer />) : (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <components_2.AssessmentTitle>E&M code</components_2.AssessmentTitle>
                  {isReadOnly ? (emCode ? (<material_1.Typography>{emCode.display}</material_1.Typography>) : (<material_1.Typography color="secondary.light">Not provided</material_1.Typography>)) : (<components_2.EMCodeField />)}
                </material_1.Box>)}
            </material_1.Box>}/>
      </components_1.AccordionCard>
    </material_1.Stack>);
};
exports.AssessmentCard = AssessmentCard;
//# sourceMappingURL=AssessmentCard.js.map