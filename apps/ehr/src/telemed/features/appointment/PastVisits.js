"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PastVisits = void 0;
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var react_1 = require("react");
var data_test_ids_1 = require("src/constants/data-test-ids");
var PastVisitsTable_1 = require("../../../components/PastVisitsTable");
var useGetPatient_1 = require("../../../hooks/useGetPatient");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var utils_1 = require("../../utils");
var PastVisits = function () {
    var patient = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['patient']).patient;
    var _a = (0, useGetPatient_1.useGetPatient)(patient === null || patient === void 0 ? void 0 : patient.id), appointments = _a.appointments, loading = _a.loading;
    var _b = (0, react_1.useState)(false), open = _b[0], setOpen = _b[1];
    var patientName = (0, utils_1.getPatientName)(patient === null || patient === void 0 ? void 0 : patient.name).lastFirstMiddleName;
    if (loading) {
        return <material_1.Skeleton sx={{ display: 'inline-block' }} variant="text" width={100}/>;
    }
    if (!(appointments === null || appointments === void 0 ? void 0 : appointments.length) || appointments.length == 1) {
        return (<material_1.Typography data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.telemedNewOrExistingPatient} variant="body2">
        New patient
      </material_1.Typography>);
    }
    return (<>
      <material_1.Typography variant="body2">
        Established patient:
        <material_1.Link sx={{ cursor: 'pointer', color: 'inherit' }} onClick={function () { return setOpen(true); }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.telemedNewOrExistingPatient}>
          {appointments.length} visit{appointments.length > 1 && 's'}
        </material_1.Link>
      </material_1.Typography>

      {open && (<material_1.Dialog open={open} onClose={function () { return setOpen(false); }} maxWidth="lg" fullWidth>
          <material_1.IconButton size="small" onClick={function () { return setOpen(false); }} sx={{ position: 'absolute', right: 16, top: 16 }}>
            <Close_1.default fontSize="small"/>
          </material_1.IconButton>

          <material_1.Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <material_1.Typography variant="h4" color="primary.dark">
              Past Visits - {patientName}
            </material_1.Typography>
            <material_1.Box sx={{ maxHeight: '700px', overflowY: 'scroll' }}>
              <PastVisitsTable_1.PastVisitsTable appointments={appointments} stickyHeader/>
            </material_1.Box>
          </material_1.Box>
        </material_1.Dialog>)}
    </>);
};
exports.PastVisits = PastVisits;
//# sourceMappingURL=PastVisits.js.map