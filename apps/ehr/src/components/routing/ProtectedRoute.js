"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtectedRoute = void 0;
var auth0_react_1 = require("@auth0/auth0-react");
var LoadingScreen_1 = require("../LoadingScreen");
var ProtectedRoute = function (props) {
    var _a = (0, auth0_react_1.useAuth0)(), isAuthenticated = _a.isAuthenticated, isLoading = _a.isLoading, loginWithRedirect = _a.loginWithRedirect;
    if (!isAuthenticated && isLoading) {
        return <LoadingScreen_1.LoadingScreen />;
    }
    if (!isAuthenticated && !isLoading) {
        loginWithRedirect().catch(function (error) {
            throw new Error("Error calling loginWithRedirect Auth0 ".concat(error));
        });
    }
    return props.showWhenAuthenticated;
};
exports.ProtectedRoute = ProtectedRoute;
//# sourceMappingURL=ProtectedRoute.js.map