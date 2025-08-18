"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ActivityLogDialog;
var material_1 = require("@mui/material");
var ActivityLogRow_1 = require("../ActivityLogRow");
function ActivityLogDialog(_a) {
    var open = _a.open, handleClose = _a.handleClose, logs = _a.logs;
    var buttonSx = {
        fontWeight: 500,
        textTransform: 'none',
        borderRadius: 6,
    };
    return (<material_1.Dialog open={open} onClose={handleClose} disableScrollLock sx={{
            '.MuiPaper-root': {
                padding: 1,
                minWidth: '75vw',
            },
        }}>
      <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
        Activity log
      </material_1.DialogTitle>
      <material_1.DialogContent>
        <material_1.Table>
          <material_1.TableHead>
            <material_1.TableRow>
              <material_1.TableCell>
                <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Date and time
                </material_1.Typography>
              </material_1.TableCell>
              <material_1.TableCell>
                <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Activity
                </material_1.Typography>
              </material_1.TableCell>
              <material_1.TableCell>
                <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Made by
                </material_1.Typography>
              </material_1.TableCell>
            </material_1.TableRow>
          </material_1.TableHead>
          <material_1.TableBody>
            {logs.map(function (log, idx) { return (<ActivityLogRow_1.default key={idx} log={log}></ActivityLogRow_1.default>); })}
          </material_1.TableBody>
        </material_1.Table>
      </material_1.DialogContent>
      <material_1.DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
        <material_1.Button variant="contained" onClick={handleClose} size="medium" sx={buttonSx}>
          Close
        </material_1.Button>
      </material_1.DialogActions>
    </material_1.Dialog>);
}
//# sourceMappingURL=ActivityLogDialog.js.map