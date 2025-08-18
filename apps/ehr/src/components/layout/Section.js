"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Section = void 0;
var material_1 = require("@mui/material");
var Section = function (_a) {
    var title = _a.title, children = _a.children, dataTestId = _a.dataTestId, titleWidget = _a.titleWidget;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Paper sx={{ p: 3 }} data-testid={dataTestId}>
      <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        }}>
        <material_1.Typography variant="h4" color={theme.palette.primary.dark} sx={{ mb: 2 }}>
          {title}
        </material_1.Typography>
        {titleWidget ? titleWidget : <></>}
      </material_1.Box>
      <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
        {children}
      </material_1.Box>
    </material_1.Paper>);
};
exports.Section = Section;
//# sourceMappingURL=Section.js.map