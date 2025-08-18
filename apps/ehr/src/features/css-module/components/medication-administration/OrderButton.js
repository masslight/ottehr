"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderButton = void 0;
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var helpers_1 = require("../../routing/helpers");
var RoundedButton_1 = require("../RoundedButton");
var OrderButton = function (_a) {
    var _b = _a.size, size = _b === void 0 ? 'medium' : _b, sx = _a.sx, dataTestId = _a.dataTestId;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var onClick = function () {
        if (!appointmentId) {
            (0, notistack_1.enqueueSnackbar)('navigation error', { variant: 'error' });
            return;
        }
        navigate((0, helpers_1.getNewOrderUrl)(appointmentId));
    };
    return (<RoundedButton_1.ButtonRounded variant="contained" color="primary" size={size} onClick={onClick} sx={__assign({ py: 1, px: 5 }, sx)} data-testid={dataTestId}>
      Order
    </RoundedButton_1.ButtonRounded>);
};
exports.OrderButton = OrderButton;
//# sourceMappingURL=OrderButton.js.map