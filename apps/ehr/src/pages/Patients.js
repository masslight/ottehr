"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PatientsPage;
var material_1 = require("@mui/material");
var PatientSearch_1 = require("../components/PatientsSearch/PatientSearch");
var PageContainer_1 = require("../layout/PageContainer");
function PatientsPage() {
    return (<PageContainer_1.default>
      <material_1.Box sx={{ px: 3 }}>
        <PatientSearch_1.PatientSearch />
      </material_1.Box>
    </PageContainer_1.default>);
}
//# sourceMappingURL=Patients.js.map