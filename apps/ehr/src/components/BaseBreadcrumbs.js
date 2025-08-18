"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseBreadcrumbs = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
/**
 * Base breadcrumbs component that can be used to display a breadcrumb trail with a base link.
 * Can be used as regular component or as a wrapper for other components.
 *
 * Example:
 * <BaseBreadcrumbs sectionName="Patient" baseCrumb={{ label: 'Home', path: '/' }}>
 *   <PatientPage />
 * </BaseBreadcrumbs>
 *
 * Example2:
 * <Page>
 *   <BaseBreadcrumbs sectionName="Patient" baseCrumb={{ label: 'Home', path: '/' }} />
 *   <Content />
 * </Page>
 */
var BaseBreadcrumbs = function (_a) {
    var sectionName = _a.sectionName, baseCrumb = _a.baseCrumb, children = _a.children;
    return (<>
      <material_1.Breadcrumbs separator={<material_1.Typography color="text.secondary" sx={{ mx: 0.5 }}>
            /
          </material_1.Typography>} sx={{ display: 'flex' }}>
        {baseCrumb.path ? (<material_1.Link component={react_router_dom_1.Link} to={baseCrumb.path} color="text.secondary">
            {baseCrumb.label}
          </material_1.Link>) : (<material_1.Typography color="text.secondary">{baseCrumb.label}</material_1.Typography>)}
        <material_1.Typography color="text.primary">{sectionName}</material_1.Typography>
      </material_1.Breadcrumbs>

      {children}
    </>);
};
exports.BaseBreadcrumbs = BaseBreadcrumbs;
//# sourceMappingURL=BaseBreadcrumbs.js.map