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
Object.defineProperty(exports, "__esModule", { value: true });
var test_1 = require("@playwright/test");
var StateDetailsPage_1 = require("../page/StateDetailsPage");
var StatesPage_1 = require("../page/StatesPage");
test_1.test.beforeEach(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, page.waitForTimeout(2000)];
            case 1:
                _c.sent(); // TODO what is this actually waiting for? Replace it with something faster.
                return [4 /*yield*/, page.goto('/telemed-admin/states')];
            case 2:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Open "States page", enter state abbreviation,  correct search result is displayed', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var statesPage, state;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, StatesPage_1.expectStatesPage)(page)];
            case 1:
                statesPage = _c.sent();
                return [4 /*yield*/, statesPage.getFirstState()];
            case 2:
                state = _c.sent();
                return [4 /*yield*/, statesPage.searchStates(state)];
            case 3:
                _c.sent();
                return [4 /*yield*/, statesPage.verifyStatePresent(state)];
            case 4:
                _c.sent();
                return [4 /*yield*/, statesPage.verifyPaginationState('1–1 of 1')];
            case 5:
                _c.sent();
                return [4 /*yield*/, statesPage.searchStates('AA')];
            case 6:
                _c.sent();
                return [4 /*yield*/, statesPage.verifyPaginationState('0–0 of 0')];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Open "States page", click on state,  state details page is opened', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var statesPage, state;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, StatesPage_1.expectStatesPage)(page)];
            case 1:
                statesPage = _c.sent();
                return [4 /*yield*/, statesPage.getFirstState()];
            case 2:
                state = _c.sent();
                return [4 /*yield*/, statesPage.clickState(state)];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, StateDetailsPage_1.expectStateDetailsPage)(state, page)];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Open "States details page", click cancel button,  states page is opened', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var statesPage, state, stateDetailsPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, StatesPage_1.expectStatesPage)(page)];
            case 1:
                statesPage = _c.sent();
                return [4 /*yield*/, statesPage.getFirstState()];
            case 2:
                state = _c.sent();
                return [4 /*yield*/, statesPage.clickState(state)];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, StateDetailsPage_1.expectStateDetailsPage)(state, page)];
            case 4:
                stateDetailsPage = _c.sent();
                return [4 /*yield*/, stateDetailsPage.clickCancelButton()];
            case 5:
                _c.sent();
                return [4 /*yield*/, (0, StatesPage_1.expectStatesPage)(page)];
            case 6:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Open "States details page", check title and state name field,  verify state name is correct in title', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var statesPage, state, stateDetailsPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, StatesPage_1.expectStatesPage)(page)];
            case 1:
                statesPage = _c.sent();
                return [4 /*yield*/, statesPage.getFirstState()];
            case 2:
                state = _c.sent();
                return [4 /*yield*/, statesPage.clickState(state)];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, StateDetailsPage_1.expectStateDetailsPage)(state, page)];
            case 4:
                stateDetailsPage = _c.sent();
                return [4 /*yield*/, stateDetailsPage.verifyStateNameTitle(state)];
            case 5:
                _c.sent();
                return [4 /*yield*/, stateDetailsPage.verifyStateNameField(state)];
            case 6:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, test_1.test)('Open "States details page", toggle "Operate in state" and save changes, verify changes are saved', function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var statesPage, state, stateDetailsPage;
    var page = _b.page;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, StatesPage_1.expectStatesPage)(page)];
            case 1:
                statesPage = _c.sent();
                return [4 /*yield*/, statesPage.getFirstState()];
            case 2:
                state = _c.sent();
                return [4 /*yield*/, statesPage.clickState(state)];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, StateDetailsPage_1.expectStateDetailsPage)(state, page)];
            case 4:
                stateDetailsPage = _c.sent();
                return [4 /*yield*/, stateDetailsPage.isToggleOn()];
            case 5:
                if (!_c.sent()) return [3 /*break*/, 12];
                return [4 /*yield*/, stateDetailsPage.setToggleOff()];
            case 6:
                _c.sent();
                return [4 /*yield*/, stateDetailsPage.clickSaveChangesButton()];
            case 7:
                _c.sent();
                return [4 /*yield*/, stateDetailsPage.reloadStateDetailsPage()];
            case 8:
                _c.sent();
                return [4 /*yield*/, stateDetailsPage.verifyToggleOff()];
            case 9:
                _c.sent();
                return [4 /*yield*/, (0, StatesPage_1.openStatesPage)(page)];
            case 10:
                statesPage = _c.sent();
                return [4 /*yield*/, statesPage.verifyOperateInState(state, false)];
            case 11:
                _c.sent();
                return [3 /*break*/, 19];
            case 12: return [4 /*yield*/, stateDetailsPage.setToggleOn()];
            case 13:
                _c.sent();
                return [4 /*yield*/, stateDetailsPage.clickSaveChangesButton()];
            case 14:
                _c.sent();
                return [4 /*yield*/, stateDetailsPage.reloadStateDetailsPage()];
            case 15:
                _c.sent();
                return [4 /*yield*/, stateDetailsPage.verifyToggleOn()];
            case 16:
                _c.sent();
                return [4 /*yield*/, (0, StatesPage_1.openStatesPage)(page)];
            case 17:
                statesPage = _c.sent();
                return [4 /*yield*/, statesPage.verifyOperateInState(state, true)];
            case 18:
                _c.sent();
                _c.label = 19;
            case 19: return [2 /*return*/];
        }
    });
}); });
//# sourceMappingURL=statesPage.spec.js.map