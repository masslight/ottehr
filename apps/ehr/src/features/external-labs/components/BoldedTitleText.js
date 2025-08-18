"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoldedTitleText = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var BoldedTitleText = function (_a) {
    var title = _a.title, description = _a.description;
    return (<material_1.Typography component="div">
      <material_1.Box fontWeight="bold" display="inline">
        {"".concat(title, ":")}
      </material_1.Box>{' '}
      {description}
    </material_1.Typography>);
};
exports.BoldedTitleText = BoldedTitleText;
//# sourceMappingURL=BoldedTitleText.js.map