"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseOrderEdit = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var InHouseOrderEditBreadcrumbs_1 = require("../components/breadcrumbs/InHouseOrderEditBreadcrumbs");
var MedicationWarnings_1 = require("../components/medication-administration/medication-details/MedicationWarnings");
var EditableMedicationCard_1 = require("../components/medication-administration/medication-editable-card/EditableMedicationCard");
var MedicationHistoryList_1 = require("../components/medication-administration/medication-history/MedicationHistoryList");
var OrderButton_1 = require("../components/medication-administration/OrderButton");
var PageHeader_1 = require("../components/medication-administration/PageHeader");
var useMedicationManagement_1 = require("../hooks/useMedicationManagement");
var InHouseOrderEdit = function () {
    var orderId = (0, react_router_dom_1.useParams)().orderId;
    var medications = (0, useMedicationManagement_1.useMedicationManagement)().medications;
    var scrollToRef = (0, react_1.useRef)(null);
    (0, react_1.useLayoutEffect)(function () {
        var _a;
        (_a = scrollToRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, []);
    var order = medications.find(function (medication) { return medication.id === orderId; });
    return (<>
      <span ref={scrollToRef}/>
      <InHouseOrderEditBreadcrumbs_1.InHouseOrderEditBreadcrumbs />
      <material_1.Box display="flex" justifyContent="space-between" alignItems="center" pl={0.5} mb={2}>
        <PageHeader_1.PageHeader title="Edit Order" variant="h3" component="h1"/>
        <OrderButton_1.OrderButton />
      </material_1.Box>
      <MedicationWarnings_1.MedicationWarnings />
      <EditableMedicationCard_1.EditableMedicationCard medication={order} type="order-edit"/>
      <MedicationHistoryList_1.MedicationHistoryList />
    </>);
};
exports.InHouseOrderEdit = InHouseOrderEdit;
//# sourceMappingURL=InHouseOrderEdit.js.map