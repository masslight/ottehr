"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InformationCard = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var InformationCard = function (_a) {
    var title = _a.title, fields = _a.fields;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Paper sx={{
            marginTop: 2,
            padding: 3,
        }}>
      {title && (<material_1.Typography variant="h4" color={theme.palette.primary.dark} sx={{ mb: 2 }}>
          {title}
        </material_1.Typography>)}
      <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
        {(fields || []).map(function (field, index) { return (<react_1.Fragment key={index}>
            <material_1.Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '5px',
            }}>
              <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', flex: '0 1 50%' }}>
                <material_1.Typography sx={{ color: theme.palette.primary.dark }}>{field.label || ''}</material_1.Typography>
                {field.icon}
              </material_1.Box>
              <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <material_1.Typography>{field.value || '-'}</material_1.Typography>
                {field.button}
              </material_1.Box>
            </material_1.Box>
            {fields && index < fields.length - 1 && <material_1.Divider orientation="horizontal" flexItem/>}
          </react_1.Fragment>); })}
      </material_1.Box>
    </material_1.Paper>);
};
exports.InformationCard = InformationCard;
//# sourceMappingURL=InformationCard.js.map