"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Header = void 0;
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var data_test_ids_1 = require("src/constants/data-test-ids");
var PrintVisitLabelButton_1 = require("src/features/css-module/components/PrintVisitLabelButton");
var App_1 = require("../../App");
var misc_helper_1 = require("../../helpers/misc.helper");
var useGetPatient_1 = require("../../hooks/useGetPatient");
var info_1 = require("./info");
var Header = function (_a) {
    var handleDiscard = _a.handleDiscard, id = _a.id;
    var theme = (0, material_1.useTheme)();
    var _b = (0, useGetPatient_1.useGetPatient)(id), loading = _b.loading, patient = _b.patient, appointments = _b.appointments;
    // todo: product has said that on screens with no specific encounter, use the latest encounter for the label
    // which seems ok for now but might change later
    var latestAppointmentEncounter = appointments === null || appointments === void 0 ? void 0 : appointments[0].encounter;
    return (<material_1.Box sx={{
            position: 'sticky',
            top: App_1.showEnvironmentBanner ? misc_helper_1.BANNER_HEIGHT : 0,
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: theme.palette.background.paper,
            padding: theme.spacing(1, 3),
            borderBottom: "1px solid ".concat(theme.palette.divider),
            boxShadow: '0px 2px 4px -1px rgba(0, 0, 0, 0.2)',
        }}>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <info_1.IdentifiersRow id={id} loading={false}/>
        <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <material_1.Box sx={{ flex: '64px 0 0' }}>
            <info_1.PatientAvatar id={id} sx={{ width: 64, height: 64 }}/>
          </material_1.Box>
          <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <material_1.Box sx={{ display: 'flex', rowGap: 0.5, columnGap: 2, flexWrap: 'wrap' }}>
              <info_1.FullNameDisplay patient={patient} loading={loading} variant="h5"/>
              <PrintVisitLabelButton_1.PrintVisitLabelButton encounterId={latestAppointmentEncounter === null || latestAppointmentEncounter === void 0 ? void 0 : latestAppointmentEncounter.id}/>
              <info_1.Summary patient={patient} loading={loading}/>
            </material_1.Box>
            <info_1.Contacts patient={patient} loading={loading}/>
          </material_1.Box>
        </material_1.Box>
      </material_1.Box>
      <material_1.Box>
        <material_1.IconButton onClick={handleDiscard} aria-label="Close" data-testid={data_test_ids_1.dataTestIds.patientHeader.closeButton}>
          <Close_1.default />
        </material_1.IconButton>
      </material_1.Box>
    </material_1.Box>);
};
exports.Header = Header;
//# sourceMappingURL=Header.js.map