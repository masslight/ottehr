"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MixpanelContextProvider = exports.MixpanelContext = void 0;
var mixpanel_browser_1 = require("mixpanel-browser");
var react_1 = require("react");
exports.MixpanelContext = (0, react_1.createContext)({ token: '' });
var MixpanelContextProvider = function (props) {
    var isMixpanelInitiated = (0, react_1.useRef)(false);
    var token = props.token, config = props.config, registerProps = props.registerProps;
    if (!token) {
        console.error('Mixpanel token is not set');
    }
    else if (!isMixpanelInitiated.current) {
        mixpanel_browser_1.default.init(token, config);
        if (registerProps) {
            mixpanel_browser_1.default.register(registerProps);
        }
        isMixpanelInitiated.current = true;
    }
    return <exports.MixpanelContext.Provider value={props}>{props.children}</exports.MixpanelContext.Provider>;
};
exports.MixpanelContextProvider = MixpanelContextProvider;
//# sourceMappingURL=mixpanel.context.js.map