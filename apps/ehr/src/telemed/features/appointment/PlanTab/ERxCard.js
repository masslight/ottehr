"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERxCard = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var AccordionCard_1 = require("src/telemed/components/AccordionCard");
var ERxContainer_1 = require("./ERxContainer");
var ERxCard = function () {
    var _a = (0, react_1.useState)(false), collapsed = _a[0], setCollapsed = _a[1];
    return (<>
      <AccordionCard_1.AccordionCard label="eRX" collapsed={collapsed} onSwitch={function () { return setCollapsed(function (prevState) { return !prevState; }); }}>
        <material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ERxContainer_1.ERxContainer showHeader={false}/>
        </material_1.Box>
      </AccordionCard_1.AccordionCard>
    </>);
};
exports.ERxCard = ERxCard;
//# sourceMappingURL=ERxCard.js.map