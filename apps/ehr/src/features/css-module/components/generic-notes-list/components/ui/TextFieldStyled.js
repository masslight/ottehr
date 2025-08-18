"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextFieldStyled = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var TextFieldStyled = function (props) { return (<material_1.TextField variant="outlined" fullWidth autoComplete="off" sx={{
        pr: 2,
        height: '100%',
        '& .MuiOutlinedInput-root': {
            height: '100%',
        },
        '& .MuiInputLabel-root': {
            color: 'text.secondary',
        },
    }} {...props}/>); };
exports.TextFieldStyled = TextFieldStyled;
//# sourceMappingURL=TextFieldStyled.js.map