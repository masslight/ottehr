"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMixpanel = void 0;
var mixpanel_browser_1 = require("mixpanel-browser");
var react_1 = require("react");
var mixpanel_context_1 = require("../contexts/mixpanel.context");
var useMixpanel = function () {
    var mixpanelContext = (0, react_1.useContext)(mixpanel_context_1.MixpanelContext);
    if (!mixpanelContext.token) {
        console.warn('Mixpanel token is not set');
    }
    return function (mixpanelCall) {
        try {
            mixpanelCall(mixpanel_browser_1.default);
        }
        catch (_a) {
            console.warn("Mixpanel couldn't track the event");
        }
    };
};
exports.useMixpanel = useMixpanel;
//# sourceMappingURL=useMixpanel.js.map