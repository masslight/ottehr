"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Claims = void 0;
var FilterAltOffOutlined_1 = require("@mui/icons-material/FilterAltOffOutlined");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var features_1 = require("../features");
var state_1 = require("../state");
var Claims = function () {
    var _a = (0, react_router_dom_1.useSearchParams)(), searchParams = _a[0], setSearchParams = _a[1];
    var _b = (0, react_1.useState)(utils_1.ClaimQueueTypes[0]), claimType = _b[0], setClaimType = _b[1];
    (0, react_1.useEffect)(function () {
        var type = searchParams.get('type');
        if (!type || !utils_1.ClaimQueueTypes.includes(type)) {
            setSearchParams({ type: utils_1.ClaimQueueTypes[0] });
        }
        else {
            setClaimType(type);
        }
    }, [searchParams, setSearchParams]);
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
        }}>
      <material_1.Divider />

      <material_1.Card sx={{ display: 'flex', gap: 2, p: 2, backgroundColor: 'inherit', borderRadius: 0 }}>
        <features_1.ClaimsQueueFilters />

        <material_1.Box>
          <material_1.IconButton color="primary" size="small" onClick={function () {
            return state_1.useClaimsQueueStore.setState({
                patient: undefined,
                visitId: undefined,
                teamMember: undefined,
                facilityGroup: undefined,
                facility: undefined,
                insurance: undefined,
                dosFrom: undefined,
                dosTo: undefined,
            });
        }}>
            <FilterAltOffOutlined_1.default />
          </material_1.IconButton>
        </material_1.Box>
      </material_1.Card>

      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', p: 3, gap: 2 }}>
        <features_1.ClaimsQueueButtons />

        <material_1.Paper>
          <features_1.ClaimsQueueGrid type={claimType}/>
        </material_1.Paper>
      </material_1.Box>
    </material_1.Box>);
};
exports.Claims = Claims;
//# sourceMappingURL=Claims.js.map