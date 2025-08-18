"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFieldToRules = void 0;
exports.mapFieldToRules = {
    firstName: {
        required: true,
    },
    lastName: {
        required: true,
    },
    dob: {
        required: true,
        validate: function (value) {
            if (!(value === null || value === void 0 ? void 0 : value.isValid)) {
                return 'Provide correct date';
            }
            return;
        },
    },
    sex: {
        required: true,
    },
    phone: {
        required: true,
        validate: function (value) {
            if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(value)) {
                return 'Provide correct phone number';
            }
            return;
        },
    },
    address: {
        required: true,
    },
    city: {
        required: true,
    },
    state: {
        required: true,
    },
    zip: {
        required: true,
        validate: function (value) {
            if (!/^\d{5}$/.test(value)) {
                return 'Provide correct ZIP';
            }
            return;
        },
    },
    relationship: {
        required: true,
    },
    planAndPayor: {
        required: true,
    },
    insuredID: {
        required: true,
    },
};
//# sourceMappingURL=form-values.helper.js.map