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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useNavigationContext = exports.NavigationProvider = exports.setNavigationDisable = void 0;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var telemed_1 = require("../../../telemed");
var CSSModal_1 = require("../components/CSSModal");
var useAppointment_1 = require("../hooks/useAppointment");
var routesCSS_1 = require("../routing/routesCSS");
var NavigationContext = (0, react_1.createContext)(undefined);
// hack for safe using outside context in the telemed components
var setNavigationDisable = function () {
    return;
};
exports.setNavigationDisable = setNavigationDisable;
var NavigationProvider = function (_a) {
    var children = _a.children;
    var appointmentIdFromUrl = (0, react_router_dom_1.useParams)().id;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var location = (0, react_router_dom_1.useLocation)();
    var nextPageValidatorsRef = (0, react_1.useRef)({});
    var previousPageValidatorsRef = (0, react_1.useRef)({});
    var _b = (0, react_1.useState)(false), isNavigationHidden = _b[0], setIsNavigationHidden = _b[1];
    var _c = (0, react_1.useState)(false), isModeInitialized = _c[0], setIsModeInitialized = _c[1];
    // todo: calc actual initial InteractionMode value; in that case check "Intake Notes" button (or any other usages) in the Telemed works correctly
    var _d = (0, react_1.useState)('intake'), interactionMode = _d[0], _setInteractionMode = _d[1];
    var _e = (0, react_1.useState)(), modalContent = _e[0], setModalContent = _e[1];
    var _f = (0, react_1.useState)(false), isModalOpen = _f[0], setIsModalOpen = _f[1];
    var _g = (0, react_1.useState)({}), _disabledNavigationState = _g[0], _setDisabledNavigationState = _g[1];
    var _h = (0, useAppointment_1.useAppointment)(appointmentIdFromUrl), isLoading = _h.isLoading, visitState = _h.visitState;
    var encounter = visitState.encounter;
    var _j = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['chartData', 'isChartDataLoading']), chartData = _j.chartData, isChartDataLoading = _j.isChartDataLoading;
    var setInteractionMode = (0, react_1.useCallback)(function (mode, shouldNavigate) {
        var _a;
        var basePath = (_a = location.pathname.match(/.*?(in-person)\/[^/]*/)) === null || _a === void 0 ? void 0 : _a[0];
        if (!basePath) {
            return;
        }
        var firstAvailableRoute = Object.values(routesCSS_1.routesCSS).find(function (route) { return route.modes.includes(mode); });
        if (!firstAvailableRoute) {
            return;
        }
        var routePath = firstAvailableRoute.sidebarPath || firstAvailableRoute.path;
        var newPath = "".concat(basePath, "/").concat(routePath);
        _setInteractionMode(mode);
        setIsModeInitialized(true);
        if (shouldNavigate) {
            navigate(newPath);
        }
    }, [location.pathname, navigate]);
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d;
        var appointmentIdReferenceFromEncounter = (_c = (_b = (_a = encounter === null || encounter === void 0 ? void 0 : encounter.appointment) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.replace('Appointment/', '');
        if (!appointmentIdReferenceFromEncounter || !appointmentIdFromUrl) {
            return;
        }
        var isEncounterLoadedToStore = appointmentIdReferenceFromEncounter === appointmentIdFromUrl;
        if (!isEncounterLoadedToStore) {
            return;
        }
        if (((_d = encounter === null || encounter === void 0 ? void 0 : encounter.participant) === null || _d === void 0 ? void 0 : _d.find(function (participant) {
            var _a;
            return ((_a = participant.type) === null || _a === void 0 ? void 0 : _a.find(function (type) {
                var _a;
                return ((_a = type.coding) === null || _a === void 0 ? void 0 : _a.find(function (coding) {
                    return coding.system === 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType' &&
                        coding.code === 'ATND';
                })) != null;
            })) != null;
        })) &&
            !isModeInitialized) {
            setInteractionMode('provider', false);
        }
        else if (encounter === null || encounter === void 0 ? void 0 : encounter.id) {
            setIsModeInitialized(true);
        }
    }, [
        encounter === null || encounter === void 0 ? void 0 : encounter.id,
        encounter === null || encounter === void 0 ? void 0 : encounter.participant,
        setInteractionMode,
        interactionMode,
        isModeInitialized,
        appointmentIdFromUrl,
        encounter === null || encounter === void 0 ? void 0 : encounter.appointment,
    ]);
    exports.setNavigationDisable = function (newState) {
        var shouldUpdate = false;
        for (var _i = 0, _a = Object.keys(newState); _i < _a.length; _i++) {
            var key = _a[_i];
            if (!!_disabledNavigationState[key] !== !!newState[key]) {
                shouldUpdate = true;
                break;
            }
        }
        if (shouldUpdate) {
            _setDisabledNavigationState(__assign(__assign({}, _disabledNavigationState), newState));
        }
    };
    var isNavigationDisabled = Object.values(_disabledNavigationState).some(Boolean);
    var addNextPageValidators = function (newValidators) {
        nextPageValidatorsRef.current = __assign(__assign({}, nextPageValidatorsRef.current), newValidators);
    };
    var addPreviousPageValidators = function (newValidators) {
        previousPageValidatorsRef.current = __assign(__assign({}, previousPageValidatorsRef.current), newValidators);
    };
    var closeModal = (0, react_1.useCallback)(function () {
        setIsModalOpen(false);
    }, []);
    var resetNavigationState = function () {
        nextPageValidatorsRef.current = {};
        previousPageValidatorsRef.current = {};
        setIsModalOpen(false);
        setModalContent('');
        _setDisabledNavigationState({});
    };
    var availableRoutes = Object.values(routesCSS_1.routesCSS).filter(function (route) { return !isLoading && isModeInitialized && route.modes.includes(interactionMode); });
    var availableRoutesForBottomNavigation = availableRoutes.filter(function (route) { return !route.isSkippedInNavigation; });
    var availableRoutesPathsForBottomNavigation = availableRoutesForBottomNavigation.map(function (route) { return route.sidebarPath || route.path; });
    var match = (0, react_router_dom_1.useMatch)('/in-person/:id/*');
    var splat = match === null || match === void 0 ? void 0 : match.params['*'];
    var currentRouteIndex = availableRoutesPathsForBottomNavigation.indexOf(splat || '');
    var currentRoute = availableRoutesPathsForBottomNavigation[currentRouteIndex];
    var isFirstPage = currentRouteIndex === 0;
    var isLastPage = currentRouteIndex === availableRoutesPathsForBottomNavigation.length - 1;
    var nextRoutePath = !isLastPage ? availableRoutesPathsForBottomNavigation === null || availableRoutesPathsForBottomNavigation === void 0 ? void 0 : availableRoutesPathsForBottomNavigation[currentRouteIndex + 1] : null;
    var previousRoutePath = !isFirstPage ? availableRoutesPathsForBottomNavigation === null || availableRoutesPathsForBottomNavigation === void 0 ? void 0 : availableRoutesPathsForBottomNavigation[currentRouteIndex - 1] : null;
    // Hide bottom navigation for pages that shouldn't be accessed through the bottom navigation
    // These pages will have currentRouteIndex === -1 because they are not in the availableRoutesPathsForBottomNavigation array
    // Examples: order details, order edit pages
    var isPageWithHiddenBottomNavigation = currentRouteIndex === -1;
    (0, react_1.useEffect)(function () {
        setIsNavigationHidden(isPageWithHiddenBottomNavigation);
    }, [isPageWithHiddenBottomNavigation]);
    var goToNext = (0, react_1.useCallback)(function () {
        if (!nextRoutePath) {
            return;
        }
        var validators = Object.values(nextPageValidatorsRef.current);
        for (var i = 0; i < validators.length; i++) {
            var validationResult = validators[i]();
            if (validationResult) {
                setModalContent(validationResult);
                setIsModalOpen(true);
                return;
            }
        }
        navigate(nextRoutePath);
    }, [nextRoutePath, navigate]);
    var goToPrevious = (0, react_1.useCallback)(function () {
        if (!previousRoutePath) {
            return;
        }
        var validators = Object.values(previousPageValidatorsRef.current);
        for (var i = 0; i < validators.length; i++) {
            var validationResult = validators[i]();
            if (validationResult) {
                setModalContent(validationResult);
                setIsModalOpen(true);
                return;
            }
        }
        navigate(previousRoutePath);
    }, [previousRoutePath, navigate]);
    var nextButtonText = (function () {
        var _a, _b, _c, _d, _e;
        if (isChartDataLoading)
            return ' ';
        if (interactionMode === 'intake') {
            switch (currentRoute) {
                case 'allergies':
                    return ((_a = chartData === null || chartData === void 0 ? void 0 : chartData.allergies) === null || _a === void 0 ? void 0 : _a.length) ? 'Allergies Confirmed' : 'Confirmed No Known Allergies';
                case 'medications':
                    return ((_b = chartData === null || chartData === void 0 ? void 0 : chartData.medications) === null || _b === void 0 ? void 0 : _b.length) ? 'Medications Confirmed' : 'Confirmed No Medications';
                case 'medical-conditions':
                    return ((_c = chartData === null || chartData === void 0 ? void 0 : chartData.conditions) === null || _c === void 0 ? void 0 : _c.length) ? 'Medical Conditions Confirmed' : 'Confirmed No Medical Conditions';
                case 'surgical-history':
                    return ((_d = chartData === null || chartData === void 0 ? void 0 : chartData.surgicalHistory) === null || _d === void 0 ? void 0 : _d.length) ? 'Surgical History Confirmed' : 'Confirmed No Surgical History';
                case 'hospitalization':
                    return "".concat(((_e = chartData === null || chartData === void 0 ? void 0 : chartData.episodeOfCare) === null || _e === void 0 ? void 0 : _e.length) ? 'Hospitalization Confirmed' : 'Confirmed No Hospitalization', " AND Complete Intake");
                default:
                    return isLastPage ? 'Complete' : 'Next';
            }
        }
        return 'Next';
    })();
    return (<NavigationContext.Provider value={{
            currentRoute: currentRoute,
            goToNext: goToNext,
            goToPrevious: goToPrevious,
            addNextPageValidators: addNextPageValidators,
            addPreviousPageValidators: addPreviousPageValidators,
            resetNavigationState: resetNavigationState,
            setIsNavigationHidden: setIsNavigationHidden,
            isNavigationHidden: isNavigationHidden,
            interactionMode: interactionMode,
            isLoading: isLoading || !isModeInitialized,
            setInteractionMode: setInteractionMode,
            availableRoutes: availableRoutes,
            isFirstPage: isFirstPage,
            isLastPage: isLastPage,
            setNavigationDisable: exports.setNavigationDisable,
            isNavigationDisabled: isNavigationDisabled,
            nextButtonText: nextButtonText,
        }}>
      {children}
      <CSSModal_1.CSSModal open={isModalOpen} handleClose={closeModal} title="Validation Error" description={modalContent} closeButtonText="Close" confirmText="OK" handleConfirm={closeModal}/>
    </NavigationContext.Provider>);
};
exports.NavigationProvider = NavigationProvider;
// Quick fix for hot reload issue;
var preContextForDevelopmentUseOnly;
var isDevelopment = import.meta.env.VITE_APP_IS_LOCAL;
var useNavigationContext = function () {
    var context = (0, react_1.useContext)(NavigationContext);
    // clear state on component unmount
    (0, react_1.useEffect)(function () {
        return function () {
            var _a;
            (_a = context === null || context === void 0 ? void 0 : context.resetNavigationState) === null || _a === void 0 ? void 0 : _a.call(context);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // TODO: try to move context higher to wrap routes (required some refactoring) - this should prevent additional
    // reload after hot reload and this fix can be removed
    if (isDevelopment) {
        if (context === undefined) {
            return preContextForDevelopmentUseOnly;
        }
        // context will be broken during hot reload, keep the last context
        preContextForDevelopmentUseOnly = context;
    }
    if (context === undefined) {
        throw new Error('useNavigationContext must be used within a NavigationProvider');
    }
    return context;
};
exports.useNavigationContext = useNavigationContext;
//# sourceMappingURL=NavigationContext.js.map