"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseMedication = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var PageTitle_1 = require("../../../telemed/components/PageTitle");
var CSSLoader_1 = require("../components/CSSLoader");
var MarTable_1 = require("../components/medication-administration/mar/MarTable");
var MedicationList_1 = require("../components/medication-administration/medication-details/MedicationList");
var MedicationHistoryList_1 = require("../components/medication-administration/medication-history/MedicationHistoryList");
var MedicationNotes_1 = require("../components/medication-administration/MedicationNotes");
var OrderButton_1 = require("../components/medication-administration/OrderButton");
var useMedicationOperations_1 = require("../hooks/useMedicationOperations");
var helpers_1 = require("../routing/helpers");
var TabContent = function (_a) {
    var isActive = _a.isActive, children = _a.children;
    return (<material_1.Box sx={{
            display: isActive ? 'block' : 'none', // used this hack to fast switch between tabs, MUI take a lot of time to render tab from zero
        }}>
    {children}
  </material_1.Box>);
};
var InHouseMedication = function () {
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var medications = (0, useMedicationOperations_1.useMedicationAPI)().medications;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var tabContentRef = (0, react_1.useRef)(null);
    var tabsRef = (0, react_1.useRef)(null);
    var tabName = (0, react_router_dom_1.useParams)().tabName;
    var theme = (0, material_1.useTheme)();
    var isTabTransitionRef = (0, react_1.useRef)(false);
    var _a = (0, react_1.useState)(null), content = _a[0], setContent = _a[1];
    // handle tabs click navigation
    var handleChange = (0, react_1.useCallback)(function () {
        isTabTransitionRef.current = true;
        requestAnimationFrame(function () {
            if (tabName === 'mar') {
                navigate((0, helpers_1.getInHouseMedicationDetailsUrl)(appointmentId));
            }
            else {
                navigate((0, helpers_1.getInHouseMedicationMARUrl)(appointmentId));
            }
        });
    }, [appointmentId, navigate, tabName]);
    var searchParams = (0, react_router_dom_1.useSearchParams)()[0];
    var scrollTo = searchParams.get('scrollTo');
    // handle scroll to element (row was clicked - scroll to element, or tab was clicked - scroll to table top)
    (0, react_1.useLayoutEffect)(function () {
        if (isTabTransitionRef.current || scrollTo) {
            requestAnimationFrame(function () {
                var _a;
                if (tabContentRef.current && tabsRef.current) {
                    var element = scrollTo ? document.getElementById("medication-".concat(scrollTo)) : tabContentRef.current;
                    (_a = element === null || element === void 0 ? void 0 : element.scrollIntoView) === null || _a === void 0 ? void 0 : _a.call(element, { behavior: 'auto', block: 'start' });
                }
            });
        }
    }, [scrollTo, tabName]);
    (0, react_1.useEffect)(function () {
        // the page is heavy and rendering takes a time, to optimization we initially show loader and starting render process for content after that
        setContent({ mar: <MarTable_1.MarTable />, details: <MedicationList_1.MedicationList /> });
    }, [medications]);
    if (!content) {
        return <CSSLoader_1.CSSLoader />;
    }
    return (<material_1.Box>
      <material_1.Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle_1.PageTitle dataTestId={data_test_ids_1.dataTestIds.inHouseMedicationsPage.title} label="Medications" showIntakeNotesButton={false}/>
        <OrderButton_1.OrderButton dataTestId={data_test_ids_1.dataTestIds.inHouseMedicationsPage.orderButton}/>
      </material_1.Box>
      <MedicationHistoryList_1.MedicationHistoryList />

      <material_1.Box ref={tabContentRef}>
        <material_1.AppBar position="static" color="default" elevation={0} sx={{
            zIndex: 3,
            mb: 2,
            mt: 3,
        }} ref={tabsRef}>
          <material_1.Box sx={{
            marginLeft: '-20px',
            padding: '0 24px',
            width: 'calc(100% + 40px)',
            backgroundColor: theme.palette.background.default,
        }}>
            <material_1.Tabs value={tabName === 'mar' ? 0 : 1} onChange={handleChange} aria-label="medication tabs">
              <material_1.Tab label="MAR"/>
              <material_1.Tab data-testid={data_test_ids_1.dataTestIds.inHouseMedicationsPage.medicationDetailsTab} label="Medication Details"/>
            </material_1.Tabs>
          </material_1.Box>
        </material_1.AppBar>

        <TabContent isActive={tabName === 'mar'}>{content.mar}</TabContent>
        <TabContent isActive={tabName === 'medication-details'}>{content.details}</TabContent>
      </material_1.Box>

      <MedicationNotes_1.MedicationNotes />
    </material_1.Box>);
};
exports.InHouseMedication = InHouseMedication;
//# sourceMappingURL=InHouseMedication.js.map