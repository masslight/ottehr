"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabResultsReviewContainer = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var LabResultsReviewContainer = function (_a) {
    var _b;
    var resultDetails = _a.resultDetails, resultsPending = _a.resultsPending;
    var isExternal = resultDetails.type === utils_1.LabType.external;
    var title = isExternal ? 'External Labs' : 'In-House Labs';
    var keyIdentifier = isExternal ? 'external-lab-result' : 'in-house-lab-result';
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <material_1.Typography variant="h5" color="primary.dark">
        {title}
      </material_1.Typography>
      {(_b = resultDetails.results) === null || _b === void 0 ? void 0 : _b.map(function (res, idx) {
            var _a;
            return (<react_1.Fragment key={"".concat(keyIdentifier, "-").concat(idx)}>
          <react_router_dom_1.Link to={res.url} target="_blank">
            {res.name}
          </react_router_dom_1.Link>
          {isExternal &&
                    'reflexResults' in res &&
                    ((_a = res === null || res === void 0 ? void 0 : res.reflexResults) === null || _a === void 0 ? void 0 : _a.map(function (reflexRes, reflexIdx) { return (<react_router_dom_1.Link key={"".concat(idx, "-").concat(reflexIdx, "-").concat(reflexRes.name)} style={{ marginLeft: '20px' }} to={reflexRes.url} target="_blank">
                + {reflexRes.name}
              </react_router_dom_1.Link>); }))}
        </react_1.Fragment>);
        })}
      {resultsPending && (<material_1.Typography variant="subtitle2" style={{ fontSize: '14px' }}>
          Lab Results Pending
        </material_1.Typography>)}
    </material_1.Box>);
};
exports.LabResultsReviewContainer = LabResultsReviewContainer;
//# sourceMappingURL=LabResultsReviewContainer.js.map