"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientInHouseLabsTab = void 0;
var material_1 = require("@mui/material");
var InHouseLabsTable_1 = require("../features/in-house-labs/components/orders/InHouseLabsTable");
var patientLabOrdersColumns = [
    'testType',
    'visit',
    'orderAdded',
    'provider',
    'dx',
    'resultsReceived',
    'status',
];
var PatientInHouseLabsTab = function (_a) {
    var patientId = _a.patientId, titleText = _a.titleText;
    return (<material_1.Box sx={{ mt: 2 }}>
      <InHouseLabsTable_1.InHouseLabsTable searchBy={{ searchBy: { field: 'patientId', value: patientId } }} columns={patientLabOrdersColumns} showFilters={true} allowDelete={false} titleText={titleText}/>
    </material_1.Box>);
};
exports.PatientInHouseLabsTab = PatientInHouseLabsTab;
//# sourceMappingURL=PatientInHouseLabsTab.js.map