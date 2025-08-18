"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LogoutWarning;
var material_1 = require("@mui/material");
var react_1 = require("react");
function LogoutWarning(_a) {
    var modalOpen = _a.modalOpen, onEnd = _a.onEnd, onContinue = _a.onContinue, timeoutInSeconds = _a.timeoutInSeconds;
    var theme = (0, material_1.useTheme)();
    var _b = (0, react_1.useState)(timeoutInSeconds), countdown = _b[0], setCountdown = _b[1];
    (0, react_1.useEffect)(function () {
        var intervalId;
        if (modalOpen) {
            setCountdown(timeoutInSeconds);
            intervalId = setInterval(function () {
                setCountdown(function (prevCountdown) {
                    if (prevCountdown <= 1) {
                        clearInterval(intervalId);
                        onEnd();
                        return 0;
                    }
                    return prevCountdown - 1;
                });
            }, 1000);
        }
        return function () {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [modalOpen, timeoutInSeconds, onEnd]);
    var handleContinue = function () {
        setCountdown(timeoutInSeconds);
        onContinue();
    };
    var buttonSx = {
        fontWeight: 500,
        textTransform: 'none',
        borderRadius: 6,
    };
    return (<material_1.Dialog open={modalOpen} onClose={onEnd} disableScrollLock sx={{
            '.MuiPaper-root': {
                padding: 2,
            },
        }}>
      <material_1.DialogTitle variant="h4" color="primary.dark" sx={{ width: '80%' }}>
        Your session is about to expire
      </material_1.DialogTitle>
      <material_1.DialogContent>
        <material_1.DialogContentText sx={{ color: theme.palette.text.primary }}>
          You will be logged out in {countdown} seconds due to inactivity.
        </material_1.DialogContentText>
      </material_1.DialogContent>
      <material_1.DialogActions>
        <material_1.Button variant="outlined" onClick={handleContinue} size="medium" sx={buttonSx}>
          Continue session
        </material_1.Button>
        <material_1.Button variant="contained" onClick={onEnd} size="medium" color="error" sx={buttonSx}>
          End session
        </material_1.Button>
      </material_1.DialogActions>
    </material_1.Dialog>);
}
//# sourceMappingURL=LogoutWarning.js.map