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
/* eslint-disable @typescript-eslint/no-unused-vars */
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var react_stripe_js_1 = require("@stripe/react-stripe-js");
var dist_1 = require("@stripe/stripe-js/dist");
var react_1 = require("react");
var useGetPaymentMethods_1 = require("src/hooks/useGetPaymentMethods");
var useSetDefaultPaymentMethod_1 = require("src/hooks/useSetDefaultPaymentMethod");
var useSetupStripe_1 = require("src/hooks/useSetupStripe");
var ui_components_1 = require("ui-components");
var stripePromise = (0, dist_1.loadStripe)(import.meta.env.VITE_APP_STRIPE_KEY);
var labelForCard = function (card) {
    return "XXXX - XXXX - XXXX - ".concat(card.lastFour).concat(card.default ? ' (Primary)' : '');
};
var NEW_CARD = { id: 'new', label: 'Add new card' };
var CreditCardContent = function (props) {
    var patient = props.patient, selectedCardId = props.selectedCardId, handleCardSelected = props.handleCardSelected, error = props.error;
    var _a = (0, react_1.useState)([]), cards = _a[0], setCards = _a[1];
    var _b = (0, react_1.useState)(undefined), errorMessage = _b[0], setErrorMessage = _b[1];
    var _c = (0, useSetupStripe_1.useSetupStripe)(patient === null || patient === void 0 ? void 0 : patient.id), setupData = _c.data, isSetupDataFetching = _c.isFetching, isSetupDataLoading = _c.isLoading, refetchSetupData = _c.refetch, isSetupDataRefetching = _c.isRefetching;
    var setDefault = (0, useSetDefaultPaymentMethod_1.useSetDefaultPaymentMethod)(patient === null || patient === void 0 ? void 0 : patient.id).mutate;
    var _d = (0, useGetPaymentMethods_1.useGetPaymentMethods)({
        beneficiaryPatientId: patient === null || patient === void 0 ? void 0 : patient.id,
        setupCompleted: Boolean(setupData),
        onSuccess: function (data) {
            var _a;
            setCards((_a = data.cards) !== null && _a !== void 0 ? _a : []);
            var defaultCard = data.cards.find(function (card) { return card.default; });
            if (defaultCard && !selectedCardId) {
                handleCardSelected(defaultCard.id);
            }
            void refetchSetupData();
        },
    }), cardsAreLoading = _d.isFetching, cardsFetched = _d.isFetched, refetchPaymentMethods = _d.refetch;
    var showNewCard = (function () {
        var hasNone = cardsFetched && !cardsAreLoading && cards.length === 0;
        var addingOne = selectedCardId === NEW_CARD.id;
        return hasNone || addingOne;
    })();
    var initializing = isSetupDataFetching || isSetupDataLoading;
    var cardOptions = __spreadArray(__spreadArray([], cards.map(function (card) { return ({ id: card.id, label: labelForCard(card) }); }), true), [
        { id: 'new', label: 'Add new card' },
    ], false);
    var selectedCard = cardOptions.find(function (card) { return card.id === selectedCardId; });
    var someDefault = cards.some(function (card) { return card.default; });
    var handleNewPaymentMethod = function (id, makeDefault) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!makeDefault) return [3 /*break*/, 1];
                    setDefault({
                        paymentMethodId: id,
                        onSuccess: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, refetchPaymentMethods()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); },
                        onError: function (error) {
                            console.error('setDefault error', error);
                            setErrorMessage('Unable to set default payment method. Please try again later or select a card.');
                        },
                    });
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, refetchPaymentMethods()];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    handleCardSelected(id);
                    stripePromise = (0, dist_1.loadStripe)(import.meta.env.VITE_APP_STRIPE_KEY);
                    return [2 /*return*/];
            }
        });
    }); };
    if (initializing) {
        return (<system_1.Box sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
        <material_1.CircularProgress />
      </system_1.Box>);
    }
    var currentValue = selectedCard;
    var showCardList = cards.length > 0;
    return (<>
      <material_1.Autocomplete size="small" aria-label="Default card selection radio group" fullWidth sx={{
            '.MuiFormControlLabel-label': {
                width: '100%',
            },
            gap: 1,
            display: showCardList ? 'initial' : 'none',
            marginBottom: 2,
        }} options={cardOptions} renderOption={function (props, option) { return (<li {...props} key={option.id}>
            {option.label}
          </li>); }} value={currentValue !== null && currentValue !== void 0 ? currentValue : null} renderInput={function (params) {
            return (<system_1.Box>
              <material_1.TextField {...params} fullWidth required label="Credit card" variant="outlined" error={Boolean(error)} InputLabelProps={{ shrink: true }} inputProps={__assign(__assign({}, params.inputProps), { autoComplete: 'off' })}/>
              {error && <material_1.FormHelperText error={Boolean(error)}>{error}</material_1.FormHelperText>}
            </system_1.Box>);
        }} onChange={function (_event, value) {
            handleCardSelected(value === null || value === void 0 ? void 0 : value.id);
        }}/>

      <react_stripe_js_1.Elements stripe={stripePromise} options={{ clientSecret: setupData }}>
        <system_1.Box sx={{
            width: '100%',
            display: showNewCard ? 'flex' : 'none',
            justifyContent: 'center',
            alignItems: 'flex-start',
            flexDirection: 'column',
            marginTop: 2,
        }}>
          <ui_components_1.AddCreditCardForm clientSecret={setupData !== null && setupData !== void 0 ? setupData : ''} isLoading={false} disabled={false} selectPaymentMethod={function (id) {
            void handleNewPaymentMethod(id, !someDefault);
        }} condition="I have obtained the consent to add a card on file from the patient"/>
          {error && !showCardList && <material_1.FormHelperText error={Boolean(error)}>{error}</material_1.FormHelperText>}
        </system_1.Box>
      </react_stripe_js_1.Elements>

      <material_1.Snackbar anchorOrigin={{ vertical: 'top', horizontal: 'right' }} open={errorMessage !== undefined} autoHideDuration={5000} onClose={function () { return setErrorMessage(undefined); }}>
        <material_1.Alert onClose={function () { return setErrorMessage(undefined); }} severity="error" variant="filled">
          {errorMessage}
        </material_1.Alert>
      </material_1.Snackbar>
    </>);
};
exports.default = CreditCardContent;
//# sourceMappingURL=SelectCreditCard.js.map