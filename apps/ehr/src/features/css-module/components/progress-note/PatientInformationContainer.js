"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientInformationContainer = void 0;
var EditOutlined_1 = require("@mui/icons-material/EditOutlined");
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var dialogs_1 = require("../../../../components/dialogs");
var formatDateTime_1 = require("../../../../helpers/formatDateTime");
var telemed_1 = require("../../../../telemed");
var ReviewTab_1 = require("../../../../telemed/features/appointment/ReviewTab");
var utils_2 = require("../../../../telemed/utils");
var PatientInformationContainer = function () {
    var _a, _b;
    var patient = (0, utils_1.getSelectors)(telemed_1.useAppointmentStore, ['patient']).patient;
    var _c = (0, react_1.useState)(false), isEditDialogOpen = _c[0], setIsEditDialogOpen = _c[1];
    var name = (0, utils_2.getPatientName)(patient === null || patient === void 0 ? void 0 : patient.name).firstMiddleLastName;
    var dob = (patient === null || patient === void 0 ? void 0 : patient.birthDate) && "".concat((0, formatDateTime_1.formatDateUsingSlashes)(patient.birthDate), " (").concat((0, utils_1.calculatePatientAge)(patient.birthDate), ")");
    var sex = (patient === null || patient === void 0 ? void 0 : patient.gender) && (0, material_1.capitalize)(patient.gender);
    var phone = (0, utils_1.standardizePhoneNumber)((_b = (_a = patient === null || patient === void 0 ? void 0 : patient.telecom) === null || _a === void 0 ? void 0 : _a.find(function (obj) { return obj.system === 'phone'; })) === null || _b === void 0 ? void 0 : _b.value);
    var address = (0, utils_1.getPatientAddress)(patient === null || patient === void 0 ? void 0 : patient.address).zipStateCityLine;
    return (<material_1.Stack spacing={2}>
      <material_1.Stack direction="row" justifyContent="space-between" alignItems="center">
        <material_1.Typography fontSize={18} color="primary.dark" fontWeight={600}>
          Patient information
        </material_1.Typography>

        <material_1.IconButton size="small" onClick={function () { return setIsEditDialogOpen(true); }} sx={{ color: 'primary.main' }}>
          <EditOutlined_1.default />
        </material_1.IconButton>
      </material_1.Stack>

      <telemed_1.ActionsList data={[
            { label: 'Name', value: name },
            { label: 'Date of birth (Age)', value: dob },
            { label: 'Birth sex', value: sex },
            { label: 'Phone', value: phone },
            { label: 'Address', value: address },
        ]} getKey={function (item) { return item.label; }} renderItem={function (item) { return (<material_1.Stack width="100%">
            <ReviewTab_1.VisitNoteItem label={item.label} value={item.value} noMaxWidth/>
          </material_1.Stack>); }} gap={0.75} divider/>

      {isEditDialogOpen && (<dialogs_1.EditPatientDialog modalOpen={isEditDialogOpen} onClose={function () { return setIsEditDialogOpen(false); }}/>)}
    </material_1.Stack>);
};
exports.PatientInformationContainer = PatientInformationContainer;
//# sourceMappingURL=PatientInformationContainer.js.map