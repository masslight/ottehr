"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderInformationCard = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var AccordionCard_1 = require("../../../telemed/components/AccordionCard");
var OrderCollection_1 = require("./OrderCollection");
var OrderInformationCard = function (_a) {
    var orderPdfUrl = _a.orderPdfUrl;
    var _b = (0, react_1.useState)(false), collapsed = _b[0], setCollapsed = _b[1];
    return (<material_1.Box sx={{ mt: 2, mb: 2 }}>
      <AccordionCard_1.AccordionCard label={'Order information'} collapsed={collapsed} withBorder={false} onSwitch={function () {
            setCollapsed(function (prevState) { return !prevState; });
        }}>
        <material_1.Paper sx={{ p: 3 }}>
          <material_1.Stack spacing={1} sx={{ justifyContent: 'space-between' }}>
            <material_1.Button variant="outlined" type="button" sx={{ width: 170, borderRadius: '50px', textTransform: 'none' }} disabled={!orderPdfUrl} onClick={function () { return orderPdfUrl && (0, OrderCollection_1.openPdf)(orderPdfUrl); }}>
              Print order
            </material_1.Button>
          </material_1.Stack>
        </material_1.Paper>
      </AccordionCard_1.AccordionCard>
    </material_1.Box>);
};
exports.OrderInformationCard = OrderInformationCard;
//# sourceMappingURL=OrderInformationCard.js.map