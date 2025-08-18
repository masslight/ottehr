"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreadcrumbsView = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var BreadcrumbsView = function (_a) {
    var items = _a.items;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
      {items.map(function (item, index) {
            var color = item.isHighlighted ? theme.palette.primary.main : theme.palette.text.secondary;
            return (<react_1.default.Fragment key={item.text}>
            {item.isActive ? (<material_1.Typography variant="body1" fontWeight="bold" color={color}>
                {item.text}
              </material_1.Typography>) : (<react_router_dom_1.NavLink to={item.link} style={{ textDecoration: 'none' }}>
                <material_1.Typography variant="body1" color={color}>
                  {item.text}
                </material_1.Typography>
              </react_router_dom_1.NavLink>)}
            {index < items.length - 1 && <material_1.Typography color={theme.palette.text.secondary}>{'>'}</material_1.Typography>}
          </react_1.default.Fragment>);
        })}
    </material_1.Box>);
};
exports.BreadcrumbsView = BreadcrumbsView;
//# sourceMappingURL=BreadcrumbsView.js.map