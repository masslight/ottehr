"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary = void 0;
var CakeOutlined_1 = require("@mui/icons-material/CakeOutlined");
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var types_1 = require("utils/lib/types");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var parser_1 = require("../../../features/css-module/parser");
var Summary = function (_a) {
    var patient = _a.patient, loading = _a.loading;
    var pronouns = (0, parser_1.getExtensionValue)(patient, types_1.PATIENT_INDIVIDUAL_PRONOUNS_URL);
    return (<material_1.Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {loading ? <material_1.Skeleton width={86}/> : pronouns && <material_1.Typography>{pronouns}</material_1.Typography>}

      {loading ? (<material_1.Skeleton width={36}/>) : ((patient === null || patient === void 0 ? void 0 : patient.gender) && (<material_1.Typography data-testid={data_test_ids_1.dataTestIds.patientHeader.patientBirthSex}>{(0, material_1.capitalize)(patient === null || patient === void 0 ? void 0 : patient.gender)}</material_1.Typography>))}

      {loading ? (<material_1.Skeleton width={131}/>) : ((patient === null || patient === void 0 ? void 0 : patient.birthDate) && (<material_1.Box sx={{ display: 'flex', gap: 0.5 }}>
            <CakeOutlined_1.default fontSize="small"/>
            <material_1.Typography data-testid={data_test_ids_1.dataTestIds.patientHeader.patientBirthday}>
              {(0, utils_1.formatDOB)(patient === null || patient === void 0 ? void 0 : patient.birthDate)}
            </material_1.Typography>
          </material_1.Box>))}
    </material_1.Box>);
};
exports.Summary = Summary;
exports.default = exports.Summary;
//# sourceMappingURL=Summary.js.map