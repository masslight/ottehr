"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var _PatientsPage_page;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsPage = void 0;
exports.expectPatientsPage = expectPatientsPage;
var test_1 = require("@playwright/test");
var data_test_ids_1 = require("../../../src/constants/data-test-ids");
var PageWithTablePagination_1 = require("./PageWithTablePagination");
var PatientsPage = /** @class */ (function (_super) {
    __extends(PatientsPage, _super);
    function PatientsPage(page) {
        var _this = _super.call(this, page) || this;
        _PatientsPage_page.set(_this, void 0);
        __classPrivateFieldSet(_this, _PatientsPage_page, page, "f");
        return _this;
    }
    PatientsPage.prototype.searchByLastName = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByLastNameField).locator('input').fill(name)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.searchByGivenNames = function (names) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByGivenNamesField).locator('input').fill(names)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.searchByDateOfBirth = function (dateOfBirth) {
        return __awaiter(this, void 0, void 0, function () {
            var locator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        locator = __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByDateOfBirthField).locator('input');
                        return [4 /*yield*/, locator.click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, locator.fill(dateOfBirth)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.searchByMobilePhone = function (phone) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByPhoneField).locator('input').fill(phone)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.searchByAddress = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByAddressField).locator('input').fill(address)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.searchByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByEmailField).locator('input').fill(email)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.searchByStatus = function (statusName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByStatusName).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByText(new RegExp(statusName, 'i')).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.searchByLocation = function (locationName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByLocationName).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByText(new RegExp(locationName, 'i')).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.clickSearchButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.clickResetFiltersButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.resetFiltersButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.verifyFilterReset = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByLastNameField).locator('input')).toBeEmpty()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByGivenNamesField).locator('input')).toBeEmpty()];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByDateOfBirthField).locator('input')).toBeEmpty()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByPhoneField).locator('input')).toBeEmpty()];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByAddressField).locator('input')).toBeEmpty()];
                    case 5:
                        _a.sent();
                        return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchByEmailField).locator('input')).toBeEmpty()];
                    case 6:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PatientsPage.prototype.verifyPatientPresent = function (patientInfo) {
        return __awaiter(this, void 0, void 0, function () {
            var patientPresent;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.findInPages(function () { return __awaiter(_this, void 0, void 0, function () {
                            var rowLocator, rowPatientId, rowPatientName, rowPatientDateOfBirth, rowPatientEmail, rowPatientPhoneNumber, rowPatientAddress, expectedName, normalizedExpectedPhone, normalizedActualPhone, expectedAddress, idMatch, nameMatch, dobMatch, emailMatch, phoneMatch, addressMatch, allMatches;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        rowLocator = __classPrivateFieldGet(this, _PatientsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.patients.searchResultRow(patientInfo.id));
                                        return [4 /*yield*/, rowLocator.isVisible()];
                                    case 1:
                                        if (!(_a.sent())) {
                                            console.log("\u274C Row for patient ID ".concat(patientInfo.id, " is not visible in current page"));
                                            return [2 /*return*/, false];
                                        }
                                        return [4 /*yield*/, rowLocator.getByTestId(data_test_ids_1.dataTestIds.patients.patientId).innerText()];
                                    case 2:
                                        rowPatientId = _a.sent();
                                        return [4 /*yield*/, rowLocator.getByTestId(data_test_ids_1.dataTestIds.patients.patientName).innerText()];
                                    case 3:
                                        rowPatientName = _a.sent();
                                        return [4 /*yield*/, rowLocator.getByTestId(data_test_ids_1.dataTestIds.patients.patientDateOfBirth).innerText()];
                                    case 4:
                                        rowPatientDateOfBirth = _a.sent();
                                        return [4 /*yield*/, rowLocator.getByTestId(data_test_ids_1.dataTestIds.patients.patientEmail).innerText()];
                                    case 5:
                                        rowPatientEmail = _a.sent();
                                        return [4 /*yield*/, rowLocator.getByTestId(data_test_ids_1.dataTestIds.patients.patientPhoneNumber).innerText()];
                                    case 6:
                                        rowPatientPhoneNumber = _a.sent();
                                        return [4 /*yield*/, rowLocator.getByTestId(data_test_ids_1.dataTestIds.patients.patientAddress).innerText()];
                                    case 7:
                                        rowPatientAddress = _a.sent();
                                        expectedName = patientInfo.lastName + ', ' + patientInfo.firstName;
                                        normalizedExpectedPhone = patientInfo.phoneNumber.replace(/[^\d]/g, '');
                                        normalizedActualPhone = rowPatientPhoneNumber.replace(/^(\+1)/, '').replace(/[^\d]/g, '');
                                        expectedAddress = patientInfo.address;
                                        idMatch = rowPatientId === patientInfo.id;
                                        nameMatch = rowPatientName === expectedName;
                                        dobMatch = rowPatientDateOfBirth === patientInfo.dateOfBirth;
                                        emailMatch = rowPatientEmail === patientInfo.email;
                                        phoneMatch = normalizedActualPhone === normalizedExpectedPhone;
                                        addressMatch = rowPatientAddress === expectedAddress;
                                        allMatches = idMatch && nameMatch && dobMatch && emailMatch && phoneMatch && addressMatch;
                                        if (!allMatches) {
                                            console.log("\u274C Patient verification failed for ID: ".concat(patientInfo.id));
                                            if (!idMatch) {
                                                console.log("  - ID mismatch:\n              Expected: \"".concat(patientInfo.id, "\"\n              Actual:   \"").concat(rowPatientId, "\""));
                                            }
                                            if (!nameMatch) {
                                                console.log("  - Name mismatch:\n              Expected: \"".concat(expectedName, "\"\n              Actual:   \"").concat(rowPatientName, "\""));
                                            }
                                            if (!dobMatch) {
                                                console.log("  - Date of Birth mismatch:\n              Expected: \"".concat(patientInfo.dateOfBirth, "\"\n              Actual:   \"").concat(rowPatientDateOfBirth, "\""));
                                            }
                                            if (!emailMatch) {
                                                console.log("  - Email mismatch:\n              Expected: \"".concat(patientInfo.email, "\"\n              Actual:   \"").concat(rowPatientEmail, "\""));
                                            }
                                            if (!phoneMatch) {
                                                console.log("  - Phone Number mismatch:\n              Expected: \"".concat(patientInfo.phoneNumber, "\" (normalized: \"").concat(normalizedExpectedPhone, "\")\n              Actual:   \"").concat(rowPatientPhoneNumber, "\" (normalized: \"").concat(normalizedActualPhone, "\")"));
                                            }
                                            if (!addressMatch) {
                                                console.log("  - Address mismatch:\n              Expected: \"".concat(JSON.stringify(expectedAddress), "\"\n              Actual:   \"").concat(JSON.stringify(rowPatientAddress), "\""));
                                            }
                                        }
                                        return [2 /*return*/, allMatches];
                                }
                            });
                        }); }, function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: 
                                    // Ensure search results update after response is received
                                    return [4 /*yield*/, __classPrivateFieldGet(this, _PatientsPage_page, "f")
                                            .getByTestId(/search-result-row-/i)
                                            .first()
                                            .waitFor({ state: 'attached' })];
                                    case 1:
                                        // Ensure search results update after response is received
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1:
                        patientPresent = _a.sent();
                        return [4 /*yield*/, test_1.expect.soft(patientPresent).toBe(true)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return PatientsPage;
}(PageWithTablePagination_1.PageWithTablePagination));
exports.PatientsPage = PatientsPage;
_PatientsPage_page = new WeakMap();
function expectPatientsPage(page) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.waitForURL('/patients')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, page.locator('p').getByText('Set up search filter and press Search to find patients').isVisible()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, new PatientsPage(page)];
            }
        });
    });
}
//# sourceMappingURL=PatientsPage.js.map