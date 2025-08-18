"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetailsWithResults = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var PageTitle_1 = require("../../../../telemed/components/PageTitle");
var OrderCollection_1 = require("../OrderCollection");
var ResultItem_1 = require("./ResultItem");
var DetailsWithResults = function (_a) {
    var labOrder = _a.labOrder, markTaskAsReviewed = _a.markTaskAsReviewed, loading = _a.loading;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var handleBack = function () {
        navigate(-1);
    };
    return (<>
      <PageTitle_1.CSSPageTitle>{labOrder.testItem}</PageTitle_1.CSSPageTitle>

      <material_1.Typography variant="body1" sx={{ fontWeight: 'medium' }}>
        {labOrder.diagnoses}
      </material_1.Typography>

      {labOrder.resultsDetails.map(function (result, idx) { return (<ResultItem_1.ResultItem key={"result-detail-".concat(idx, "-").concat(result.diagnosticReportId)} onMarkAsReviewed={function () {
                return markTaskAsReviewed({
                    taskId: result.taskId,
                    serviceRequestId: labOrder.serviceRequestId,
                    diagnosticReportId: result.diagnosticReportId,
                    appointmentId: labOrder.appointmentId,
                });
            }} resultDetails={result} labOrder={labOrder} loading={loading}/>); })}

      <OrderCollection_1.OrderCollection showActionButtons={false} showOrderInfo={false} isAOECollapsed={true} labOrder={labOrder}/>

      <material_1.Button variant="outlined" color="primary" sx={{
            borderRadius: 28,
            padding: '8px 22px',
            alignSelf: 'flex-start',
            marginTop: 2,
            textTransform: 'none',
        }} onClick={handleBack}>
        Back
      </material_1.Button>
    </>);
};
exports.DetailsWithResults = DetailsWithResults;
//# sourceMappingURL=DetailsWithResults.js.map