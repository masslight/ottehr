"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TitleRow = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var PencilIconButton_1 = require("../../../components/PencilIconButton");
var state_1 = require("../../../state");
var EditPatientNameDialog_1 = require("./EditPatientNameDialog");
var TitleRow = function () {
    var _a, _b;
    var _c = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'patient',
        'appointment',
        'locationVirtual',
    ]), patient = _c.patient, appointment = _c.appointment, locationVirtual = _c.locationVirtual;
    var fullName = (0, react_1.useMemo)(function () {
        if (patient) {
            return (0, utils_1.getFullName)(patient);
        }
        return '';
    }, [patient]);
    var visitStarted = (appointment === null || appointment === void 0 ? void 0 : appointment.start) && (0, utils_1.mdyStringFromISOString)(appointment === null || appointment === void 0 ? void 0 : appointment.start);
    var office = ((_a = locationVirtual === null || locationVirtual === void 0 ? void 0 : locationVirtual.address) === null || _a === void 0 ? void 0 : _a.state) &&
        (locationVirtual === null || locationVirtual === void 0 ? void 0 : locationVirtual.name) &&
        "".concat(locationVirtual === null || locationVirtual === void 0 ? void 0 : locationVirtual.name, ", ").concat((_b = locationVirtual === null || locationVirtual === void 0 ? void 0 : locationVirtual.address) === null || _b === void 0 ? void 0 : _b.state.toUpperCase());
    var _d = (0, react_1.useState)(false), updateNameModalOpen = _d[0], setUpdateNameModalOpen = _d[1];
    var closePatientNameModal = function () { return setUpdateNameModalOpen(false); };
    return (<>
      <material_1.Grid container direction="row" sx={{ mt: 1, alignItems: 'center' }}>
        <PencilIconButton_1.PencilIconButton onClick={function () { return setUpdateNameModalOpen(true); }} size="25px" sx={{ mr: '7px', padding: 0 }}/>
        <material_1.Typography variant="h2" color="primary.dark">
          {fullName}
        </material_1.Typography>

        <material_1.Typography sx={{ ml: 2 }}>{visitStarted}</material_1.Typography>

        <material_1.Typography sx={{ ml: 2 }}>{office}</material_1.Typography>
      </material_1.Grid>
      <EditPatientNameDialog_1.EditPatientNameDialog modalOpen={updateNameModalOpen} onClose={closePatientNameModal}/>
    </>);
};
exports.TitleRow = TitleRow;
//# sourceMappingURL=TitleRow.js.map