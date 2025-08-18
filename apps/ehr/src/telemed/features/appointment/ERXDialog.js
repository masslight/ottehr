"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERXDialog = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_dom_1 = require("react-dom");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var ERXDialog = function (_a) {
    var _b, _c, _d;
    var ssoLink = _a.ssoLink;
    var patient = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['patient']).patient;
    var weight = Number.parseFloat((_d = (_c = (_b = patient === null || patient === void 0 ? void 0 : patient.extension) === null || _b === void 0 ? void 0 : _b.find(function (ext) { return ext.url === utils_1.FHIR_EXTENSION.Patient.weight.url; })) === null || _c === void 0 ? void 0 : _c.valueString) !== null && _d !== void 0 ? _d : '');
    if (isNaN(weight)) {
        weight = undefined;
    }
    var _e = (0, react_1.useState)(), erxPortalElement = _e[0], setErxPortalElement = _e[1];
    (0, react_1.useEffect)(function () {
        var portalElement = document.getElementById('prescribe-dialog');
        setErxPortalElement(portalElement);
        return function () {
            // Cleanup portal when component unmounts
            if (portalElement) {
                while (portalElement.firstChild) {
                    portalElement.removeChild(portalElement.firstChild);
                }
            }
        };
    }, []); // Empty dependency array since we only want to set up and clean up once
    return (<>
      {erxPortalElement &&
            (0, react_dom_1.createPortal)(<material_1.Box sx={{ minHeight: '600px', flex: '1 0 auto' }}>
            <iframe src={ssoLink} width="100%" height="100%"/>
          </material_1.Box>, erxPortalElement)}
    </>);
};
exports.ERXDialog = ERXDialog;
//# sourceMappingURL=ERXDialog.js.map