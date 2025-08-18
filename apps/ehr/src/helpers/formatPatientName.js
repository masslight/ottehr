"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPatientName = formatPatientName;
function formatPatientName(_a) {
    var lastName = _a.lastName, firstName = _a.firstName, middleName = _a.middleName, nickname = _a.nickname;
    var result = "".concat(lastName, ", ").concat(firstName);
    if (middleName) {
        result += ", ".concat(middleName);
    }
    if (nickname) {
        result += " (".concat(nickname, ")");
    }
    return result;
}
//# sourceMappingURL=formatPatientName.js.map