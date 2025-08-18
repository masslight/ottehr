"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCSSPermissions = void 0;
var react_1 = require("react");
var useEvolveUser_1 = require("../../../hooks/useEvolveUser");
var useCSSPermissions = function () {
    var currentUser = (0, useEvolveUser_1.default)();
    var config = (0, react_1.useMemo)(function () { return ({
        isPending: !currentUser, // TODO suggested undefined will be for pending user, check if this is correct or unauthorized user is also undefined
        view: true, // restrict who has access to clinical support service features: Boolean(currentUser?.hasRole([RoleType.YourRole]))
    }); }, [currentUser]);
    return config;
};
exports.useCSSPermissions = useCSSPermissions;
//# sourceMappingURL=useCSSPermissions.js.map