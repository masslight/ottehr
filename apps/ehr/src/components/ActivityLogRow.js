"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ActivityLogRow;
var material_1 = require("@mui/material");
var react_1 = require("react");
function ActivityLogRow(_a) {
    var _b, _c;
    var log = _a.log;
    var theme = (0, material_1.useTheme)();
    var _d = (0, react_1.useState)(false), showDetails = _d[0], setShowDetails = _d[1];
    return (<>
      <material_1.TableRow>
        <material_1.TableCell>
          <material_1.Typography variant="body1">{log.activityDateTime}</material_1.Typography>
        </material_1.TableCell>
        <material_1.TableCell>
          <material_1.Box sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
            <material_1.Typography variant="body1">
              {log.activityName}
              {(log === null || log === void 0 ? void 0 : log.activityNameSupplement) ? " - ".concat(log.activityNameSupplement) : ''}
            </material_1.Typography>
            {log.moreDetails && (<material_1.Link onClick={function () { return setShowDetails(!showDetails); }} sx={{ cursor: 'pointer', textDecoration: 'none', marginLeft: 1 }}>
                {showDetails ? 'See Less' : 'See Details'}
              </material_1.Link>)}
          </material_1.Box>
        </material_1.TableCell>
        <material_1.TableCell>
          <material_1.Typography variant="body1">{log.activityBy}</material_1.Typography>
        </material_1.TableCell>
      </material_1.TableRow>
      {showDetails && (<>
          <material_1.TableRow sx={{ background: theme.palette.background.default }}>
            <material_1.TableCell colSpan={3} sx={{ padding: '8px 24px 8px 24px' }}>
              <material_1.Table sx={{ width: '100%' }}>
                <material_1.TableHead>
                  <material_1.TableRow>
                    <material_1.TableCell sx={{ py: 1 }}>
                      <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                        Before
                      </material_1.Typography>
                    </material_1.TableCell>
                  </material_1.TableRow>
                </material_1.TableHead>
                <material_1.TableBody>
                  <material_1.TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <material_1.TableCell sx={{ py: 1 }}>
                      <material_1.Typography variant="body1">{(_b = log.moreDetails) === null || _b === void 0 ? void 0 : _b.valueBefore}</material_1.Typography>
                    </material_1.TableCell>
                  </material_1.TableRow>
                </material_1.TableBody>
              </material_1.Table>
            </material_1.TableCell>
          </material_1.TableRow>
          <material_1.TableRow sx={{ background: theme.palette.background.default }}>
            <material_1.TableCell colSpan={3} sx={{ padding: '8px 24px 8px 24px' }}>
              <material_1.Table sx={{ width: '100%' }}>
                <material_1.TableHead>
                  <material_1.TableRow>
                    <material_1.TableCell sx={{ py: 1 }}>
                      <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                        After
                      </material_1.Typography>
                    </material_1.TableCell>
                  </material_1.TableRow>
                </material_1.TableHead>
                <material_1.TableBody>
                  <material_1.TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <material_1.TableCell sx={{ py: 1 }}>
                      <material_1.Typography variant="body1">{(_c = log.moreDetails) === null || _c === void 0 ? void 0 : _c.valueAfter}</material_1.Typography>
                    </material_1.TableCell>
                  </material_1.TableRow>
                </material_1.TableBody>
              </material_1.Table>
            </material_1.TableCell>
          </material_1.TableRow>
        </>)}
    </>);
}
//# sourceMappingURL=ActivityLogRow.js.map