"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentHeader = void 0;
var ArrowBack_1 = require("@mui/icons-material/ArrowBack");
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var misc_helper_1 = require("../../../helpers/misc.helper");
var AppointmentTabsHeader_1 = require("./AppointmentTabsHeader");
var AppointmentHeader = function () {
    var theme = (0, material_1.useTheme)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    return (<material_1.AppBar position="sticky" color="transparent" sx={{
            backgroundColor: theme.palette.background.paper,
            zIndex: function (theme) { return theme.zIndex.drawer + 1; },
            top: (0, misc_helper_1.adjustTopForBannerHeight)(0),
        }}>
      <material_1.Box sx={{ display: 'flex', mt: 1, mx: 3, justifyContent: 'space-between', alignItems: 'start' }}>
        <material_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
          <material_1.IconButton onClick={function () { return navigate('/telemed/appointments'); }} sx={{ width: 40, height: 40, mr: 1 }}>
            <ArrowBack_1.default />
          </material_1.IconButton>
          <AppointmentTabsHeader_1.AppointmentTabsHeader />
        </material_1.Box>

        <material_1.IconButton onClick={function () { return navigate('/telemed/appointments'); }}>
          <Close_1.default fontSize="small"/>
        </material_1.IconButton>
      </material_1.Box>
    </material_1.AppBar>);
};
exports.AppointmentHeader = AppointmentHeader;
//# sourceMappingURL=AppointmentHeader.js.map