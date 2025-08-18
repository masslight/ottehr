"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultItem = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var ExternalLabsStatusChip_1 = require("../ExternalLabsStatusChip");
var FinalCardView_1 = require("./FinalCardView");
var PrelimCardView_1 = require("./PrelimCardView");
var ResultItem = function (_a) {
    var onMarkAsReviewed = _a.onMarkAsReviewed, labOrder = _a.labOrder, resultDetails = _a.resultDetails, loading = _a.loading;
    var theme = (0, material_1.useTheme)();
    return (<>
      <material_1.Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1,
        }}>
        <material_1.Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexDirection: 'row',
            fontWeight: 'bold',
            color: theme.palette.primary.dark,
        }}>
          <span>{resultDetails.testType}:</span>
          <span>{resultDetails.testItem}</span>
        </material_1.Box>
        <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: 'row' }}>
          {labOrder.isPSC && (<material_1.Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mr: 1 }}>
              {utils_1.PSC_LOCALE}
            </material_1.Typography>)}
          <ExternalLabsStatusChip_1.LabsOrderStatusChip status={resultDetails.labStatus}/>
        </material_1.Box>
      </material_1.Box>

      {(resultDetails.resultType === 'final' || resultDetails.resultType === 'cancelled') && (<FinalCardView_1.FinalCardView resultPdfUrl={resultDetails.resultPdfUrl} labStatus={resultDetails.labStatus} onMarkAsReviewed={onMarkAsReviewed} loading={loading}/>)}

      {resultDetails.resultType === 'preliminary' && (<PrelimCardView_1.PrelimCardView resultPdfUrl={resultDetails.resultPdfUrl} receivedDate={resultDetails.receivedDate} reviewedDate={resultDetails.reviewedDate} onPrelimView={function () { return onMarkAsReviewed(); }} // todo: add open PDF when task will be ready
         timezone={labOrder.encounterTimezone}/>)}
    </>);
};
exports.ResultItem = ResultItem;
//# sourceMappingURL=ResultItem.js.map