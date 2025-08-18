"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AiSuggestion;
var icons_1 = require("@ehrTheme/icons");
var material_1 = require("@mui/material");
var react_1 = require("react");
function AiSuggestion(_a) {
    var title = _a.title, content = _a.content, hideHeader = _a.hideHeader;
    return (<material_1.Box>
      {hideHeader !== true ? (<material_1.Box style={{
                display: 'flex',
                background: '#FFF9EF',
                borderRadius: '8px',
                padding: '4px 8px 4px 8px',
                marginBottom: '8px',
                alignItems: 'center',
            }}>
          <img src={icons_1.ottehrAiIcon} style={{ width: '30px', marginRight: '8px' }}/>
          <material_1.Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
            OYSTEHR AI
          </material_1.Typography>
        </material_1.Box>) : undefined}
      <material_1.Box style={{
            background: '#FFF9EF',
            borderRadius: '8px',
            padding: '8px',
        }}>
        <material_1.Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
          {title}
        </material_1.Typography>
        <material_1.Typography variant="body1">{content}</material_1.Typography>
      </material_1.Box>
    </material_1.Box>);
}
//# sourceMappingURL=AiSuggestion.js.map