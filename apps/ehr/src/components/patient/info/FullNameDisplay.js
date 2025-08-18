"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FullNameDisplay = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var patient_1 = require("utils/lib/fhir/patient");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var formatPatientName_1 = require("../../../helpers/formatPatientName");
var FullNameDisplay = function (_a) {
    var patient = _a.patient, loading = _a.loading, _b = _a.variant, variant = _b === void 0 ? 'h3' : _b;
    var _c = (0, react_1.useMemo)(function () {
        if (!patient)
            return {};
        return {
            firstName: (0, patient_1.getFirstName)(patient),
            lastName: (0, patient_1.getLastName)(patient),
            middleName: (0, patient_1.getMiddleName)(patient),
            nickname: (0, patient_1.getNickname)(patient),
        };
    }, [patient]), firstName = _c.firstName, lastName = _c.lastName, middleName = _c.middleName, nickname = _c.nickname;
    var formattedPatientFullName = (0, react_1.useMemo)(function () {
        return lastName && firstName && (0, formatPatientName_1.formatPatientName)({ lastName: lastName, firstName: firstName, middleName: middleName, nickname: nickname });
    }, [firstName, lastName, middleName, nickname]);
    return (<material_1.Typography variant={variant} color="primary.dark" data-testid={data_test_ids_1.dataTestIds.patientHeader.patientName}>
      {loading ? <material_1.Skeleton width={300}/> : formattedPatientFullName}
    </material_1.Typography>);
};
exports.FullNameDisplay = FullNameDisplay;
//# sourceMappingURL=FullNameDisplay.js.map