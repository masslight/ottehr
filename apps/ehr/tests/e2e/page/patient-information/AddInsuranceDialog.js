"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AddInsuranceDialog_container;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddInsuranceDialog = void 0;
var test_1 = require("@playwright/test");
var data_test_ids_1 = require("../../../../src/constants/data-test-ids");
var AddInsuranceDialog = /** @class */ (function () {
    function AddInsuranceDialog(container) {
        _AddInsuranceDialog_container.set(this, void 0);
        __classPrivateFieldSet(this, _AddInsuranceDialog_container, container, "f");
    }
    AddInsuranceDialog.prototype.selectInsuranceType = function (type) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.type).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").page().locator("li:text(\"".concat(type, "\")")).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.selectInsuranceCarrier = function (insuranceCarrier) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.insuranceCarrier).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").page().locator("li:text(\"".concat(insuranceCarrier, "\")")).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.enterMemberId = function (memberId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.memberId).locator('input').fill(memberId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.clearMemberId = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.memberId).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.enterPolicyHolderFirstName = function (firstName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersFirstName)
                            .locator('input')
                            .fill(firstName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.clearPolicyHolderFirstName = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersFirstName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.enterPolicyHolderMiddleName = function (middleName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersMiddleName)
                            .locator('input')
                            .fill(middleName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.clearPolicyHolderMiddleName = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersMiddleName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.enterPolicyHolderLastName = function (lastName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersLastName)
                            .locator('input')
                            .fill(lastName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.clearPolicyHolderLastName = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersLastName).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.enterDateOfBirthFromAddInsuranceDialog = function (dateOfBirth) {
        return __awaiter(this, void 0, void 0, function () {
            var locator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        locator = __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersDateOfBirth)
                            .locator('input');
                        return [4 /*yield*/, locator.click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, locator.pressSequentially(dateOfBirth)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.clearDateOfBirthFromAddInsuranceDialog = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersDateOfBirth).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.selectPolicyHoldersBirthSex = function (birthSex) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.policyHoldersSex).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").page().locator("li:text-is(\"".concat(birthSex, "\")")).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.enterPolicyHolderStreetAddress = function (street) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.streetAddress).locator('input').fill(street)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.clearPolicyHolderStreetAddress = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.streetAddress).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.enterPolicyHolderAddressLine2 = function (addressLine2) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.addressLine2).locator('input').fill(addressLine2)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.enterPolicyHolderCity = function (city) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.city).locator('input').fill(city)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.clearPolicyHolderCity = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.city).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.selectPolicyHoldersState = function (state) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.state).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").page().locator("li:text(\"".concat(state, "\")")).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.enterZipFromAddInsuranceDialog = function (zip) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.zip).locator('input').fill(zip)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.clearZipFromAddInsuranceDialog = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.zip).locator('input').clear()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.verifyValidationErrorZipFieldFromAddInsurance = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.zip).locator('p:text("Must be 5 digits")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.selectPatientsRelationship = function (relationship) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.relationship).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").page().locator("li:text(\"".concat(relationship, "\")")).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.enterAdditionalInsuranceInformation = function (additionalInfo) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.additionalInformation)
                            .locator('input')
                            .fill(additionalInfo)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.clickAddInsuranceButtonFromAddInsuranceDialog = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.addInsuranceButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.verifyValidationErrorShown = function (testId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(testId).locator('p:text("This field is required")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddInsuranceDialog.prototype.verifyTypeField = function (value, enabled) {
        return __awaiter(this, void 0, void 0, function () {
            var locator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        locator = __classPrivateFieldGet(this, _AddInsuranceDialog_container, "f").getByTestId(data_test_ids_1.dataTestIds.addInsuranceDialog.type).locator('input');
                        return [4 /*yield*/, (0, test_1.expect)(locator).toHaveValue(value)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(locator).toBeEnabled({ enabled: enabled })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return AddInsuranceDialog;
}());
exports.AddInsuranceDialog = AddInsuranceDialog;
_AddInsuranceDialog_container = new WeakMap();
//# sourceMappingURL=AddInsuranceDialog.js.map