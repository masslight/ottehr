"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AddPatientFollowup;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var useGetPatient_1 = require("../../hooks/useGetPatient");
var PageContainer_1 = require("../../layout/PageContainer");
var CustomBreadcrumbs_1 = require("../CustomBreadcrumbs");
var PatientFollowupForm_1 = require("./PatientFollowupForm");
function AddPatientFollowup() {
    var id = (0, react_router_dom_1.useParams)().id;
    var patient = (0, useGetPatient_1.useGetPatient)(id).patient;
    var fullName = patient ? (0, utils_1.getFullName)(patient) : '';
    return (<PageContainer_1.default>
      <material_1.Grid container direction="row">
        <material_1.Grid item xs={3.5}/>
        <material_1.Grid item xs={5}>
          {!patient ? (<material_1.Box sx={{ justifyContent: 'left' }}>
              <material_1.CircularProgress />
            </material_1.Box>) : (<>
              <CustomBreadcrumbs_1.default chain={[
                { link: '/patients', children: 'Patients' },
                {
                    link: "/patient/".concat(id),
                    children: fullName,
                },
                {
                    link: '#',
                    children: 'Add Patient Follow-up',
                },
            ]}/>
              <material_1.Typography variant="h3" marginTop={1} color={'primary.dark'}>
                Add Patient Follow-up
              </material_1.Typography>
              <PatientFollowupForm_1.default patient={patient} followupStatus="NEW"></PatientFollowupForm_1.default>
            </>)}
        </material_1.Grid>
        <material_1.Grid item xs={3.5}/>
      </material_1.Grid>
    </PageContainer_1.default>);
}
//# sourceMappingURL=AddPatientFollowup.js.map