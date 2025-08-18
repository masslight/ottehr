"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoundedButton = void 0;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
exports.RoundedButton = (0, material_1.styled)(function (props) { return (<lab_1.LoadingButton variant="outlined" size="large" {...props} {...(props.to ? { component: react_router_dom_1.Link, to: props.to, target: props.target } : {})}/>); })(function () { return ({
    whiteSpace: 'nowrap',
    minWidth: 'auto',
    borderRadius: 100,
    width: 'fit-content',
    root: {
        '&.Mui-disabled': {
            pointerEvents: 'auto',
        },
    },
    textTransform: 'none',
    fontWeight: 500,
    fontSize: 14,
}); });
//# sourceMappingURL=RoundedButton.js.map