"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemedAdminPage = TelemedAdminPage;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var App_1 = require("../App");
var PageContainer_1 = require("../layout/PageContainer");
var Insurance_1 = require("../telemed/features/telemed-admin/Insurance");
var States_1 = require("../telemed/features/telemed-admin/States");
var PageTab;
(function (PageTab) {
    PageTab["insurance"] = "insurances";
    PageTab["states"] = "states";
})(PageTab || (PageTab = {}));
function TelemedAdminPage() {
    var _a = (0, react_1.useState)(PageTab.insurance), pageTab = _a[0], setPageTab = _a[1];
    var navigate = (0, react_router_dom_1.useNavigate)();
    var statesMatch = (0, react_router_dom_1.useMatch)(App_1.STATES_URL);
    var page = statesMatch ? PageTab.states : PageTab.insurance;
    (0, react_1.useEffect)(function () {
        setPageTab(page);
    }, [page]);
    var handleTabChange = function (_, newValue) {
        setPageTab(newValue);
    };
    return (<PageContainer_1.default>
      <material_1.Box sx={{ width: '100%', marginTop: 3 }}>
        <lab_1.TabContext value={pageTab}>
          <material_1.Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <lab_1.TabList onChange={handleTabChange} aria-label={"".concat(page, " page")}>
              <material_1.Tab label="Insurance" value={PageTab.insurance} sx={{ textTransform: 'none', fontWeight: 500 }} onClick={function () { return navigate("/telemed-admin/".concat(PageTab.insurance)); }}/>
              <material_1.Tab label="States" value={PageTab.states} sx={{ textTransform: 'none', fontWeight: 500 }} onClick={function () { return navigate("/telemed-admin/".concat(PageTab.states)); }}/>
            </lab_1.TabList>
          </material_1.Box>
          <material_1.Paper sx={{ marginTop: 5 }}>
            <lab_1.TabPanel value={pageTab} sx={{ padding: 0 }}>
              {pageTab === PageTab.insurance && <Insurance_1.default />}
              {pageTab === PageTab.states && <States_1.default />}
            </lab_1.TabPanel>
          </material_1.Paper>
        </lab_1.TabContext>
      </material_1.Box>
    </PageContainer_1.default>);
}
//# sourceMappingURL=TelemedAdminPage.js.map