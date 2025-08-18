"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseOrderNew = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var InHouseOrderNewBreadcrumbs_1 = require("../components/breadcrumbs/InHouseOrderNewBreadcrumbs");
var InfoAlert_1 = require("../components/InfoAlert");
var MedicationWarnings_1 = require("../components/medication-administration/medication-details/MedicationWarnings");
var EditableMedicationCard_1 = require("../components/medication-administration/medication-editable-card/EditableMedicationCard");
var MedicationHistoryList_1 = require("../components/medication-administration/medication-history/MedicationHistoryList");
var PageHeader_1 = require("../components/medication-administration/PageHeader");
var InHouseOrderNew = function () {
    var scrollToRef = (0, react_1.useRef)(null);
    (0, react_1.useLayoutEffect)(function () {
        var _a;
        (_a = scrollToRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, []);
    return (<material_1.Stack spacing={2}>
      <span ref={scrollToRef}/>
      <InHouseOrderNewBreadcrumbs_1.InHouseOrderNewBreadcrumbs />
      <PageHeader_1.PageHeader title="Order Medication" variant="h3" component="h1"/>
      <InfoAlert_1.InfoAlert text="Make sure an AssociatedDx is selected first in the Assessment menu item."/>
      <MedicationWarnings_1.MedicationWarnings />
      <EditableMedicationCard_1.EditableMedicationCard type="order-new"/>
      <MedicationHistoryList_1.MedicationHistoryList />
    </material_1.Stack>);
};
exports.InHouseOrderNew = InHouseOrderNew;
//# sourceMappingURL=InHouseOrderNew.js.map