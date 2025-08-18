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
var _OrderMedicationPage_page, _OrderMedicationPage_editMedicationCard;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderMedicationPage = void 0;
exports.expectOrderMedicationPage = expectOrderMedicationPage;
exports.expectEditOrderPage = expectEditOrderPage;
var test_1 = require("@playwright/test");
var data_test_ids_1 = require("../../../src/constants/data-test-ids");
var CssHeader_1 = require("./CssHeader");
var EditMedicationCard_1 = require("./EditMedicationCard");
var InHouseMedicationsPage_1 = require("./in-person/InHouseMedicationsPage");
var SideMenu_1 = require("./SideMenu");
var OrderMedicationPage = /** @class */ (function () {
    function OrderMedicationPage(page) {
        _OrderMedicationPage_page.set(this, void 0);
        _OrderMedicationPage_editMedicationCard.set(this, void 0);
        __classPrivateFieldSet(this, _OrderMedicationPage_page, page, "f");
        __classPrivateFieldSet(this, _OrderMedicationPage_editMedicationCard, new EditMedicationCard_1.EditMedicationCard(__classPrivateFieldGet(this, _OrderMedicationPage_page, "f")), "f");
    }
    OrderMedicationPage.prototype.cssHeader = function () {
        return new CssHeader_1.CssHeader(__classPrivateFieldGet(this, _OrderMedicationPage_page, "f"));
    };
    OrderMedicationPage.prototype.sideMenu = function () {
        return new SideMenu_1.SideMenu(__classPrivateFieldGet(this, _OrderMedicationPage_page, "f"));
    };
    Object.defineProperty(OrderMedicationPage.prototype, "editMedicationCard", {
        get: function () {
            return __classPrivateFieldGet(this, _OrderMedicationPage_editMedicationCard, "f");
        },
        enumerable: false,
        configurable: true
    });
    OrderMedicationPage.prototype.verifyFillOrderToSaveButtonDisabled = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, test_1.expect)(__classPrivateFieldGet(this, _OrderMedicationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.orderMedicationPage.fillOrderToSaveButton)).toBeDisabled()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    OrderMedicationPage.prototype.clickOrderMedicationButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _OrderMedicationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.orderMedicationPage.fillOrderToSaveButton).click()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    OrderMedicationPage.prototype.clickBackButton = function () {
        return __awaiter(this, void 0, void 0, function () {
            var dialog;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, __classPrivateFieldGet(this, _OrderMedicationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.orderMedicationPage.backButton).click()];
                    case 1:
                        _a.sent();
                        dialog = __classPrivateFieldGet(this, _OrderMedicationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.cssModal.confirmationDialogue);
                        return [4 /*yield*/, dialog.waitFor({ state: 'visible', timeout: 500 }).catch(function () { return null; })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, dialog.isVisible()];
                    case 3:
                        if (!_a.sent()) return [3 /*break*/, 5];
                        return [4 /*yield*/, __classPrivateFieldGet(this, _OrderMedicationPage_page, "f").getByTestId(data_test_ids_1.dataTestIds.dialog.cancelButton).click()];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/, (0, InHouseMedicationsPage_1.expectInHouseMedicationsPage)(__classPrivateFieldGet(this, _OrderMedicationPage_page, "f"))];
                }
            });
        });
    };
    return OrderMedicationPage;
}());
exports.OrderMedicationPage = OrderMedicationPage;
_OrderMedicationPage_page = new WeakMap(), _OrderMedicationPage_editMedicationCard = new WeakMap();
function expectOrderMedicationPage(page) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.waitForURL(new RegExp('/in-person/.*/in-house-medication/order/new'))];
                case 1:
                    _a.sent();
                    return [2 /*return*/, new OrderMedicationPage(page)];
            }
        });
    });
}
function expectEditOrderPage(page) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, page.waitForURL(new RegExp('/in-person/.*/in-house-medication/order/edit/.*'))];
                case 1:
                    _a.sent();
                    return [2 /*return*/, new OrderMedicationPage(page)];
            }
        });
    });
}
//# sourceMappingURL=OrderMedicationPage.js.map