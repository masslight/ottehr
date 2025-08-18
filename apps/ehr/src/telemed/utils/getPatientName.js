"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatientName = void 0;
var getPatientName = function (name) {
    var _a, _b, _c, _d, _e;
    var firstName = (_b = (_a = name === null || name === void 0 ? void 0 : name[0]) === null || _a === void 0 ? void 0 : _a.given) === null || _b === void 0 ? void 0 : _b[0];
    var lastName = (_c = name === null || name === void 0 ? void 0 : name[0]) === null || _c === void 0 ? void 0 : _c.family;
    var middleName = (_e = (_d = name === null || name === void 0 ? void 0 : name[0]) === null || _d === void 0 ? void 0 : _d.given) === null || _e === void 0 ? void 0 : _e[1];
    // const suffix = name?.[0]?.suffix?.[0];
    // const isFullName = !!firstName && !!lastName && !!suffix;
    var isFullName = !!firstName && !!lastName;
    var firstLastName = isFullName ? "".concat(firstName, " ").concat(lastName) : undefined;
    var lastFirstName = isFullName ? "".concat(lastName, ", ").concat(firstName) : undefined;
    // const firstLastName = isFullName ? `${firstName} ${lastName}${suffix ? ` ${suffix}` : ''}` : undefined;
    // const lastFirstName = isFullName ? `${lastName}${suffix ? ` ${suffix}` : ''}, ${firstName}` : undefined;
    var firstMiddleLastName = [firstName, middleName, lastName].filter(function (x) { return !!x; }).join(' ') || undefined;
    var lastFirstMiddleName = [lastName, firstName, middleName].filter(function (x) { return !!x; }).join(', ') || undefined;
    return {
        firstName: firstName,
        lastName: lastName,
        middleName: middleName,
        isFullName: isFullName,
        firstLastName: firstLastName,
        lastFirstName: lastFirstName,
        // suffix,
        firstMiddleLastName: firstMiddleLastName,
        lastFirstMiddleName: lastFirstMiddleName,
    };
};
exports.getPatientName = getPatientName;
//# sourceMappingURL=getPatientName.js.map