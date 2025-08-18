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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BottomNavigation = void 0;
var ChevronLeft_1 = require("@mui/icons-material/ChevronLeft");
var ChevronRight_1 = require("@mui/icons-material/ChevronRight");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var NavigationContext_1 = require("../context/NavigationContext");
var useAppointment_1 = require("../hooks/useAppointment");
var usePractitioner_1 = require("../hooks/usePractitioner");
var BottomNavigation = function () {
    var appointmentID = (0, react_router_dom_1.useParams)().id;
    var _a = (0, useAppointment_1.useAppointment)(appointmentID), telemedData = _a.visitState, refetch = _a.refetch;
    var encounter = telemedData.encounter;
    var theme = (0, material_1.useTheme)();
    var _b = (0, NavigationContext_1.useNavigationContext)(), goToNext = _b.goToNext, goToPrevious = _b.goToPrevious, isNavigationHidden = _b.isNavigationHidden, isFirstPage = _b.isFirstPage, isLastPage = _b.isLastPage, interactionMode = _b.interactionMode, isNavigationDisabled = _b.isNavigationDisabled, nextButtonText = _b.nextButtonText;
    var practitionerTypeFromMode = interactionMode === 'intake' ? utils_1.PRACTITIONER_CODINGS.Admitter : utils_1.PRACTITIONER_CODINGS.Attender;
    var isEncounterUpdatePending = (0, usePractitioner_1.usePractitionerActions)(encounter, 'end', practitionerTypeFromMode).isEncounterUpdatePending;
    var _c = react_1.default.useState(false), nextButtonLoading = _c[0], setNextButtonLoading = _c[1];
    var handleNextPage = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, 3, 4]);
                    setNextButtonLoading(true);
                    goToNext();
                    return [4 /*yield*/, refetch()];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 2:
                    error_1 = _a.sent();
                    console.log(error_1.message);
                    (0, notistack_1.enqueueSnackbar)('An error occurred trying to complete intake. Please try again.', { variant: 'error' });
                    return [3 /*break*/, 4];
                case 3:
                    setNextButtonLoading(false);
                    return [7 /*endfinally*/];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    if (isNavigationHidden)
        return <></>;
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            margin: '0 0 0 -20px',
            width: 'calc(100% + 20px)',
        }}>
      <material_1.Box sx={{
            display: 'flex',
            height: '48px',
            boxShadow: '0px 0px 4px 2px rgba(0,0,0,0.1)',
        }}>
        <material_1.Button disabled={isFirstPage || isNavigationDisabled} startIcon={<ChevronLeft_1.default sx={{ width: '32px', height: '32px' }}/>} onClick={goToPrevious} sx={__assign(__assign({ flex: 1, justifyContent: 'flex-start', backgroundColor: theme.palette.background.paper, borderRadius: 0, '&:hover': {
                backgroundColor: (0, material_1.alpha)(theme.palette.primary.light, 0.1),
            }, color: theme.palette.primary.main, pl: 3, fontWeight: 'bold', textTransform: 'none' }, theme.typography.subtitle1), { fontSize: '16px', borderRight: "1px solid ".concat(theme.palette.primary.main) })}>
          Back
        </material_1.Button>
        <lab_1.LoadingButton disabled={isNavigationDisabled || isEncounterUpdatePending || (isLastPage && interactionMode === 'provider')} loading={nextButtonLoading} endIcon={<ChevronRight_1.default sx={{ width: '32px', height: '32px' }}/>} onClick={handleNextPage} sx={__assign(__assign({ flex: 1, justifyContent: 'flex-end', backgroundColor: '#EDE8FF', borderRadius: 0, '&:hover': {
                backgroundColor: (0, material_1.alpha)(theme.palette.primary.light, 0.24),
            }, color: theme.palette.primary.main, pr: 3, fontWeight: 'bold', textTransform: 'none' }, theme.typography.subtitle1), { fontSize: '16px' })}>
          {nextButtonText}
        </lab_1.LoadingButton>
      </material_1.Box>
    </material_1.Box>);
};
exports.BottomNavigation = BottomNavigation;
//# sourceMappingURL=BottomNavigation.js.map