"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var material_1 = require("@mui/material");
var ShowMoreButton = function (_a) {
    var isOpen = _a.isOpen, onClick = _a.onClick, dataTestId = _a.dataTestId;
    return (<material_1.Button onClick={onClick} sx={{ p: 0 }} data-testid={dataTestId}>
      {isOpen ? 'Hide' : 'Show more'}
    </material_1.Button>);
};
exports.default = ShowMoreButton;
//# sourceMappingURL=ShowMoreButton.js.map