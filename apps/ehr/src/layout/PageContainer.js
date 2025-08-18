"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PageContainer;
var material_1 = require("@mui/material");
var react_1 = require("react");
var WithTooltip_1 = require("src/components/WithTooltip");
var Sidebar_1 = require("../components/navigation/Sidebar");
var ORGANIZATION_NAME_LONG = import.meta.env.VITE_APP_ORGANIZATION_NAME_LONG;
if (ORGANIZATION_NAME_LONG == null) {
    throw new Error('Could not load env variable');
}
function PageContainer(_a) {
    var sidebarItems = _a.sidebarItems, tabTitle = _a.tabTitle, title = _a.title, children = _a.children;
    var _b = (0, react_1.useState)(true), sidebarOpen = _b[0], setSidebarOpen = _b[1];
    if (title != null || tabTitle != null) {
        document.title = "".concat(tabTitle != null ? tabTitle : title, " | ").concat(ORGANIZATION_NAME_LONG, " EHR");
    }
    var container = (<material_1.Container sx={{ my: 5, maxWidth: '1600px !important' }}>
      {title && (<material_1.Typography variant="h3" color="primary.dark" sx={{ fontWeight: 600, mb: 4 }}>
          {title}
        </material_1.Typography>)}
      {children}
      <br />
      <WithTooltip_1.TooltipWrapper tooltipProps={WithTooltip_1.CPT_TOOLTIP_PROPS}>
        Environment: {import.meta.env.VITE_APP_ENV}, Version: {import.meta.env.VITE_APP_VERSION}
      </WithTooltip_1.TooltipWrapper>
    </material_1.Container>);
    return (<>
      {sidebarItems ? (<Sidebar_1.Sidebar sidebarItems={sidebarItems} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
          {container}
        </Sidebar_1.Sidebar>) : (container)}
    </>);
}
//# sourceMappingURL=PageContainer.js.map