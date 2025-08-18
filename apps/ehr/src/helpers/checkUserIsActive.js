"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUserIsActive = checkUserIsActive;
function checkUserIsActive(user) {
    var _a;
    // If user has inactive role their access policy is an explicit deny all
    var userInactive = (_a = user.roles) === null || _a === void 0 ? void 0 : _a.find(function (role) { return role.name === 'Inactive'; });
    if (userInactive || user.roles.length == 0) {
        return false;
    }
    else {
        return true;
    }
}
//# sourceMappingURL=checkUserIsActive.js.map