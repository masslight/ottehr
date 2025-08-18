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
var _AddPatientPage_page;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPatientPage = void 0;
exports.expectAddPatientPage = expectAddPatientPage;
exports.openAddPatientPage = openAddPatientPage;
var test_1 = require("@playwright/test");
var data_test_ids_1 = require("../../../src/constants/data-test-ids");
var AddPatientPage = /** @class */ (function () {
    function AddPatientPage(page) {
        _AddPatientPage_page.set(this, void 0);
        __classPrivateFieldSet(this, _AddPatientPage_page, page, "f");
    }
    AddPatientPage.prototype.selectOffice = function (officeName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dashboard.locationSelect).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").locator("li[role=\"option\"]:has-text(\"".concat(officeName, "\")")).first().click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.enterMobilePhone = function (phone) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.mobilePhoneInput).locator('input').fill(phone)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.verifyMobilePhoneNumberValidationErrorShown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _AddPatientPage_page, "f").locator('p:text("Phone number must be 10 digits in the format (xxx) xxx-xxxx")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.verifySearchForPatientsErrorShown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _AddPatientPage_page, "f").locator('p:text("Please search for patients before adding")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.clickSearchForPatientsButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.searchForPatientsButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.clickAddButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.addButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.clickCancelButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.cancelButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.verifyPageStillOpened = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").waitForTimeout(1000)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, expectAddPatientPage(__classPrivateFieldGet(this, _AddPatientPage_page, "f"))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.clickPatientNotFoundButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.patientNotFoundButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.enterFirstName = function (firstName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.firstNameInput).locator('input').fill(firstName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.enterLastName = function (lastName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.lastNameInput).locator('input').fill(lastName)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.enterDateOfBirth = function (dateOfBirth) {
        return __awaiter(this, void 0, void 0, function () {
            var locator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        locator = __classPrivateFieldGet(this, _AddPatientPage_page, "f").locator('[placeholder="MM/DD/YYYY"]');
                        return [4 /*yield*/, locator.click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").waitForTimeout(2000)];
                    case 2:
                        _a.sent();
                        // just because of date input for some reason not accepting wrong date
                        return [4 /*yield*/, locator.pressSequentially(dateOfBirth)];
                    case 3:
                        // just because of date input for some reason not accepting wrong date
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.selectSexAtBirth = function (sexAtBirth) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.sexAtBirthDropdown).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByText(sexAtBirth, { exact: true }).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.selectReasonForVisit = function (reasonForVisit) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.reasonForVisitDropdown).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByText(reasonForVisit).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.selectVisitType = function (visitType) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.visitTypeDropdown).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByText(visitType).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.verifyDateFormatValidationErrorShown = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _AddPatientPage_page, "f").locator('p:text("please enter date in format MM/DD/YYYY")')).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.selectExistingPatient = function (existingPatient) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByLabel(existingPatient).first().check()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.clickPrefillForButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.prefillForButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.verifyPrefilledPatientName = function (patientName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.prefilledPatientName).getByText(patientName)).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.verifyPrefilledPatientBirthday = function (patientBirthday) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.prefilledPatientBirthday).getByText(patientBirthday)).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.verifyPrefilledPatientBirthSex = function (patientBirthSex) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.prefilledPatientBirthSex).getByText(patientBirthSex)).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.verifyPrefilledPatientEmail = function (patientEmail) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.addPatientPage.prefilledPatientEmail).getByText(patientEmail)).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AddPatientPage.prototype.selectFirstAvailableSlot = function () {
        return __awaiter(this, void 0, void 0, function () {
            var buttonLocator;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        buttonLocator = __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.slots.slot).first();
                        return [4 /*yield*/, buttonLocator.click()];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, buttonLocator.textContent()];
                    case 2: return [2 /*return*/, (_a = (_b.sent())) !== null && _a !== void 0 ? _a : ''];
                }
            });
        });
    };
    AddPatientPage.prototype.clickCloseSelectDateWarningDialog = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _AddPatientPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dialog.closeButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return AddPatientPage;
}());
exports.AddPatientPage = AddPatientPage;
_AddPatientPage_page = new WeakMap();
function expectAddPatientPage(page) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.waitForURL("/visits/add")];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, test_1.expect)(page.locator('h3').getByText('Add Patient')).toBeVisible()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, new AddPatientPage(page)];
            }
        });
    });
}
function openAddPatientPage(page) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("/visits/add")];
                case 1:
                    _a.sent();
                    return [2 /*return*/, expectAddPatientPage(page)];
            }
        });
    });
}
//# sourceMappingURL=AddPatientPage.js.map