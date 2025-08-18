"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithRadiologyBreadcrumbs = void 0;
var material_1 = require("@mui/material");
var styles_1 = require("@mui/material/styles");
var react_router_dom_1 = require("react-router-dom");
var helpers_1 = require("src/features/css-module/routing/helpers");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var PageWrapper = (0, styles_1.styled)(material_1.Box)({
    padding: '0px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
});
var BreadcrumbsContainer = (0, styles_1.styled)(material_1.Box)({
    display: 'flex',
    gap: '8px',
    alignSelf: 'flex-start',
    marginLeft: '0px',
});
var Separator = (0, styles_1.styled)(material_1.Typography)({
    color: '#666',
});
var WithRadiologyBreadcrumbs = function (_a) {
    var sectionName = _a.sectionName, _b = _a.disableLabsLink, disableLabsLink = _b === void 0 ? false : _b, children = _a.children;
    var appointment = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['appointment']).appointment;
    return (<PageWrapper>
      <BreadcrumbsContainer>
        {!disableLabsLink && (appointment === null || appointment === void 0 ? void 0 : appointment.id) ? (<material_1.Link component={react_router_dom_1.Link} to={(0, helpers_1.getRadiologyUrl)(appointment.id)} color="text.primary">
            Radiology
          </material_1.Link>) : (<material_1.Typography color="text.primary">Radiology</material_1.Typography>)}
        <Separator>/</Separator>
        <material_1.Typography color="text.primary">{sectionName}</material_1.Typography>
      </BreadcrumbsContainer>

      {children}
    </PageWrapper>);
};
exports.WithRadiologyBreadcrumbs = WithRadiologyBreadcrumbs;
//# sourceMappingURL=RadiologyBreadcrumbs.js.map