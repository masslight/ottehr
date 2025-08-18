"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanTab = void 0;
var material_1 = require("@mui/material");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var DispositionCard_1 = require("./DispositionCard");
var ERxCard_1 = require("./ERxCard");
var HealthwiseDocumentsCard_1 = require("./HealthwiseDocumentsCard");
var PatientInstructionsCard_1 = require("./PatientInstructionsCard");
var SchoolWorkExcuseCard_1 = require("./SchoolWorkExcuseCard");
var PlanTab = function () {
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    if (isChartDataLoading) {
        return (<material_1.Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <material_1.CircularProgress />
      </material_1.Box>);
    }
    // 1656: temporarily hide HealthwiseDocuments section
    var tmpHideHealthwiseDocuments = true;
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
      <ERxCard_1.ERxCard />
      <PatientInstructionsCard_1.PatientInstructionsCard />
      {tmpHideHealthwiseDocuments ? <></> : <HealthwiseDocumentsCard_1.HealthwiseDocumentsCard />}
      <DispositionCard_1.DispositionCard />
      <SchoolWorkExcuseCard_1.SchoolWorkExcuseCard />
    </material_1.Box>);
};
exports.PlanTab = PlanTab;
//# sourceMappingURL=PlanTab.js.map