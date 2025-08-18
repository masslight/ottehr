"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientLabsTab = void 0;
var material_1 = require("@mui/material");
var LabsTable_1 = require("../features/external-labs/components/labs-orders/LabsTable");
var patientLabOrdersColumns = [
    'testType',
    'visit',
    'orderAdded',
    'provider',
    'dx',
    'resultsReceived',
    'accessionNumber',
    'status',
    'psc',
];
var PatientLabsTab = function (_a) {
    var patientId = _a.patientId;
    return (<material_1.Box sx={{ mt: 2 }}>
      <LabsTable_1.LabsTable searchBy={{ searchBy: { field: 'patientId', value: patientId } }} columns={patientLabOrdersColumns} showFilters={true} allowDelete={false} titleText="Labs"/>
    </material_1.Box>);
};
exports.PatientLabsTab = PatientLabsTab;
//# sourceMappingURL=PatientLabsTab.js.map