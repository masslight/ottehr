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
var _VisitsPage_page;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisitsPage = void 0;
exports.expectVisitsPage = expectVisitsPage;
exports.openVisitsPage = openVisitsPage;
var test_1 = require("@playwright/test");
var data_test_ids_1 = require("../../../src/constants/data-test-ids");
var VisitsPage = /** @class */ (function () {
    function VisitsPage(page) {
        _VisitsPage_page.set(this, void 0);
        __classPrivateFieldSet(this, _VisitsPage_page, page, "f");
    }
    VisitsPage.prototype.verifyVisitPresent = function (appointmentId, time) {
        return __awaiter(this, void 0, void 0, function () {
            var visitLocator;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        visitLocator = __classPrivateFieldGet(this, _VisitsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dashboard.tableRowWrapper(appointmentId));
                        if (time) {
                            visitLocator = visitLocator.filter({ hasText: time });
                        }
                        return [4 /*yield*/, (0, test_1.expect)(visitLocator).toBeVisible()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.verifyVisitsStatus = function (appointmentId, visitStatus) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _VisitsPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.tableRowWrapper(appointmentId))
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.appointmentStatus)).toHaveText(visitStatus)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickIntakeButton = function (appointmentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.tableRowWrapper(appointmentId))
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.intakeButton)
                            .click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickVisitDetailsButton = function (appointmentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.tableRowWrapper(appointmentId))
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.visitDetailsButton)
                            .click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickProgressNoteButton = function (appointmentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.tableRowWrapper(appointmentId))
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.progressNoteButton)
                            .click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickArrivedButton = function (appointmentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.tableRowWrapper(appointmentId))
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.arrivedButton)
                            .click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickOnPatientName = function (appointmentId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f")
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.tableRowWrapper(appointmentId))
                            .getByTestId(data_test_ids_1.dataTestIds.dashboard.patientName)
                            .click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickChatButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dashboard.chatButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickPrebookedTab = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dashboard.prebookedTab).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").waitForTimeout(15000)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickInOfficeTab = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dashboard.inOfficeTab).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").waitForTimeout(15000)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickDischargedTab = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dashboard.dischargedTab).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").waitForTimeout(15000)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickCancelledTab = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dashboard.cancelledTab).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").waitForTimeout(15000)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.selectLocation = function (locationName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dashboard.locationSelect).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").locator("li[role=\"option\"]:has-text(\"".concat(locationName, "\")")).first().click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.selectGroup = function (groupName) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dashboard.groupSelect).click()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").getByText(new RegExp(groupName, 'i')).click()];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    VisitsPage.prototype.clickAddPatientButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _VisitsPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dashboard.addPatientButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    return VisitsPage;
}());
exports.VisitsPage = VisitsPage;
_VisitsPage_page = new WeakMap();
function expectVisitsPage(page) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.waitForURL(/visits/)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, new VisitsPage(page)];
            }
        });
    });
}
function openVisitsPage(page) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.goto("/visits")];
                case 1:
                    _a.sent();
                    return [2 /*return*/, expectVisitsPage(page)];
            }
        });
    });
}
//# sourceMappingURL=VisitsPage.js.map