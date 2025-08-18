"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Contacts = void 0;
var ContactPhoneOutlined_1 = require("@mui/icons-material/ContactPhoneOutlined");
var PhoneOutlined_1 = require("@mui/icons-material/PhoneOutlined");
var PlaceOutlined_1 = require("@mui/icons-material/PlaceOutlined");
var material_1 = require("@mui/material");
var patient_1 = require("utils/lib/fhir/patient");
var helpers_1 = require("utils/lib/helpers/helpers");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var Contacts = function (_a) {
    var _b, _c, _d, _e, _f;
    var loading = _a.loading, patient = _a.patient;
    var patientNumber = (_c = (_b = patient === null || patient === void 0 ? void 0 : patient.telecom) === null || _b === void 0 ? void 0 : _b.find(function (obj) { return obj.system === 'phone'; })) === null || _c === void 0 ? void 0 : _c.value;
    var contactNumber = (_f = (_e = (_d = patient === null || patient === void 0 ? void 0 : patient.contact) === null || _d === void 0 ? void 0 : _d[0].telecom) === null || _e === void 0 ? void 0 : _e.find(function (obj) { return (obj === null || obj === void 0 ? void 0 : obj.system) === 'phone'; })) === null || _f === void 0 ? void 0 : _f.value;
    return (<material_1.Box sx={{ display: 'flex', gap: 2 }}>
      {loading ? (<material_1.Skeleton width={275} variant="text"/>) : ((0, patient_1.getPatientAddress)(patient === null || patient === void 0 ? void 0 : patient.address).zipStateCityLine && (<material_1.Box sx={{ display: 'flex', gap: 0.5 }}>
            <PlaceOutlined_1.default fontSize="small"/>
            <material_1.Typography data-testid={data_test_ids_1.dataTestIds.patientHeader.patientAddress}>
              {(0, patient_1.getPatientAddress)(patient === null || patient === void 0 ? void 0 : patient.address).zipStateCityLine}
            </material_1.Typography>
          </material_1.Box>))}

      {loading ? (<material_1.Skeleton width={115}/>) : (<material_1.Tooltip title="Patient phone number">
          <material_1.Box sx={{ display: 'flex', gap: 0.5 }}>
            <PhoneOutlined_1.default fontSize="small"/>
            <material_1.Typography data-testid={data_test_ids_1.dataTestIds.patientHeader.patientPhoneNumber}>
              {patientNumber ? (0, helpers_1.formatPhoneNumberDisplay)(patientNumber) : '-'}
            </material_1.Typography>
          </material_1.Box>
        </material_1.Tooltip>)}

      {loading ? (<material_1.Skeleton width={115}/>) : (<material_1.Tooltip title="Emergency contact">
          <material_1.Box sx={{ display: 'flex', gap: 0.5 }}>
            <ContactPhoneOutlined_1.default fontSize="small"/>
            <material_1.Typography data-testid={data_test_ids_1.dataTestIds.patientHeader.emergencyContact}>
              {contactNumber ? (0, helpers_1.formatPhoneNumberDisplay)(contactNumber) : '-'}
            </material_1.Typography>
          </material_1.Box>
        </material_1.Tooltip>)}
    </material_1.Box>);
};
exports.Contacts = Contacts;
exports.default = exports.Contacts;
//# sourceMappingURL=Contacts.js.map