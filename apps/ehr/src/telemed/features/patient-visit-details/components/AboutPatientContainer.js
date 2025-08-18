"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AboutPatientContainer = void 0;
// cSpell:ignore Gmailerrorred
var ReportGmailerrorred_1 = require("@mui/icons-material/ReportGmailerrorred");
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var components_1 = require("../../../components");
var state_1 = require("../../../state");
var EditPatientBirthDateDialog_1 = require("./EditPatientBirthDateDialog");
var InformationCard_1 = require("./InformationCard");
var AboutPatientContainer = function () {
    var theme = (0, material_1.useTheme)();
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['patient', 'appointment']), patient = _a.patient, appointment = _a.appointment;
    var _b = (0, react_1.useState)(false), updateDOBModalOpen = _b[0], setUpdateDOBModalOpen = _b[1];
    var closePatientDOBModal = function () { return setUpdateDOBModalOpen(false); };
    var unconfirmedDOB = appointment && (0, utils_1.getUnconfirmedDOBForAppointment)(appointment);
    var weight = (0, utils_1.getWeightForPatient)(patient);
    var reasonForVisit = (0, react_1.useMemo)(function () {
        var _a;
        var complaints = ((_a = appointment === null || appointment === void 0 ? void 0 : appointment.description) !== null && _a !== void 0 ? _a : '').split(',');
        return complaints.map(function (complaint) { return complaint.trim(); }).join(', ');
    }, [appointment === null || appointment === void 0 ? void 0 : appointment.description]);
    return (<>
      <InformationCard_1.InformationCard title="About the patient" fields={[
            {
                label: "Patient's date of birth (Original)",
                value: (patient === null || patient === void 0 ? void 0 : patient.birthDate) && (0, utils_1.mdyStringFromISOString)(patient === null || patient === void 0 ? void 0 : patient.birthDate),
                button: (<components_1.PencilIconButton onClick={function () { return setUpdateDOBModalOpen(true); }} size="16px" sx={{ padding: '10px' }}/>),
            },
            {
                label: "Patient's date of birth (Unmatched)",
                value: unconfirmedDOB && unconfirmedDOB !== 'true' ? (0, utils_1.mdyStringFromISOString)(unconfirmedDOB) : '-',
                icon: <ReportGmailerrorred_1.default sx={{ color: theme.palette.warning.main, fontSize: '1rem' }}/>,
            },
            { label: "Patient's sex", value: (0, material_1.capitalize)((patient === null || patient === void 0 ? void 0 : patient.gender) || '') },
            { label: 'Reason for visit', value: reasonForVisit },
            { label: 'Patient weight (lbs)', value: weight },
        ]}/>
      <EditPatientBirthDateDialog_1.EditPatientBirthDateDialog modalOpen={updateDOBModalOpen} onClose={closePatientDOBModal}/>
    </>);
};
exports.AboutPatientContainer = AboutPatientContainer;
//# sourceMappingURL=AboutPatientContainer.js.map