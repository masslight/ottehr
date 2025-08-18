"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientRadiologyTab = void 0;
var material_1 = require("@mui/material");
var RadiologyTable_1 = require("src/features/radiology/components/RadiologyTable");
var columns = ['studyType', 'dx', 'ordered', 'status'];
var PatientRadiologyTab = function (_a) {
    var patientId = _a.patientId;
    return (<material_1.Box sx={{ mt: 2 }}>
      <RadiologyTable_1.RadiologyTable patientId={patientId} columns={columns} showFilters={true} allowDelete={false} titleText="Radiology"/>
    </material_1.Box>);
};
exports.PatientRadiologyTab = PatientRadiologyTab;
//# sourceMappingURL=PatientRadiologyTab.js.map