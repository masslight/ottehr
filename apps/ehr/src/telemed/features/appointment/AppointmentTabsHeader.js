"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentTabsHeader = void 0;
var icons_1 = require("@ehrTheme/icons");
var AssignmentIndOutlined_1 = require("@mui/icons-material/AssignmentIndOutlined");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var Sidebar_1 = require("src/features/css-module/components/Sidebar");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var assets_1 = require("../../assets");
var state_1 = require("../../state");
var AppointmentTabsHeader = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['currentTab', 'chartData']), currentTab = _a.currentTab, chartData = _a.chartData;
    var handleTabChange = function (_event, newTabName) {
        state_1.useAppointmentStore.setState({ currentTab: newTabName });
    };
    return (<lab_1.TabContext value={currentTab}>
      <lab_1.TabList onChange={handleTabChange}>
        <material_1.Tab label={<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <AssignmentIndOutlined_1.default />
              <material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                HPI and Medical history
              </material_1.Typography>
            </material_1.Box>} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.hpi)} value={utils_1.TelemedAppointmentVisitTabs.hpi}/>
        <material_1.Tab label={<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <material_1.ListItemIcon sx={{ height: 24, width: 24, minWidth: 24 }}>{Sidebar_1.sidebarMenuIcons.Vitals}</material_1.ListItemIcon>
              <material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Vitals</material_1.Typography>
            </material_1.Box>} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.vitals)} value={utils_1.TelemedAppointmentVisitTabs.vitals}/>
        <material_1.Tab label={<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <assets_1.StethoscopeIcon />
              <material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Exam</material_1.Typography>
            </material_1.Box>} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.exam)} value={utils_1.TelemedAppointmentVisitTabs.exam}/>
        <material_1.Tab label={<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <assets_1.DiagnosisIcon />
              <material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Assessment</material_1.Typography>
            </material_1.Box>} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.assessment)} value={utils_1.TelemedAppointmentVisitTabs.assessment}/>
        <material_1.Tab label={<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <assets_1.PatientListIcon />
              <material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Plan</material_1.Typography>
            </material_1.Box>} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.plan)} value={utils_1.TelemedAppointmentVisitTabs.plan}/>
        <material_1.Tab label={<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <assets_1.ContractEditIcon />
              <material_1.Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>Review and Sign</material_1.Typography>
            </material_1.Box>} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.appointmentVisitTabs(utils_1.TelemedAppointmentVisitTabs.sign)} value={utils_1.TelemedAppointmentVisitTabs.sign}/>
        {(chartData === null || chartData === void 0 ? void 0 : chartData.aiChat) != null ? (<material_1.Tab label={<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <img src={icons_1.ottehrAiIcon} style={{ width: '24px' }}/>
                <material_1.Typography sx={{ textTransform: 'none', fontWeight: 700, fontSize: '14px' }}>Oystehr AI</material_1.Typography>
              </material_1.Box>} value={utils_1.TelemedAppointmentVisitTabs.ottehrai}/>) : undefined}
      </lab_1.TabList>
    </lab_1.TabContext>);
};
exports.AppointmentTabsHeader = AppointmentTabsHeader;
//# sourceMappingURL=AppointmentTabsHeader.js.map