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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("@testing-library/react");
var user_event_1 = require("@testing-library/user-event");
var react_hook_form_1 = require("react-hook-form");
var constants_1 = require("src/constants");
var data_test_ids_1 = require("src/constants/data-test-ids");
var vitest_1 = require("vitest");
var PrimaryCareContainer_1 = require("./PrimaryCareContainer");
vitest_1.vi.mock('../InputMask', function () { return __awaiter(void 0, void 0, void 0, function () {
    var React;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('react'); })];
            case 1:
                React = _a.sent();
                return [2 /*return*/, {
                        default: React.forwardRef(function (_a, ref) {
                            var onChange = _a.onChange, value = _a.value, rest = __rest(_a, ["onChange", "value"]);
                            return <input ref={ref} {...rest} onChange={onChange} value={value}/>;
                        }),
                    }];
        }
    });
}); });
var TestWrapper = function (_a) {
    var children = _a.children, _b = _a.defaultValues, defaultValues = _b === void 0 ? {} : _b;
    var TestForm = function () {
        var _a;
        var methods = (0, react_hook_form_1.useForm)({
            defaultValues: __assign((_a = {}, _a[constants_1.FormFields.primaryCarePhysician.active.key] = true, _a[constants_1.FormFields.primaryCarePhysician.firstName.key] = '', _a[constants_1.FormFields.primaryCarePhysician.lastName.key] = '', _a[constants_1.FormFields.primaryCarePhysician.practiceName.key] = '', _a[constants_1.FormFields.primaryCarePhysician.address.key] = '', _a[constants_1.FormFields.primaryCarePhysician.phone.key] = '', _a), defaultValues),
        });
        return <react_hook_form_1.FormProvider {...methods}>{children}</react_hook_form_1.FormProvider>;
    };
    return <TestForm />;
};
var getFieldInput = function (fieldTestId) {
    return react_1.screen.getByTestId(fieldTestId).querySelector('input');
};
(0, vitest_1.describe)('PrimaryCareContainer', function () {
    var _a;
    var user = user_event_1.default.setup();
    var filledFieldValues = (_a = {},
        _a[constants_1.FormFields.primaryCarePhysician.active.key] = true,
        _a[constants_1.FormFields.primaryCarePhysician.firstName.key] = 'Dr. Jane',
        _a[constants_1.FormFields.primaryCarePhysician.lastName.key] = 'Smith',
        _a[constants_1.FormFields.primaryCarePhysician.practiceName.key] = 'Family Medical Center',
        _a[constants_1.FormFields.primaryCarePhysician.address.key] = '123 Main St, AnyTown, ST 12345',
        _a[constants_1.FormFields.primaryCarePhysician.phone.key] = '5551234567',
        _a);
    (0, vitest_1.it)('should display correct checkbox label', function () {
        (0, react_1.render)(<TestWrapper>
        <PrimaryCareContainer_1.PrimaryCareContainer />
      </TestWrapper>);
        (0, vitest_1.expect)(react_1.screen.getByText("Patient doesn't have a PCP at this time")).toBeInTheDocument();
    });
    (0, vitest_1.it)('should show and hide PCP form fields based on checkbox state', function () { return __awaiter(void 0, void 0, void 0, function () {
        var pcpCheckbox;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, react_1.render)(<TestWrapper>
        <PrimaryCareContainer_1.PrimaryCareContainer />
      </TestWrapper>);
                    pcpCheckbox = getFieldInput(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.pcpCheckbox);
                    (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.firstName)).toBeVisible();
                    (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.lastName)).toBeVisible();
                    (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.practiceName)).toBeVisible();
                    (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.address)).toBeVisible();
                    (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile)).toBeVisible();
                    return [4 /*yield*/, user.click(pcpCheckbox)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.firstName)).not.toBeVisible();
                            (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.lastName)).not.toBeVisible();
                            (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.practiceName)).not.toBeVisible();
                            (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.address)).not.toBeVisible();
                            (0, vitest_1.expect)(react_1.screen.getByTestId(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile)).not.toBeVisible();
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    (0, vitest_1.it)('should preserve field values when checkbox is checked and unchecked', function () { return __awaiter(void 0, void 0, void 0, function () {
        var pcpCheckbox, firstNameInput, lastNameInput, practiceNameInput, addressInput, mobileInput;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    (0, react_1.render)(<TestWrapper defaultValues={filledFieldValues}>
        <PrimaryCareContainer_1.PrimaryCareContainer />
      </TestWrapper>);
                    pcpCheckbox = getFieldInput(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.pcpCheckbox);
                    (0, vitest_1.expect)(pcpCheckbox).toBeInTheDocument();
                    (0, vitest_1.expect)(pcpCheckbox).not.toBeChecked();
                    firstNameInput = getFieldInput(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.firstName);
                    lastNameInput = getFieldInput(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.lastName);
                    practiceNameInput = getFieldInput(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.practiceName);
                    addressInput = getFieldInput(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.address);
                    mobileInput = getFieldInput(data_test_ids_1.dataTestIds.primaryCarePhysicianContainer.mobile);
                    (0, vitest_1.expect)(firstNameInput).toHaveValue(filledFieldValues[constants_1.FormFields.primaryCarePhysician.firstName.key]);
                    (0, vitest_1.expect)(lastNameInput).toHaveValue(filledFieldValues[constants_1.FormFields.primaryCarePhysician.lastName.key]);
                    (0, vitest_1.expect)(practiceNameInput).toHaveValue(filledFieldValues[constants_1.FormFields.primaryCarePhysician.practiceName.key]);
                    (0, vitest_1.expect)(addressInput).toHaveValue(filledFieldValues[constants_1.FormFields.primaryCarePhysician.address.key]);
                    (0, vitest_1.expect)(mobileInput).toHaveValue(filledFieldValues[constants_1.FormFields.primaryCarePhysician.phone.key]);
                    return [4 /*yield*/, user.click(pcpCheckbox)];
                case 1:
                    _a.sent();
                    (0, vitest_1.expect)(pcpCheckbox).toBeChecked();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            (0, vitest_1.expect)(firstNameInput).not.toBeVisible();
                            (0, vitest_1.expect)(lastNameInput).not.toBeVisible();
                            (0, vitest_1.expect)(practiceNameInput).not.toBeVisible();
                            (0, vitest_1.expect)(addressInput).not.toBeVisible();
                            (0, vitest_1.expect)(mobileInput).not.toBeVisible();
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, user.click(pcpCheckbox)];
                case 3:
                    _a.sent();
                    (0, vitest_1.expect)(pcpCheckbox).not.toBeChecked();
                    return [4 /*yield*/, (0, react_1.waitFor)(function () {
                            (0, vitest_1.expect)(firstNameInput).toBeVisible();
                            (0, vitest_1.expect)(lastNameInput).toBeVisible();
                            (0, vitest_1.expect)(practiceNameInput).toBeVisible();
                            (0, vitest_1.expect)(addressInput).toBeVisible();
                            (0, vitest_1.expect)(mobileInput).toBeVisible();
                        })];
                case 4:
                    _a.sent();
                    (0, vitest_1.expect)(firstNameInput).toHaveValue(filledFieldValues[constants_1.FormFields.primaryCarePhysician.firstName.key]);
                    (0, vitest_1.expect)(lastNameInput).toHaveValue(filledFieldValues[constants_1.FormFields.primaryCarePhysician.lastName.key]);
                    (0, vitest_1.expect)(practiceNameInput).toHaveValue(filledFieldValues[constants_1.FormFields.primaryCarePhysician.practiceName.key]);
                    (0, vitest_1.expect)(addressInput).toHaveValue(filledFieldValues[constants_1.FormFields.primaryCarePhysician.address.key]);
                    (0, vitest_1.expect)(mobileInput).toHaveValue(filledFieldValues[constants_1.FormFields.primaryCarePhysician.phone.key]);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=PrimaryCareContainer.test.js.map