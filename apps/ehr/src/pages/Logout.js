"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Logout;
var auth0_react_1 = require("@auth0/auth0-react");
var react_router_dom_1 = require("react-router-dom");
function Logout() {
    var _a = (0, auth0_react_1.useAuth0)(), isAuthenticated = _a.isAuthenticated, logout = _a.logout;
    if (!isAuthenticated) {
        (0, react_router_dom_1.redirect)('/');
    }
    void logout({
        logoutParams: { returnTo: import.meta.env.VITE_APP_OYSTEHR_APPLICATION_REDIRECT_URL, federated: true },
    });
    return <></>;
}
//# sourceMappingURL=Logout.js.map