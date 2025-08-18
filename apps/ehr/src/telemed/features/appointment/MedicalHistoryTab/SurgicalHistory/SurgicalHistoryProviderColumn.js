"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurgicalHistoryProviderColumn = void 0;
var material_1 = require("@mui/material");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var featureFlags_1 = require("../../../../../features/css-module/context/featureFlags");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var components_1 = require("../../../../components");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var ProceduresForm_1 = require("./ProceduresForm");
var ProceduresNoteField_1 = require("./ProceduresNoteField");
var SurgicalHistoryProviderColumn = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['isChartDataLoading', 'chartData']), isChartDataLoading = _a.isChartDataLoading, chartData = _a.chartData;
    var procedures = (chartData === null || chartData === void 0 ? void 0 : chartData.surgicalHistory) || [];
    var cssColumnFeatureFlag = (0, featureFlags_1.useFeatureFlags)();
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {isReadOnly ? (<>
          <components_1.ActionsList data={procedures} getKey={function (value) { return value.resourceId; }} renderItem={function (value) { return (<material_1.Typography>
                {value.code} {value.display}
              </material_1.Typography>); }} divider/>
          {!cssColumnFeatureFlag.css && <ProceduresNoteField_1.ProceduresNoteField />}
        </>) : (<material_1.Box data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryColumn} sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
            }}>
          <ProceduresForm_1.ProceduresForm />
          {isChartDataLoading ? <ProceduresNoteField_1.ProceduresNoteFieldSkeleton /> : !cssColumnFeatureFlag.css && <ProceduresNoteField_1.ProceduresNoteField />}
        </material_1.Box>)}
    </material_1.Box>);
};
exports.SurgicalHistoryProviderColumn = SurgicalHistoryProviderColumn;
//# sourceMappingURL=SurgicalHistoryProviderColumn.js.map