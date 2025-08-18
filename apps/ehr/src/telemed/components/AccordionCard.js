"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccordionCard = void 0;
var colors_1 = require("@ehrTheme/colors");
var ArrowDropDownCircleOutlined_1 = require("@mui/icons-material/ArrowDropDownCircleOutlined");
var material_1 = require("@mui/material");
var AccordionCard = function (props) {
    var collapsed = props.collapsed, onSwitch = props.onSwitch, label = props.label, children = props.children, headerItem = props.headerItem, dataTestId = props.dataTestId, _a = props.withBorder, withBorder = _a === void 0 ? true : _a;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            backgroundColor: colors_1.otherColors.solidLine,
            border: withBorder ? "1px solid ".concat(colors_1.otherColors.solidLine) : 'none',
            borderRadius: 1,
        }} data-testid={dataTestId}>
      {label && (<material_1.Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                backgroundColor: colors_1.otherColors.apptHover,
                py: 0.5,
                px: 2,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
            }}>
          <material_1.Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexGrow: 1,
                cursor: collapsed !== undefined ? 'pointer' : 'inherit',
            }} onClick={onSwitch}>
            {collapsed !== undefined && onSwitch && (<material_1.IconButton sx={{ p: 0 }}>
                <ArrowDropDownCircleOutlined_1.default fontSize="small" sx={{
                    color: theme.palette.primary.main,
                    rotate: collapsed ? '' : '180deg',
                }}></ArrowDropDownCircleOutlined_1.default>
              </material_1.IconButton>)}
            {typeof label === 'string' ? (<material_1.Typography variant="h6" color={theme.palette.primary.dark}>
                {label}
              </material_1.Typography>) : (label)}
          </material_1.Box>

          {headerItem}
        </material_1.Box>)}
      {!collapsed && (<material_1.Box sx={{
                backgroundColor: theme.palette.background.paper,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
                borderRadius: label ? undefined : 1,
            }}>
          {children}
        </material_1.Box>)}
    </material_1.Box>);
};
exports.AccordionCard = AccordionCard;
//# sourceMappingURL=AccordionCard.js.map