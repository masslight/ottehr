"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidationValuesByDOB = exports.isEmptyValidation = exports.isNumberValidation = exports.updateQuestionnaireResponse = void 0;
var luxon_1 = require("luxon");
var state_1 = require("../state");
var updateQuestionnaireResponse = function (questionnaireResponse, name, value) {
    var _a, _b;
    if (questionnaireResponse) {
        if ((_a = questionnaireResponse.item) === null || _a === void 0 ? void 0 : _a.find(function (item) { return item.linkId === name; })) {
            state_1.useAppointmentStore.setState({
                questionnaireResponse: __assign(__assign({}, questionnaireResponse), { item: (_b = questionnaireResponse === null || questionnaireResponse === void 0 ? void 0 : questionnaireResponse.item) === null || _b === void 0 ? void 0 : _b.map(function (item) {
                        return item.linkId === name ? __assign(__assign({}, item), { answer: [{ valueString: value }] }) : item;
                    }) }),
            });
        }
        else {
            var newItem = { linkId: name, answer: [{ valueString: value }] };
            if (!questionnaireResponse.item) {
                state_1.useAppointmentStore.setState({
                    questionnaireResponse: __assign(__assign({}, questionnaireResponse), { item: [newItem] }),
                });
            }
            else {
                state_1.useAppointmentStore.setState({
                    questionnaireResponse: __assign(__assign({}, questionnaireResponse), { item: __spreadArray(__spreadArray([], questionnaireResponse.item, true), [newItem], false) }),
                });
            }
        }
    }
};
exports.updateQuestionnaireResponse = updateQuestionnaireResponse;
var isNumberValidation = function (value) {
    if (isNaN(+value) || isNaN(parseFloat(value))) {
        return 'Value must be a number';
    }
    return;
};
exports.isNumberValidation = isNumberValidation;
var isEmptyValidation = function (value) {
    return value === '';
};
exports.isEmptyValidation = isEmptyValidation;
var getValidationValuesByDOB = function (dob) {
    var now = luxon_1.DateTime.now();
    var birthDate = luxon_1.DateTime.fromISO(dob);
    var age = now.diff(birthDate, 'years').years;
    for (var _i = 0, ageGroups_1 = ageGroups; _i < ageGroups_1.length; _i++) {
        var group = ageGroups_1[_i];
        if (age >= group.minAge && age < group.maxAge) {
            return group.value;
        }
    }
    throw new Error('Invalid BOD');
};
exports.getValidationValuesByDOB = getValidationValuesByDOB;
var ageGroups = [
    {
        minAge: 0,
        maxAge: 0.25,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 0.25,
        maxAge: 0.5,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 0.5,
        maxAge: 0.75,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 0.75,
        maxAge: 1,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 1,
        maxAge: 1.5,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 1.5,
        maxAge: 2,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 2,
        maxAge: 3,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 3,
        maxAge: 4,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 4,
        maxAge: 6,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 6,
        maxAge: 8,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 8,
        maxAge: 12,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 12,
        maxAge: 15,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 15,
        maxAge: 18,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
    {
        minAge: 18,
        maxAge: Infinity,
        value: {
            temperature: {
                high: 46,
            },
            pulse: {
                high: 100,
            },
            hr: {
                high: 290,
            },
            rr: {
                high: 90,
            },
        },
    },
];
//# sourceMappingURL=vitals-helper.js.map