"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PatientPage;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var PatientInHouseLabsTab_1 = require("src/components/PatientInHouseLabsTab");
var PatientRadiologyTab_1 = require("src/components/PatientRadiologyTab");
var utils_1 = require("utils");
var CustomBreadcrumbs_1 = require("../components/CustomBreadcrumbs");
var patient_1 = require("../components/patient");
var PatientFollowupEncountersGrid_1 = require("../components/patient/PatientFollowupEncountersGrid");
var PatientEncountersGrid_1 = require("../components/PatientEncountersGrid");
var PatientLabsTab_1 = require("../components/PatientLabsTab");
var RoundedButton_1 = require("../components/RoundedButton");
var data_test_ids_1 = require("../constants/data-test-ids");
var feature_flags_1 = require("../constants/feature-flags");
var useGetPatient_1 = require("../hooks/useGetPatient");
var PageContainer_1 = require("../layout/PageContainer");
function PatientPage() {
    var _a;
    var id = (0, react_router_dom_1.useParams)().id;
    var location = (0, react_router_dom_1.useLocation)();
    var _b = (0, react_1.useState)(((_a = location.state) === null || _a === void 0 ? void 0 : _a.defaultTab) || 'encounters'), tab = _b[0], setTab = _b[1];
    var _c = (0, useGetPatient_1.useGetPatient)(id), appointments = _c.appointments, loading = _c.loading, patient = _c.patient;
    var _d = (0, react_1.useMemo)(function () {
        if (!patient)
            return {};
        return {
            firstName: (0, utils_1.getFirstName)(patient),
            lastName: (0, utils_1.getLastName)(patient),
        };
    }, [patient]), firstName = _d.firstName, lastName = _d.lastName;
    var latestAppointment = appointments === null || appointments === void 0 ? void 0 : appointments[0];
    return (<>
      <PageContainer_1.default tabTitle="Patient Information">
        <material_1.Stack spacing={2}>
          <CustomBreadcrumbs_1.default chain={[
            { link: '/patients', children: 'Patients' },
            {
                link: '#',
                children: loading ? (<material_1.Skeleton width={150}/>) : (<>
                    <material_1.Typography component="span" sx={{ fontWeight: 500 }}>{"".concat(lastName, ", ")}</material_1.Typography>
                    <material_1.Typography component="span">{"".concat(firstName)}</material_1.Typography>
                  </>),
            },
        ]}/>
          <material_1.Typography variant="subtitle1" color="primary.main">
            Patient Record
          </material_1.Typography>

          <material_1.Paper sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            mt: 2,
            p: 3,
        }}>
            <patient_1.PatientAvatar id={id}/>

            <material_1.Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <patient_1.IdentifiersRow id={id}/>
              <patient_1.FullNameDisplay patient={patient} loading={loading}/>
              <patient_1.Summary patient={patient} loading={loading}/>
              <patient_1.Contacts patient={patient} loading={loading}/>

              <material_1.Box sx={{ display: 'flex', gap: 1 }}>
                <RoundedButton_1.RoundedButton to={"/patient/".concat(id, "/info")} data-testid={data_test_ids_1.dataTestIds.patientRecordPage.seeAllPatientInfoButton}>
                  See All Patient Info
                </RoundedButton_1.RoundedButton>
              </material_1.Box>
            </material_1.Box>

            <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {latestAppointment && (<RoundedButton_1.RoundedButton target="_blank" sx={{ width: '100%' }} to={latestAppointment.serviceMode === utils_1.ServiceMode.virtual
                ? "/telemed/appointments/".concat(latestAppointment.id, "?tab=sign")
                : "/in-person/".concat(latestAppointment.id, "/progress-note")}>
                  Recent Progress Note
                </RoundedButton_1.RoundedButton>)}
              <RoundedButton_1.RoundedButton sx={{ width: '100%' }} to={"/patient/".concat(id, "/docs")}>
                Review Docs
              </RoundedButton_1.RoundedButton>
            </material_1.Box>
          </material_1.Paper>

          <lab_1.TabContext value={tab}>
            <material_1.Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <lab_1.TabList onChange={function (_, newTab) { return setTab(newTab); }}>
                <material_1.Tab value="encounters" label={<material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                      Visits - {(appointments === null || appointments === void 0 ? void 0 : appointments.length) || 0}
                    </material_1.Typography>}/>
                <material_1.Tab value="followups" label={<material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                      Patient Follow-ups
                    </material_1.Typography>}/>
                {feature_flags_1.FEATURE_FLAGS.LAB_ORDERS_ENABLED && (<material_1.Tab value="labs" label={<material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Labs</material_1.Typography>}/>)}
                {feature_flags_1.FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED && (<material_1.Tab value="in-house-labs" label={<material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                        In-House Labs
                      </material_1.Typography>}/>)}
                {feature_flags_1.FEATURE_FLAGS.RADIOLOGY_ENABLED && (<material_1.Tab value="radiology" label={<material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                        Radiology
                      </material_1.Typography>}/>)}
              </lab_1.TabList>
            </material_1.Box>

            <lab_1.TabPanel value="encounters" sx={{ p: 0 }}>
              <PatientEncountersGrid_1.PatientEncountersGrid appointments={appointments} loading={loading}/>
            </lab_1.TabPanel>
            <lab_1.TabPanel value="followups" sx={{ p: 0 }}>
              <PatientFollowupEncountersGrid_1.PatientFollowupEncountersGrid patient={patient} loading={loading}></PatientFollowupEncountersGrid_1.PatientFollowupEncountersGrid>
            </lab_1.TabPanel>
            {feature_flags_1.FEATURE_FLAGS.LAB_ORDERS_ENABLED && (<lab_1.TabPanel value="labs" sx={{ p: 0 }}>
                <PatientLabsTab_1.PatientLabsTab patientId={id || ''}/>
              </lab_1.TabPanel>)}
            {feature_flags_1.FEATURE_FLAGS.IN_HOUSE_LABS_ENABLED && (<lab_1.TabPanel value="in-house-labs" sx={{ p: 0 }}>
                <PatientInHouseLabsTab_1.PatientInHouseLabsTab titleText="In-House Labs" patientId={id || ''}/>
              </lab_1.TabPanel>)}
            {feature_flags_1.FEATURE_FLAGS.RADIOLOGY_ENABLED && (<lab_1.TabPanel value="radiology" sx={{ p: 0 }}>
                <PatientRadiologyTab_1.PatientRadiologyTab patientId={id || ''}/>
              </lab_1.TabPanel>)}
          </lab_1.TabContext>
        </material_1.Stack>
      </PageContainer_1.default>
    </>);
}
//# sourceMappingURL=PatientPage.js.map