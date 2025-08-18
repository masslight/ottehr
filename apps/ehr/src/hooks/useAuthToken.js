"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAuthToken = useAuthToken;
var auth0_react_1 = require("@auth0/auth0-react");
var react_1 = require("react");
var _token = undefined;
function useAuthToken() {
    var _a = (0, auth0_react_1.useAuth0)(), isAuthenticated = _a.isAuthenticated, getAccessTokenSilently = _a.getAccessTokenSilently;
    var _b = (0, react_1.useState)(_token), token = _b[0], setToken = _b[1];
    (0, react_1.useEffect)(function () {
        if (isAuthenticated && !_token) {
            getAccessTokenSilently()
                .then(function (newToken) {
                _token = newToken;
                setToken(newToken);
            })
                .catch(function () { return console.error('Unable to get auth0 token'); });
        }
    }, [isAuthenticated, getAccessTokenSilently, setToken]);
    return token;
}
//# sourceMappingURL=useAuthToken.js.map