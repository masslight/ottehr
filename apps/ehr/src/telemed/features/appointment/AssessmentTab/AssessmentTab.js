"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssessmentTab = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var AssessmentCard_1 = require("./AssessmentCard");
var AssessmentTab = function () {
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    if (isChartDataLoading) {
        return (<material_1.Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <material_1.CircularProgress />
      </material_1.Box>);
    }
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
      <AssessmentCard_1.AssessmentCard />
    </material_1.Box>);
};
exports.AssessmentTab = AssessmentTab;
//# sourceMappingURL=AssessmentTab.js.map