"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SchedulesPage;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var ScheduleInformation_1 = require("../components/ScheduleInformation");
var PageContainer_1 = require("../layout/PageContainer");
function SchedulesPage() {
    var _a;
    var location = (0, react_router_dom_1.useLocation)();
    var _b = (0, react_1.useState)(((_a = location.state) === null || _a === void 0 ? void 0 : _a.defaultTab) || 'location'), tab = _b[0], setTab = _b[1];
    return (<PageContainer_1.default>
      <>
        <lab_1.TabContext value={tab}>
          <material_1.Box sx={{ borderBottom: 1, borderColor: 'divider', mx: 3 }}>
            <lab_1.TabList onChange={function (event, tabTemp) { return setTab(tabTemp); }} aria-label="Switch between different schedule options">
              <material_1.Tab label="Locations" value="location" sx={{ textTransform: 'none', fontWeight: 500 }}/>
              <material_1.Tab label="Providers" value="provider" sx={{ textTransform: 'none', fontWeight: 500 }}/>
              <material_1.Tab label="Groups" value="group" sx={{ textTransform: 'none', fontWeight: 500 }}/>
            </lab_1.TabList>
          </material_1.Box>
          <lab_1.TabPanel value="location">
            <ScheduleInformation_1.ScheduleInformation scheduleType="location"></ScheduleInformation_1.ScheduleInformation>
          </lab_1.TabPanel>
          <lab_1.TabPanel value="provider">
            <ScheduleInformation_1.ScheduleInformation scheduleType="provider"></ScheduleInformation_1.ScheduleInformation>
          </lab_1.TabPanel>
          <lab_1.TabPanel value="group">
            <ScheduleInformation_1.ScheduleInformation scheduleType="group"></ScheduleInformation_1.ScheduleInformation>
          </lab_1.TabPanel>
        </lab_1.TabContext>
      </>
    </PageContainer_1.default>);
}
//# sourceMappingURL=Schedules.js.map