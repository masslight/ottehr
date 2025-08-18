"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadOnlyCard = void 0;
var material_1 = require("@mui/material");
var components_1 = require("../../../components");
var ReviewTab_1 = require("../ReviewTab");
var ReadOnlyCard = function () {
    return (<components_1.AccordionCard label="Examination">
      <material_1.Box sx={{ p: 2 }}>
        <ReviewTab_1.ExaminationContainer noTitle/>
      </material_1.Box>
    </components_1.AccordionCard>);
};
exports.ReadOnlyCard = ReadOnlyCard;
//# sourceMappingURL=ReadOnlyCard.js.map