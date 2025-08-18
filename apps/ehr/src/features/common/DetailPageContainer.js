"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DetailPageContainer;
var material_1 = require("@mui/material");
function DetailPageContainer(_a) {
    var children = _a.children;
    return (<material_1.Stack id="detail-page-container" spacing={2} sx={{ p: 0, maxWidth: '680px !important', mx: 'auto', width: '100%' }}>
      {children}
    </material_1.Stack>);
}
//# sourceMappingURL=DetailPageContainer.js.map