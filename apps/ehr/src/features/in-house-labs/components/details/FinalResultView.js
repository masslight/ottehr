"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalResultView = void 0;
var icons_material_1 = require("@mui/icons-material");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var FinalResultCard_1 = require("./FinalResultCard");
var FinalResultView = function (_a) {
    var testDetails = _a.testDetails, onBack = _a.onBack;
    var navigate = (0, react_router_dom_1.useNavigate)();
    // we sort the tests on the back end, most recent will always be first
    // const sortedOrders = inHouseOrders.sort((a, b) => compareDates(a.orderAddedDate, b.orderAddedDate));
    var mostRecentTest = testDetails === null || testDetails === void 0 ? void 0 : testDetails[0];
    var openPdf = function () {
        if (mostRecentTest === null || mostRecentTest === void 0 ? void 0 : mostRecentTest.resultsPDFUrl) {
            window.open(mostRecentTest.resultsPDFUrl, '_blank');
        }
    };
    var diagnoses = testDetails === null || testDetails === void 0 ? void 0 : testDetails.reduce(function (acc, detail) {
        detail.diagnosesDTO.forEach(function (diagnoses) {
            if (!acc.some(function (d) { return d.code === diagnoses.code; })) {
                acc.push(diagnoses);
            }
        });
        return acc;
    }, []);
    var isRepeatable = testDetails === null || testDetails === void 0 ? void 0 : testDetails.some(function (detail) { return detail.labDetails.repeatable; });
    var handleRepeatOnClick = function () {
        var _a;
        navigate("/in-person/".concat(testDetails === null || testDetails === void 0 ? void 0 : testDetails[0].appointmentId, "/in-house-lab-orders/create"), {
            state: {
                testItemName: (_a = testDetails === null || testDetails === void 0 ? void 0 : testDetails[0]) === null || _a === void 0 ? void 0 : _a.testItemName,
                diagnoses: diagnoses,
            },
        });
    };
    if (!testDetails) {
        return (<material_1.Box>
        <material_1.Paper sx={{ p: 3, textAlign: 'center' }}>
          <material_1.Typography variant="h6" color="error">
            Test details not found
          </material_1.Typography>
        </material_1.Paper>
      </material_1.Box>);
    }
    return (<material_1.Box>
      <material_1.Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
        {(0, utils_1.getFormattedDiagnoses)(diagnoses || [])}
      </material_1.Typography>

      {openPdf && (<material_1.Button variant="outlined" color="primary" sx={{ borderRadius: '50px', textTransform: 'none', mb: '12px' }} onClick={function () { return openPdf(); }} startIcon={<icons_material_1.BiotechOutlined />} disabled={!(mostRecentTest === null || mostRecentTest === void 0 ? void 0 : mostRecentTest.resultsPDFUrl)}>
          Results PDF
        </material_1.Button>)}

      {testDetails.map(function (test, idx) { return (<FinalResultCard_1.FinalResultCard key={"".concat(idx, "-").concat(test.testItemName.split(' ').join(''))} testDetails={test}/>); })}

      <material_1.Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
        <material_1.Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', px: 4 }}>
          Back
        </material_1.Button>
        {isRepeatable && (<material_1.Button variant="outlined" onClick={handleRepeatOnClick} sx={{ borderRadius: '50px', px: 4 }}>
            Repeat
          </material_1.Button>)}
      </material_1.Box>
    </material_1.Box>);
};
exports.FinalResultView = FinalResultView;
//# sourceMappingURL=FinalResultView.js.map