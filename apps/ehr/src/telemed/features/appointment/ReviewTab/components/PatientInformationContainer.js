"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientInformationContainer = void 0;
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var utils_2 = require("../../../../utils");
var VisitNoteItem_1 = require("./VisitNoteItem");
var PatientInformationContainer = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var _k = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['patient', 'questionnaireResponse']), patient = _k.patient, questionnaireResponse = _k.questionnaireResponse;
    var patientName = (0, utils_2.getPatientName)(patient === null || patient === void 0 ? void 0 : patient.name).lastFirstMiddleName;
    var dob = (patient === null || patient === void 0 ? void 0 : patient.birthDate) && luxon_1.DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy');
    var phone = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('guardian-number', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString;
    var accompanyingPerson = {
        firstName: (_f = (_e = (_d = (0, utils_1.getQuestionnaireResponseByLinkId)('person-accompanying-minor-first-name', questionnaireResponse)) === null || _d === void 0 ? void 0 : _d.answer) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.valueString,
        lastName: (_j = (_h = (_g = (0, utils_1.getQuestionnaireResponseByLinkId)('person-accompanying-minor-last-name', questionnaireResponse)) === null || _g === void 0 ? void 0 : _g.answer) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.valueString,
    };
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        Patient information
      </material_1.Typography>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <VisitNoteItem_1.VisitNoteItem label="Patient name" value={patientName}/>
        <VisitNoteItem_1.VisitNoteItem label="Date of birth" value={dob}/>
        {accompanyingPerson.firstName && accompanyingPerson.lastName && (<VisitNoteItem_1.VisitNoteItem label="Person accompanying the minor patient" value={"".concat(accompanyingPerson.lastName, ", ").concat(accompanyingPerson.firstName)}/>)}
        {phone && <VisitNoteItem_1.VisitNoteItem label="Phone" value={phone}/>}
      </material_1.Box>
    </material_1.Box>);
};
exports.PatientInformationContainer = PatientInformationContainer;
//# sourceMappingURL=PatientInformationContainer.js.map