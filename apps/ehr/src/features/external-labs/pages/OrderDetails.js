"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderDetailsPage = void 0;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var DetailPageContainer_1 = require("src/features/common/DetailPageContainer");
var DetailsWithoutResults_1 = require("../components/details/DetailsWithoutResults");
var DetailsWithResults_1 = require("../components/details/DetailsWithResults");
var LabBreadcrumbs_1 = require("../components/labs-orders/LabBreadcrumbs");
var LabOrderLoading_1 = require("../components/labs-orders/LabOrderLoading");
var usePatientLabOrders_1 = require("../components/labs-orders/usePatientLabOrders");
var OrderDetailsPage = function () {
    var urlParams = (0, react_router_dom_1.useParams)();
    var serviceRequestId = urlParams.serviceRequestID;
    var _a = (0, usePatientLabOrders_1.usePatientLabOrders)({
        searchBy: { field: 'serviceRequestId', value: serviceRequestId },
    }), labOrders = _a.labOrders, loading = _a.loading, markTaskAsReviewed = _a.markTaskAsReviewed;
    // todo: validate response on the get-lab-orders zambda and use labOrder[0]
    var labOrder = labOrders.find(function (order) { return order.serviceRequestId === serviceRequestId; });
    var status = labOrder === null || labOrder === void 0 ? void 0 : labOrder.orderStatus;
    if (loading) {
        return <LabOrderLoading_1.LabOrderLoading />;
    }
    if (!labOrder) {
        console.error('No external lab order found');
        return null;
    }
    var pageName = "".concat(labOrder.testItem).concat(labOrder.reflexResultsCount > 0 ? ' + Reflex' : '');
    if (status === 'pending' || (status === null || status === void 0 ? void 0 : status.includes('sent'))) {
        return (<DetailPageContainer_1.default>
        <LabBreadcrumbs_1.LabBreadcrumbs sectionName={pageName}>
          <DetailsWithoutResults_1.DetailsWithoutResults labOrder={labOrder}/>
        </LabBreadcrumbs_1.LabBreadcrumbs>
      </DetailPageContainer_1.default>);
    }
    return (<DetailPageContainer_1.default>
      <LabBreadcrumbs_1.LabBreadcrumbs sectionName={pageName}>
        <DetailsWithResults_1.DetailsWithResults labOrder={labOrder} markTaskAsReviewed={markTaskAsReviewed} loading={loading}/>
      </LabBreadcrumbs_1.LabBreadcrumbs>
    </DetailPageContainer_1.default>);
};
exports.OrderDetailsPage = OrderDetailsPage;
//# sourceMappingURL=OrderDetails.js.map