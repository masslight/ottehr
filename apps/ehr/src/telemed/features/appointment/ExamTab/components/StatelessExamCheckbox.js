"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatelessExamCheckbox = void 0;
var material_1 = require("@mui/material");
var StatelessExamCheckbox = function (props) {
    var label = props.label, abnormal = props.abnormal, checked = props.checked, onChange = props.onChange, disabled = props.disabled;
    var theme = (0, material_1.useTheme)();
    return (<material_1.FormControlLabel sx={{ m: 0 }} control={<material_1.Checkbox size="small" disabled={disabled} sx={{
                '&.Mui-checked': {
                    color: disabled ? undefined : abnormal ? theme.palette.error.main : theme.palette.success.main,
                },
                p: 0.5,
            }} checked={checked} onChange={function (e) { return onChange && onChange(e.target.checked); }}/>} label={label ? <material_1.Typography fontWeight={checked && abnormal ? 600 : 400}>{label}</material_1.Typography> : undefined}/>);
};
exports.StatelessExamCheckbox = StatelessExamCheckbox;
//# sourceMappingURL=StatelessExamCheckbox.js.map