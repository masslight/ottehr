"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSSSettingsLayout = exports.CSSLayout = void 0;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var telemed_1 = require("../../../telemed");
var appointment_store_1 = require("../../../telemed/state/appointment/appointment.store");
var CommonLayoutBreadcrumbs_1 = require("../components/breadcrumbs/CommonLayoutBreadcrumbs");
var Header_1 = require("../components/Header");
var InfoAlert_1 = require("../components/InfoAlert");
var Sidebar_1 = require("../components/Sidebar");
var useChartData_1 = require("../hooks/useChartData");
var BottomNavigation_1 = require("./BottomNavigation");
var layoutStyle = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
};
var mainBlocksStyle = {
    display: 'flex',
    flexGrow: 1,
    overflow: 'hidden',
};
var contentWrapperStyle = {
    flexGrow: 1,
    padding: 0,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'auto',
};
var CSSLayout = function () {
    var _a = (0, appointment_store_1.useAppointmentStore)(), encounter = _a.encounter, chartData = _a.chartData;
    var isInitialLoad = (0, react_1.useRef)(true);
    (0, telemed_1.useResetAppointmentStore)();
    (0, useChartData_1.useChartData)({
        encounterId: encounter.id,
        onSuccess: function (data) {
            appointment_store_1.useAppointmentStore.setState({ chartData: __assign(__assign({}, chartData), data) });
            isInitialLoad.current = false;
        },
        onError: function (error) {
            console.error(error);
        },
        enabled: isInitialLoad.current,
        shouldUpdateExams: true,
    });
    var assignedIntakePerformerId = (0, utils_1.getAdmitterPractitionerId)(encounter);
    var assignedProviderId = (0, utils_1.getAttendingPractitionerId)(encounter);
    return (<div style={layoutStyle}>
      <Header_1.Header />
      <div style={mainBlocksStyle}>
        <Sidebar_1.Sidebar />
        <div style={contentWrapperStyle}>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 20px 24px 20px',
        }}>
            {assignedIntakePerformerId && assignedProviderId ? (<>
                <CommonLayoutBreadcrumbs_1.CommonLayoutBreadcrumbs />
                <react_router_dom_1.Outlet />
              </>) : (<InfoAlert_1.InfoAlert text="Select an intake performer and a provider in order to begin charting." persistent/>)}
          </div>
          <BottomNavigation_1.BottomNavigation />
        </div>
      </div>
    </div>);
};
exports.CSSLayout = CSSLayout;
var CSSSettingsLayout = function () { return (<div style={layoutStyle}>
    <Header_1.Header />
    <div style={mainBlocksStyle}>
      <div style={contentWrapperStyle}>
        <react_router_dom_1.Outlet />
      </div>
    </div>
  </div>); };
exports.CSSSettingsLayout = CSSSettingsLayout;
//# sourceMappingURL=CSSLayout.js.map