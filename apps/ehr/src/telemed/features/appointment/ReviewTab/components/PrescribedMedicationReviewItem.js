"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrescribedMedicationReviewItem = void 0;
var material_1 = require("@mui/material");
var PrescribedMedicationReviewItem = function (props) {
    var medication = props.medication;
    return (<>
      <material_1.Typography fontWeight={500} mb={0.5}>
        {medication.name}
      </material_1.Typography>
      <material_1.Typography>{medication.instructions}</material_1.Typography>
    </>);
};
exports.PrescribedMedicationReviewItem = PrescribedMedicationReviewItem;
//# sourceMappingURL=PrescribedMedicationReviewItem.js.map