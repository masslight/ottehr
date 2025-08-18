"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamReviewItem = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var ExamReviewItem = function (props) {
    var label = props.label, abnormal = props.abnormal, radio = props.radio, value = props.value;
    var theme = (0, material_1.useTheme)();
    return radio ? (<material_1.Typography fontWeight={abnormal === value ? 700 : undefined}>
      {label} - {value ? 'Yes' : 'No'}
    </material_1.Typography>) : (<material_1.Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <material_1.Box component="span" sx={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: abnormal ? theme.palette.error.main : theme.palette.success.main,
        }}/>
      <material_1.Typography fontWeight={abnormal ? 700 : undefined}>{label}</material_1.Typography>
    </material_1.Box>);
};
exports.ExamReviewItem = ExamReviewItem;
//# sourceMappingURL=ExamReviewItem.js.map