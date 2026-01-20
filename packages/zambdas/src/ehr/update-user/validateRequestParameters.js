"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequestParameters = validateRequestParameters;
var utils_1 = require("utils");
function validateRequestParameters(input) {
    if (!input.body) {
        throw new Error('No request body provided');
    }
    var _a = JSON.parse(input.body), userId = _a.userId, firstName = _a.firstName, middleName = _a.middleName, lastName = _a.lastName, providerType = _a.providerType, providerTypeText = _a.providerTypeText, selectedRoles = _a.selectedRoles, licenses = _a.licenses, phoneNumber = _a.phoneNumber, npi = _a.npi, birthDate = _a.birthDate, faxNumber = _a.faxNumber, addressLine1 = _a.addressLine1, addressLine2 = _a.addressLine2, addressCity = _a.addressCity, addressState = _a.addressState, addressZip = _a.addressZip;
    if (userId === undefined
    // locations === undefined ||
    // locations.length === 0
    ) {
        throw new Error('These fields are required: "userId"');
    }
    if (phoneNumber && !(0, utils_1.isPhoneNumberValid)(phoneNumber)) {
        throw new Error('Invalid phone number');
    }
    if ((selectedRoles === null || selectedRoles === void 0 ? void 0 : selectedRoles.includes(utils_1.RoleType.Provider)) && npi && !(0, utils_1.isNPIValid)(npi)) {
        throw new Error('Invalid NPI format');
    }
    if (selectedRoles) {
        for (var _i = 0, selectedRoles_1 = selectedRoles; _i < selectedRoles_1.length; _i++) {
            var role = selectedRoles_1[_i];
            if (!Object.values(utils_1.RoleType).includes(role))
                throw new Error("Invalid roles selected. Role must be one of \"".concat(Object.values(utils_1.RoleType).join('", "'), "\". Received \"").concat(role, "\""));
        }
    }
    if (providerType) {
        if (!(0, utils_1.isProviderTypeCode)(providerType)) {
            throw new Error("Invalid providerType. Must be one of \"".concat(utils_1.PROVIDER_TYPE_VALUES.join('", "'), "\". Received \"").concat(providerType, "\""));
        }
        if (providerType === 'other' && (!providerTypeText || !providerTypeText.trim())) {
            throw new Error('providerTypeText is required when providerType is "other"');
        }
    }
    return {
        userId: userId,
        firstName: firstName ? firstName.trim() : firstName,
        middleName: middleName ? middleName.trim() : middleName,
        lastName: lastName ? lastName.trim() : lastName,
        providerType: providerType,
        providerTypeText: providerTypeText ? providerTypeText.trim() : providerTypeText,
        selectedRoles: selectedRoles,
        licenses: licenses,
        // locations,
        phoneNumber: phoneNumber ? phoneNumber.trim() : phoneNumber,
        npi: npi ? npi.trim() : npi,
        secrets: input.secrets,
        birthDate: birthDate ? birthDate.trim() : birthDate,
        faxNumber: faxNumber ? faxNumber.trim() : faxNumber,
        addressLine1: addressLine1 ? addressLine1.trim() : addressLine1,
        addressLine2: addressLine2 ? addressLine2.trim() : addressLine2,
        addressCity: addressCity ? addressCity.trim() : addressCity,
        addressState: addressState ? addressState.trim() : addressState,
        addressZip: addressZip ? addressZip.trim() : addressZip,
    };
}
