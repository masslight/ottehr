"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Banner;
var icons_material_1 = require("@mui/icons-material");
var material_1 = require("@mui/material");
var misc_helper_1 = require("../helpers/misc.helper");
function Banner(_a) {
    var text = _a.text, icon = _a.icon, iconSize = _a.iconSize, bgcolor = _a.bgcolor, color = _a.color;
    var iconElement = icon === 'info' ? (<icons_material_1.InfoOutlined sx={{ marginRight: '5px' }} fontSize={iconSize}/>) : icon === 'warning' ? (<icons_material_1.WarningAmberOutlined sx={{ marginRight: '5px' }} fontSize={iconSize}/>) : null;
    return (<material_1.Box sx={{
            bgcolor: bgcolor,
            color: color,
            height: misc_helper_1.BANNER_HEIGHT,
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            display: 'flex',
            position: 'sticky',
            padding: '5px',
            top: 0,
            zIndex: function (theme) { return theme.zIndex.drawer + 1; },
            opacity: 0.5,
            pointerEvents: 'none',
        }}>
      {iconElement}
      <material_1.Box>
        <material_1.Typography variant="h3">{text}</material_1.Typography>
      </material_1.Box>
    </material_1.Box>);
}
//# sourceMappingURL=Banner.js.map