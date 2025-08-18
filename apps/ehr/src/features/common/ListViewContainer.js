"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ListViewContainer;
var material_1 = require("@mui/material");
function ListViewContainer(_a) {
    var children = _a.children;
    return (<material_1.Box id="list-view-container" sx={{ p: 0, maxWidth: '1536px !important', mx: 'auto', width: '100%' }}>
      {children}
    </material_1.Box>);
}
//# sourceMappingURL=ListViewContainer.js.map