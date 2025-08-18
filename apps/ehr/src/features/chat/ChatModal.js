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
var icons_material_1 = require("@mui/icons-material");
var Send_1 = require("@mui/icons-material/Send");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var Typography_1 = require("@mui/material/Typography");
var luxon_1 = require("luxon");
var react_1 = require("react");
var utils_1 = require("utils");
var CompleteConfiguration_1 = require("../../components/CompleteConfiguration");
var constants_1 = require("../../constants");
var data_test_ids_1 = require("../../constants/data-test-ids");
var useAppClients_1 = require("../../hooks/useAppClients");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
var utils_2 = require("../../telemed/utils");
var chat_queries_1 = require("./chat.queries");
function scrollToBottomOfChat() {
    // this helps with the scroll working,
    // not sure why setting it to 0 works.
    // maybe the element scrollHeight isn't set
    // and this waiting helps?
    setTimeout(function () {
        var element = document.getElementById('message-container');
        if (element) {
            element.scrollTop = element === null || element === void 0 ? void 0 : element.scrollHeight;
        }
    }, 0);
}
var makePendingSentMessage = function (text, timezone, sender) {
    var id = "pending_sent_message_".concat(Math.round(Math.random() * 100));
    var now = luxon_1.DateTime.now().setZone(timezone);
    // todo: consts for these format strings somewhere, or just send the date from BE and do all the formatting in one place
    var sentDay = now.toLocaleString({ day: 'numeric', month: 'numeric', year: '2-digit' }, { locale: 'en-us' });
    var sentTime = now.toLocaleString({ timeStyle: 'short' }, { locale: 'en-us' });
    return {
        id: id,
        sender: sender.userName, // todo
        sentDay: sentDay,
        sentTime: sentTime,
        content: text,
        isRead: true,
        resolvedId: undefined,
        isFromPatient: false,
    };
};
var ChatModal = (0, react_1.memo)(function (_a) {
    var appointment = _a.appointment, patient = _a.patient, onClose = _a.onClose, onMarkAllRead = _a.onMarkAllRead, quickTexts = _a.quickTexts;
    var theme = (0, material_1.useTheme)();
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var currentUser = (0, useEvolveUser_1.default)();
    var _b = (0, react_1.useState)([]), _messages = _b[0], _setMessages = _b[1];
    var _c = (0, react_1.useState)(''), messageText = _c[0], setMessageText = _c[1];
    var _d = (0, react_1.useState)(false), quickTextsOpen = _d[0], setQuickTextsOpen = _d[1];
    var _e = (0, react_1.useState)(constants_1.LANGUAGES.english), language = _e[0], setLanguage = _e[1];
    var _f = (0, react_1.useState)(true), isMessagingSetup = _f[0], setIsMessagingSetup = _f[1];
    var _g = (0, react_1.useState)(), pendingMessageSend = _g[0], setPendingMessageSend = _g[1];
    var patientFromAppointment = appointment.patient, model = appointment.smsModel;
    var timezone = luxon_1.DateTime.now().zoneName;
    var patientName;
    if ((patientFromAppointment === null || patientFromAppointment === void 0 ? void 0 : patientFromAppointment.firstName) || (patientFromAppointment === null || patientFromAppointment === void 0 ? void 0 : patientFromAppointment.lastName))
        patientName = "".concat((patientFromAppointment === null || patientFromAppointment === void 0 ? void 0 : patientFromAppointment.firstName) || '', " ").concat((patientFromAppointment === null || patientFromAppointment === void 0 ? void 0 : patientFromAppointment.lastName) || '');
    var numbersToSendTo = (0, react_1.useMemo)(function () {
        var _a;
        var numbers = ((_a = model === null || model === void 0 ? void 0 : model.recipients) !== null && _a !== void 0 ? _a : []).map(function (recipient) { return recipient.smsNumber; });
        var uniqueNumbers = Array.from(new Set(numbers));
        if (uniqueNumbers.length === 0) {
            return undefined;
        }
        else {
            if (uniqueNumbers.length > 1) {
                console.log('multiple numbers associated with this patient; using first');
            }
            return uniqueNumbers;
        }
    }, [model === null || model === void 0 ? void 0 : model.recipients]);
    var sendMessagesMutation = (0, chat_queries_1.useSendMessagesMutation)((model === null || model === void 0 ? void 0 : model.recipients) || [], messageText, function (sendResult) {
        if (sendResult) {
            setPendingMessageSend(sendResult);
            setMessageText('');
            void refetchMessages({ throwOnError: true });
        }
        else {
            throw new Error('send message failed - no id returned');
        }
    }, function (error) {
        console.error('send message failure: ', error);
        setPendingMessageSend(undefined);
    });
    var _h = (0, chat_queries_1.useFetchChatMessagesQuery)(timezone, numbersToSendTo, function (messages) {
        _setMessages(messages);
        setPendingMessageSend(undefined);
    }), isMessagesFetching = _h.isFetching, refetchMessages = _h.refetch;
    var messages = (0, react_1.useMemo)(function () {
        var pending = pendingMessageSend ? [pendingMessageSend] : [];
        var messagesToReturn = __spreadArray(__spreadArray([], _messages, true), pending, true);
        return [messagesToReturn];
    }, [_messages, pendingMessageSend])[0];
    var newMessagesStartId = (0, react_1.useMemo)(function () {
        var _a;
        return (_a = messages.find(function (message) {
            return !message.isRead;
        })) === null || _a === void 0 ? void 0 : _a.id;
    }, [messages]);
    var hasUnreadMessages = model === null || model === void 0 ? void 0 : model.hasUnreadMessages;
    var markAllRead = function () { return __awaiter(void 0, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(currentUser && oystehr && hasUnreadMessages)) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, utils_1.markAllMessagesRead)({
                            chat: messages,
                            user: currentUser,
                            oystehr: oystehr,
                        })];
                case 2:
                    _a.sent();
                    _setMessages(messages.map(function (m) {
                        return __assign(__assign({}, m), { isRead: true });
                    }));
                    onMarkAllRead();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.error('failed to mark messages as read: ', e_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleSendMessage = function (event, message) { return __awaiter(void 0, void 0, void 0, function () {
        var newPendingMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event.preventDefault();
                    if (message.trim() === '') {
                        return [2 /*return*/];
                    }
                    if (!currentUser) {
                        throw new Error("Message send failed. Current user is not defined");
                    }
                    newPendingMessage = makePendingSentMessage(message, timezone, currentUser);
                    setPendingMessageSend(newPendingMessage);
                    return [4 /*yield*/, sendMessagesMutation.mutateAsync(newPendingMessage)];
                case 1:
                    _a.sent();
                    void markAllRead();
                    return [2 /*return*/];
            }
        });
    }); };
    var quickTextStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 'sm',
        bgcolor: 'background.paper',
        boxShadow: 24,
        borderRadius: '4px',
        p: '8px 16px',
    };
    var selectQuickText = function (text) {
        setMessageText(text);
        setQuickTextsOpen(false);
    };
    var handleClose = function () {
        void markAllRead();
        onClose();
    };
    var hasQuickTextTranslations = function (quickTexts) {
        return typeof quickTexts[0] === 'object';
    };
    var MessageBodies = (0, react_1.useMemo)(function () {
        if (pendingMessageSend === undefined && isMessagesFetching) {
            return [];
        }
        return messages.map(function (message) {
            var _a;
            var contentKey = (_a = message.resolvedId) !== null && _a !== void 0 ? _a : message.id;
            var isPending = message.id === (pendingMessageSend === null || pendingMessageSend === void 0 ? void 0 : pendingMessageSend.id) || message.id === (pendingMessageSend === null || pendingMessageSend === void 0 ? void 0 : pendingMessageSend.resolvedId);
            return (<MessageBody key={message.id} isPending={isPending} contentKey={contentKey} message={message} hasNewMessageLine={newMessagesStartId !== undefined && message.id === newMessagesStartId} showDaySent={true} //keeping this config in case minds change again, YAGNI, I know
             timezone={timezone}/>);
        });
    }, [isMessagesFetching, messages, newMessagesStartId, pendingMessageSend, timezone]);
    (0, react_1.useEffect)(function () {
        if (MessageBodies.length) {
            scrollToBottomOfChat();
        }
    }, [MessageBodies.length]);
    var isMessagingConfigLoading = (0, chat_queries_1.useGetMessagingConfigQuery)(function (data) {
        if (!data.transactionalSMSConfig && !data.conversationConfig) {
            setIsMessagingSetup(false);
        }
    }).isLoading;
    var handleSetup = function () {
        window.open('https://docs.oystehr.com/ottehr/setup/messaging/', '_blank');
    };
    return (<material_1.Dialog open={true} onClose={handleClose} aria-labelledby="modal-title" aria-describedby="modal-description" maxWidth="md" fullWidth>
        <form>
          <material_1.Grid container>
            <material_1.Grid item xs={12} sx={{ margin: '24px 24px 16px 24px' }}>
              <Typography_1.default id="modal-title" variant="h4" sx={{ fontWeight: 600, color: theme.palette.primary.dark }}>
                Chat with {patientName || (0, utils_2.getPatientName)(patient === null || patient === void 0 ? void 0 : patient.name).firstLastName}
              </Typography_1.default>
              <Typography_1.default id="modal-description" variant="h5" data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.chatModalDescription} sx={{ fontWeight: 600, color: theme.palette.primary.dark }}>
                {numbersToSendTo ? numbersToSendTo.join(',') : ''}
              </Typography_1.default>
              <material_1.IconButton aria-label="Close" onClick={handleClose} sx={{
            position: 'absolute',
            right: 16,
            top: 16,
        }}>
                <icons_material_1.Close />
              </material_1.IconButton>
            </material_1.Grid>
            <material_1.Grid item xs={12}>
              <material_1.Divider />
            </material_1.Grid>
          </material_1.Grid>
          <material_1.Grid container id="message-container" sx={{ height: '400px', overflowY: 'scroll', padding: '24px 32px 16px 24px' }}>
            {(pendingMessageSend === undefined && isMessagesFetching) || isMessagingConfigLoading ? (<material_1.Grid item xs={12} sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <material_1.CircularProgress />
              </material_1.Grid>) : (<>{MessageBodies}</>)}
          </material_1.Grid>
          {!isMessagingSetup && !isMessagingConfigLoading && (<material_1.Grid item sx={{ margin: '24px' }}>
              <CompleteConfiguration_1.CompleteConfiguration handleSetup={handleSetup}/>
            </material_1.Grid>)}
          <material_1.Divider />
          <material_1.Grid container sx={{ margin: '16px 0 16px 24px' }}>
            <material_1.Grid item xs={8.35}>
              <material_1.TextField id="patient-message" label="Message to the patient" value={messageText} onPaste={function (e) { return e.preventDefault(); }} disabled={pendingMessageSend !== undefined} autoComplete="off" onChange={function (event) { return setMessageText(event.target.value); }} onKeyDown={function (e) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(e.key === 'Enter' && !e.shiftKey)) return [3 /*break*/, 2];
                        return [4 /*yield*/, handleSendMessage(e, messageText)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        }); }} fullWidth multiline/>
            </material_1.Grid>

            <material_1.Grid item xs={3} sx={{ alignSelf: 'center', textAlign: 'center', display: 'flex' }}>
              <lab_1.LoadingButton sx={{ marginX: 1, borderRadius: '100px', textTransform: 'none', fontWeight: 500 }} variant="outlined" onClick={function () { return setQuickTextsOpen(true); }} disabled={pendingMessageSend !== undefined}>
                Quick text
              </lab_1.LoadingButton>
              <lab_1.LoadingButton sx={{
            background: theme.palette.primary.main,
            borderRadius: '100px',
            textTransform: 'none',
        }} variant="contained" 
    // size="small"
    startIcon={<Send_1.default />} onClick={function (event) { return handleSendMessage(event, messageText); }} loading={pendingMessageSend !== undefined} type="submit">
                Send
              </lab_1.LoadingButton>
            </material_1.Grid>
          </material_1.Grid>
          <material_1.Modal open={quickTextsOpen} onClose={function () {
            setQuickTextsOpen(false);
        }}>
            <material_1.Grid container sx={quickTextStyle}>
              <material_1.Grid item sx={{ marginTop: '6px', width: '100%' }}>
                <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography_1.default variant="h6" sx={{ fontWeight: '600 !important', color: theme.palette.primary.main, marginBottom: '4px' }}>
                    Quick texts
                  </Typography_1.default>
                  {hasQuickTextTranslations(quickTexts) && (<material_1.ToggleButtonGroup sx={{
                '& .MuiToggleButton-sizeSmall': {
                    textTransform: 'none',
                    color: theme.palette.primary.main,
                    fontSize: '13px',
                    fontWeight: 500,
                },
                '& .MuiToggleButton-sizeSmall:hover': {
                    color: theme.palette.primary.contrastText,
                    backgroundColor: theme.palette.primary.light,
                },
                '& .Mui-selected': {
                    color: "".concat(theme.palette.primary.contrastText, " !important"),
                    backgroundColor: "".concat(theme.palette.primary.main, " !important"),
                    textTransform: 'none',
                },
            }} size="small" exclusive value={language} onChange={function (e, value) {
                setLanguage(value);
            }}>
                      <material_1.ToggleButton value={constants_1.LANGUAGES.english} sx={{ padding: '4px 10px 4px 10px' }}>
                        English
                      </material_1.ToggleButton>
                      <material_1.ToggleButton value={constants_1.LANGUAGES.spanish} sx={{ padding: '4px 10px 4px 10px' }}>
                        Spanish
                      </material_1.ToggleButton>
                    </material_1.ToggleButtonGroup>)}
                </material_1.Box>
                <Typography_1.default variant="body2">Select the text to populate the message to the patient</Typography_1.default>
              </material_1.Grid>
              <material_1.Grid item>
                <material_1.List sx={{ padding: 0 }}>
                  {hasQuickTextTranslations(quickTexts)
            ? quickTexts
                .filter(function (text) { return text[language]; })
                .map(function (text) { return (<material_1.ListItem key={text[language]} sx={{
                    padding: 1,
                    my: '12px',
                    backgroundColor: 'rgba(77, 21, 183, 0.04)',
                    cursor: 'pointer',
                }} onClick={function () { return selectQuickText(text[language]); }}>
                            <Typography_1.default variant="body1">{text[language]}</Typography_1.default>
                          </material_1.ListItem>); })
            : quickTexts.map(function (text) {
                return (<material_1.ListItem key={text} sx={{
                        padding: 1,
                        my: '12px',
                        backgroundColor: 'rgba(77, 21, 183, 0.04)',
                        cursor: 'pointer',
                    }} onClick={function () { return selectQuickText((0, utils_2.removeHtmlTags)(text)); }}>
                            <Typography_1.default variant="body1">{parseTextToJSX(text)}</Typography_1.default>
                          </material_1.ListItem>);
            })}
                </material_1.List>
              </material_1.Grid>
            </material_1.Grid>
          </material_1.Modal>
        </form>
      </material_1.Dialog>);
});
exports.default = ChatModal;
var MessageBody = function (props) {
    var isPending = props.isPending, message = props.message, contentKey = props.contentKey, hasNewMessageLine = props.hasNewMessageLine, showDaySent = props.showDaySent, timezone = props.timezone;
    var theme = (0, material_1.useTheme)();
    var authorInitials = (0, utils_1.initialsFromName)(message.sender);
    var sentTimeLabel = (function () {
        if (!message.sentTime || !message.sentDay)
            return '';
        var sentDate = luxon_1.DateTime.fromFormat("".concat(message.sentDay, " ").concat(message.sentTime), 'M/d/yy h:mm a', {
            zone: timezone,
        });
        return sentDate.toFormat('M/d/yy h:mm a ZZZZ', { locale: 'en-US' });
    })();
    return (<material_1.Grid container item key={contentKey} spacing={3} sx={{ opacity: isPending ? '0.5' : '1.0' }}>
      {hasNewMessageLine && (<material_1.Grid item xs={12}>
          <material_1.Divider sx={{
                '&::before, &::after': { borderTop: "thin solid ".concat(theme.palette.warning.main) },
                color: theme.palette.warning.main,
            }}>
            New messages
          </material_1.Divider>
        </material_1.Grid>)}
      <material_1.Grid item container display={'table-row-group'} xs={12} spacing={0}>
        {showDaySent && (<material_1.Grid item xs={12} sx={{ paddingBottom: '0px' }}>
            <Typography_1.default variant="body1" color={'rgb(0, 0, 0, 0.7)'} textAlign="center" sx={{
                paddingTop: '40px',
            }}>
              {"".concat(sentTimeLabel)}
            </Typography_1.default>
          </material_1.Grid>)}
        <material_1.Grid item container xs={12} display={'table-row'} sx={{
            opacity: isPending ? '0.5' : '1.0',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
        }}>
          <material_1.Avatar sx={{
            backgroundColor: message.isFromPatient ? theme.palette.secondary.main : theme.palette.primary.main,
            fontSize: authorInitials.length > 3 ? '12px' : '16px',
            marginInlineEnd: '8px',
        }}>
            {authorInitials}
          </material_1.Avatar>
          <Typography_1.default variant="body1" color="primary.dark" fontWeight={600}>
            {message.sender}
          </Typography_1.default>
        </material_1.Grid>
        <material_1.Grid item container display={'table-row'} xs={12} sx={{
            opacity: isPending ? '0.5' : '1.0',
            padding: '2px',
            paddingTop: '8px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
        }}>
          <material_1.Grid item xs={11}>
            <Typography_1.default variant="body1" sx={{ whiteSpace: 'pre-line', paddingBottom: '20px' }}>
              {message.content}
            </Typography_1.default>
          </material_1.Grid>
          <material_1.Grid item xs={1}>
            {/*
          more yagni...
          <Typography variant="body1" color={'rgb(0, 0, 0, 0.7)'} sx={{ marginLeft: '10px' }} textAlign="right">
          {message.sentTime}
        </Typography>
        */}
          </material_1.Grid>
        </material_1.Grid>
      </material_1.Grid>
    </material_1.Grid>);
};
function parseTextToJSX(text) {
    // Split the string at the custom HTML tag
    var parts = text.split(/(<phone.*?<\/phone>)/g).filter(Boolean);
    return parts.map(function (part, index) {
        if (part.startsWith('<phone')) {
            // Extract the content inside the custom HTML tag
            var match = part.match(/<phone[^>]*>(.*?)<\/phone>/);
            if (match) {
                return (<span key={index} style={{ whiteSpace: 'nowrap' }}>
            {match[1]}
          </span>);
            }
        }
        return <span key={index}>{part}</span>;
    });
}
//# sourceMappingURL=ChatModal.js.map