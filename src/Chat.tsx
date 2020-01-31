import * as React from 'react';
import { findDOMNode } from 'react-dom';

import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

import { Activity, CardActionTypes, ConnectionStatus, DirectLine, DirectLineOptions, IBotConnection, User } from 'botframework-directlinejs';
import { Provider } from 'react-redux';
import { getTabIndex } from './getTabIndex';
import * as konsole from './Konsole';
import { Speech } from './SpeechModule';
import { SpeechOptions } from './SpeechOptions';
import { ChatActions, createStore, HistoryAction, sendMessage, WindowState } from './Store';
import { ActivityOrID, FormatOptions } from './Types';

import { Cookies } from 'react-cookie';

export interface ChatProps {
    adaptiveCardsHostConfig: any;
    bot: User;
    botConnection?: IBotConnection;
    chatTitle?: boolean | string;
    directLine?: DirectLineOptions;
    disabled?: boolean;
    formatOptions?: FormatOptions;
    locale?: string;
    history?: () => Promise<Activity[]>;
    resize?: 'none' | 'window' | 'detect';
    selectedActivity?: BehaviorSubject<ActivityOrID>;
    sendTyping?: boolean;
    showUploadButton?: boolean;
    speechOptions?: SpeechOptions;
    user: User;
    botIconUrl: string;
    chatIconColor: string;
    chatIconMessage?: string;
    showBrandMessage: boolean;
    brandMessage: string;
    windowStatus: WindowState;
    hideHeader: boolean;
}

import { History } from './History';
import { MessagePane } from './MessagePane';
import { Shell, ShellFunctions } from './Shell';

export class Chat extends React.Component<ChatProps, {}> {

    private store = createStore();

    private user: User;
    private botConnection: IBotConnection;

    private activitySubscription: Subscription;
    private connectionStatusSubscription: Subscription;
    private selectedActivitySubscription: Subscription;
    private shellRef: React.Component & ShellFunctions;
    private historyRef: React.Component;
    private chatviewPanelRef: HTMLElement;
    private firstLoad: boolean;

    private resizeListener = () => this.setSize();

    // tslint:disable:variable-name
    private _handleCardAction = this.handleCardAction.bind(this);
    private _handleKeyDownCapture = this.handleKeyDownCapture.bind(this);
    private _saveChatviewPanelRef = this.saveChatviewPanelRef.bind(this);
    private _saveHistoryRef = this.saveHistoryRef.bind(this);
    private _saveShellRef = this.saveShellRef.bind(this);

    private hasHistory: boolean;
    // tslint:enable:variable-name

    getUser() {
        const user = { ...this.props.user };

        if (!this.props.user) {
            // Get the cookies bui and bun
            const cookie = new Cookies();
            const botUserId = cookie.get('bui');
            const botUserName = cookie.get('bun');

            user.id = botUserId ? botUserId : `${this.store.getState().format.strings.anonymousUsername} ${(Math.random() * 1000000).toString().substring(0, 5)}`;
            user.name = botUserName ? botUserName : user.id;
            user.role = 'user';

            // Set the cookies bui and bun
            cookie.set('bui', user.id, { path: '/', maxAge: 1000 * 3600 });
            cookie.set('bun', user.name, { path: '/', maxAge: 1000 * 3600 });
        }

        return user;
    }
    constructor(props: ChatProps) {
        super(props);

        konsole.log('BotChat.Chat props', props);

        this.store.dispatch<ChatActions>({
            type: 'Set_Locale',
            locale: props.locale || (window.navigator as any).userLanguage || window.navigator.language || 'en'
        });

        this.user = this.getUser();

        if (typeof props.windowStatus !== 'undefined' && typeof props.windowStatus.visible !== 'undefined') {
            this.store.dispatch<ChatActions>({ type: 'Set_Status', visible: props.windowStatus.visible });
        }

        if (typeof props.chatIconColor !== 'undefined') {
            this.store.dispatch<ChatActions>({ type: 'Set_ChatIcon_Color', chatIconColor: props.chatIconColor });
        }

        if (typeof props.chatIconMessage !== 'undefined' && props.chatIconMessage !== '') {
            this.store.dispatch<ChatActions>({ type: 'Set_ChatIcon_Message', chatIconMessage: props.chatIconMessage });
        }

        if (typeof props.showBrandMessage !== 'undefined') {
            this.store.dispatch<ChatActions>({ type: 'Set_BrandMessage_Status', showBrandMessage: props.showBrandMessage });
            if (typeof props.brandMessage !== 'undefined') {
                this.store.dispatch<ChatActions>({ type: 'Set_BrandMessage', brandMessage: props.brandMessage });
            } else {
                this.store.dispatch<ChatActions>({ type: 'Set_BrandMessage', brandMessage: 'Powered by Intelequia' });
            }
        }

        if (typeof props.hideHeader !== 'undefined') {
            this.store.dispatch<ChatActions>({ type: 'Set_HideHeader', hideHeader: props.hideHeader });
        }

        if (props.adaptiveCardsHostConfig) {
            this.store.dispatch<ChatActions>({
                type: 'Set_AdaptiveCardsHostConfig',
                payload: props.adaptiveCardsHostConfig
            });
        }

        let { chatTitle } = props;

        if (props.formatOptions) {
            console.warn('DEPRECATED: "formatOptions.showHeader" is deprecated, use "chatTitle" instead. See https://github.com/Microsoft/BotFramework-WebChat/blob/master/CHANGELOG.md#formatoptionsshowheader-is-deprecated-use-chattitle-instead.');

            if (typeof props.formatOptions.showHeader !== 'undefined' && typeof props.chatTitle === 'undefined') {
                chatTitle = props.formatOptions.showHeader;
            }
        }

        if (typeof chatTitle !== 'undefined') {
            this.store.dispatch<ChatActions>({ type: 'Set_Chat_Title', chatTitle });
        }

        if (typeof props.botIconUrl !== 'undefined') {
            this.store.dispatch<ChatActions>({ type: 'Set_BotIcon_Url', botIconUrl: props.botIconUrl });
        }

        this.store.dispatch<ChatActions>({ type: 'Toggle_Upload_Button', showUploadButton: props.showUploadButton === false });

        if (props.sendTyping) {
            this.store.dispatch<ChatActions>({ type: 'Set_Send_Typing', sendTyping: props.sendTyping });
        }

        if (props.speechOptions) {
            Speech.SpeechRecognizer.setSpeechRecognizer(props.speechOptions.speechRecognizer);
            Speech.SpeechSynthesizer.setSpeechSynthesizer(props.speechOptions.speechSynthesizer);
        }

        this.hasHistory = false; // We dont know yet if it has history indeed
    }

    private handleIncomingActivity(activity: Activity) {
        const state = this.store.getState();
        switch (activity.type) {
            case 'message':
                this.store.dispatch<ChatActions>({ type: activity.from.id === state.connection.user.id ? 'Receive_Sent_Message' : 'Receive_Message', activity });
                break;

            case 'typing':
                if (activity.from.id !== state.connection.user.id) {
                    this.store.dispatch<ChatActions>({ type: 'Show_Typing', activity });
                }
                break;
        }
    }

    private setSize() {
        this.store.dispatch<ChatActions>({
            type: 'Set_Size',
            width: this.chatviewPanelRef.offsetWidth,
            height: this.chatviewPanelRef.offsetHeight
        });
    }

    private handleCardAction() {
        try {
            // After the user click on any card action, we will "blur" the focus, by setting focus on message pane
            // This is for after click on card action, the user press "A", it should go into the chat box
            const historyDOM = findDOMNode(this.historyRef) as HTMLElement;

            if (historyDOM) {
                historyDOM.focus();
            }
        } catch (err) {
            // In Emulator production build, React.findDOMNode(this.historyRef) will throw an exception saying the
            // component is unmounted. I verified we did not miss any saveRef calls, so it looks weird.
            // Since this is an optional feature, I am try-catching this for now. We should find the root cause later.
            //
            // Some of my thoughts, React version-compatibility problems.
        }
    }

    private handleKeyDownCapture(evt: React.KeyboardEvent<HTMLDivElement>) {
        const target = evt.target as HTMLElement;
        const tabIndex = getTabIndex(target);

        if (
            evt.altKey
            || evt.ctrlKey
            || evt.metaKey
            || (!inputtableKey(evt.key) && evt.key !== 'Backspace')
        ) {
            // Ignore if one of the utility key (except SHIFT) is pressed
            // E.g. CTRL-C on a link in one of the message should not jump to chat box
            // E.g. "A" or "Backspace" should jump to chat box
            return;
        }

        if (
            target === findDOMNode(this.historyRef)
            || typeof tabIndex !== 'number'
            || tabIndex < 0
        ) {
            evt.stopPropagation();

            let key: string;

            // Quirks: onKeyDown we re-focus, but the newly focused element does not receive the subsequent onKeyPress event
            //         It is working in Chrome/Firefox/IE, confirmed not working in Edge/16
            //         So we are manually appending the key if they can be inputted in the box
            if (/(^|\s)Edge\/16\./.test(navigator.userAgent)) {
                key = inputtableKey(evt.key);
            }

            // shellRef is null if Web Chat is disabled
            if (this.shellRef) {
                this.shellRef.focus(key);
            }
        }
    }

    private saveChatviewPanelRef(chatviewPanelRef: HTMLElement) {
        this.chatviewPanelRef = chatviewPanelRef;
    }

    private saveHistoryRef(historyWrapper: any) {
        this.historyRef = historyWrapper && historyWrapper.getWrappedInstance();
    }

    private saveShellRef(shellWrapper: any) {
        this.shellRef = shellWrapper && shellWrapper.getWrappedInstance();
    }

    startConnection() {
        const botConnection = this.props.directLine
            ? (this.botConnection = new DirectLine(this.props.directLine))
            : this.props.botConnection;

        if (this.props.resize === 'window') {
            window.addEventListener('resize', this.resizeListener);
        }
        this.props.history().then(value => {
            if (value.length > 0) {
                this.store.dispatch<HistoryAction>({
                    type: 'Set_History',
                    activities: value
                });
                this.hasHistory = true;
            }
        }).then(_ => {
            // this.store.dispatch<ChatActions>({ type: 'Start_Connection', user: this.props.user, bot: this.props.bot, botConnection, selectedActivity: this.props.selectedActivity });
            this.store.dispatch<ChatActions>({ type: 'Start_Connection', user: this.user, bot: this.props.bot, botConnection, selectedActivity: this.props.selectedActivity });

            this.connectionStatusSubscription = botConnection.connectionStatus$.subscribe(connectionStatus => {
                if (this.props.speechOptions && this.props.speechOptions.speechRecognizer) {
                    const refGrammarId = botConnection.referenceGrammarId;
                    if (refGrammarId) {
                        this.props.speechOptions.speechRecognizer.referenceGrammarId = refGrammarId;
                    }
                }
                if (connectionStatus === ConnectionStatus.Online && !this.hasHistory) {
                    const cookie = new Cookies();
                    const b  = botConnection as DirectLine;
                    const conversationId = cookie.get('bci');
                    if (!conversationId && b && b.conversationId) {
                        cookie.set('bci', b.conversationId, { path: '/', maxAge: 1000 * 3600 });
                    }
                    sendEventPostBack(botConnection, 'StartConversation', { locale: this.props.locale }, this.user);
                }
                this.store.dispatch<ChatActions>({ type: 'Connection_Change', connectionStatus });
            }
            );

            this.activitySubscription = botConnection.activity$.subscribe(
                activity => this.handleIncomingActivity(activity),
                error => konsole.log('activity$ error', error)
            );

            if (this.props.selectedActivity) {
                this.selectedActivitySubscription = this.props.selectedActivity.subscribe(activityOrID => {
                    this.store.dispatch<ChatActions>({
                        type: 'Select_Activity',
                        selectedActivity: activityOrID.activity || this.store.getState().history.activities.find(activity => activity.id === activityOrID.id)
                    });
                });
            }
        });
    }

    componentWillMount() {
        this.firstLoad = true;
    }
    componentDidMount() {
        // Now that we're mounted, we know our dimensions. Put them in the store (this will force a re-render)
        this.setSize();
        if (this.store.getState().windowState.visible) {
            this.startConnection();
        }
        this.firstLoad = false;
    }

    componentWillUnmount() {
        this.connectionStatusSubscription.unsubscribe();
        this.activitySubscription.unsubscribe();
        if (this.selectedActivitySubscription) {
            this.selectedActivitySubscription.unsubscribe();
        }
        if (this.botConnection) {
            this.botConnection.end();
        }
        window.removeEventListener('resize', this.resizeListener);
    }

    componentWillReceiveProps(nextProps: ChatProps) {
        if (this.props.adaptiveCardsHostConfig !== nextProps.adaptiveCardsHostConfig) {
            this.store.dispatch<ChatActions>({
                type: 'Set_AdaptiveCardsHostConfig',
                payload: nextProps.adaptiveCardsHostConfig
            });
        }

        if (this.props.showUploadButton !== nextProps.showUploadButton) {
            this.store.dispatch<ChatActions>({
                type: 'Toggle_Upload_Button',
                showUploadButton: nextProps.showUploadButton
            });
        }

        if (this.props.chatTitle !== nextProps.chatTitle) {
            this.store.dispatch<ChatActions>({
                type: 'Set_Chat_Title',
                chatTitle: nextProps.chatTitle
            });
        }
    }

    onClickChatIcon() {
        this.store.dispatch<ChatActions>({
            type: 'Set_Status',
            visible: true
        });
        if (!this.store.getState().connection.botConnection) {  // If this is the first time the chat window is opened, we have to start the conversation
            this.props.history().then(value => {
                this.startConnection();
                this.forceUpdate(); // I had to do this; I don't know why this dispatch doesn't force a re-render
            });
        }
        this.forceUpdate();     // I had to do this; I don't know why this dispatch doesn't force a re-render
    }

    onCloseWindow() {
        this.store.dispatch<ChatActions>({
            type: 'Set_Status',
            visible: false
        });
        this.forceUpdate();     // I had to do this; I don't know why this dispatch doesn't force a re-render
    }

    // At startup we do three render passes:
    // 1. To determine the dimensions of the chat panel (nothing needs to actually render here, so we don't)
    // 2. To determine the margins of any given carousel (we just render one mock activity so that we can measure it)
    // 3. (this is also the normal re-render case) To render without the mock activity

    render() {
        const state = this.store.getState();
        konsole.log('BotChat.Chat state', state);

        const headerBotIcon = state.format.botIconUrl ? <div className="bot-icon" style={{ backgroundImage: `url(${state.format.botIconUrl})` }}></div> : <div></div>;
        const headerCloseButton = <div onClick={this.onCloseWindow.bind(this)} className="chat-close-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">
                <path d="M1115 1024 L1658 1567 Q1677 1586 1677 1612.5 Q1677 1639 1658 1658 Q1639 1676 1612 1676 Q1587 1676 1567 1658 L1024 1115 L481 1658 Q462 1676 436 1676 Q410 1676 390 1658 Q371 1639 371 1612.5 Q371 1586 390 1567 L934 1024 L390 481 Q371 462 371 435.5 Q371 409 390 390 Q410 372 436 372 Q462 372 481 390 L1024 934 L1567 390 Q1587 372 1612 372 Q1639 372 1658 390 Q1677 409 1677 435.5 Q1677 462 1658 481 L1115 1024 Z "></path>
            </svg>
        </div>;
        // only render real stuff after we know our dimensions
        return (
            <div>
                {!!state.format.chatIconMessage &&
                    <div
                        className={`chat-button-message ${state.windowState.visible ? 'open' : 'close'}-button-${this.firstLoad ? 'no-animate' : 'animate'}`}>
                        <div className="chat-button-message-arrow"></div>
                        <a onClick={this.onClickChatIcon.bind(this)}>
                            <span>{state.format.chatIconMessage}</span>
                        </a>
                    </div>
                }
                <div
                    className={`chat-button ${state.windowState.visible ? 'open' : 'close'}-button-${this.firstLoad ? 'no-animate' : 'animate'}`}
                    style={{ backgroundColor: `${state.format.chatIconColor}` }}>
                    <a onClick={this.onClickChatIcon.bind(this)} className="chat-button-icon">
                        <span>
                            <svg viewBox="0 0 256 256">
                                <g>
                                    <path id="path1" transform="rotate(0,128,128) translate(54,63.7125017642975) scale(4.625,4.625)  " fill="#FFFFFF" d="M22.900024,11.400001C21.600037,11.400001 20.600037,12.400001 20.600037,13.700004 20.600037,14.99999 21.600037,15.999989 22.900024,15.999989 24.200012,15.999989 25.200012,14.99999 25.200012,13.700004 25.100037,12.499992 24.100037,11.400001 22.900024,11.400001z M16,11.400001C14.700012,11.400001 13.700012,12.400001 13.700012,13.700004 13.700012,14.99999 14.700012,15.999989 16,15.999989 17.299988,15.999989 18.299988,14.99999 18.299988,13.700004 18.299988,12.499992 17.299988,11.400001 16,11.400001z M9.1000366,11.400001C7.7999878,11.400001 6.7999878,12.400001 6.7999878,13.700004 6.7999878,14.99999 7.7999878,15.999989 9.1000366,15.999989 10.400024,15.999989 11.400024,14.99999 11.400024,13.700004 11.400024,12.499992 10.400024,11.400001 9.1000366,11.400001z M16,0C24.799988,7.0681381E-08 32,5.6000027 32,12.599997 32,19.499988 24.799988,25.199996 16,25.199996 13.900024,25.199996 11.900024,24.899978 10.100037,24.300002 8.2000122,25.699996 5.1000366,27.8 2.1000366,27.8 3.7000122,26.300002 4.2000122,23.39998 4.2999878,21.199998 1.6000366,18.899981 0,15.899999 0,12.599997 0,5.6000027 7.2000122,7.0681381E-08 16,0z" />
                                </g>
                            </svg>
                        </span>
                    </a>
                </div>
                <Provider store={this.store}>
                    <div
                        className={`chat-window ${state.windowState.visible ? 'open' : 'close'}-chat-${this.firstLoad ? 'no-animate' : 'animate'}`}>
                        <div
                            className="wc-chatview-panel"
                            // className={ `wc-chatview-panel ${state.windowState.visible ? 'open-chat' : this.firstLoad ? 'close-chat-no-animate' : 'close-chat-animate'}` }
                            onKeyDownCapture={this._handleKeyDownCapture}
                            ref={this._saveChatviewPanelRef}
                        >
                            {
                                !!state.format.chatTitle &&
                                <div className={`wc-header ${state.format.hideHeader ? 'wc-hide' : ''}`}>
                                    {headerBotIcon}
                                    <span>{typeof state.format.chatTitle === 'string' ? state.format.chatTitle : state.format.strings.title}</span>
                                    {headerCloseButton}
                                </div>
                            }
                            <MessagePane disabled={this.props.disabled}>
                                <History
                                    disabled={this.props.disabled}
                                    onCardAction={this._handleCardAction}
                                    ref={this._saveHistoryRef}
                                    showBrandMessage={state.format.showBrandMessage}
                                />
                            </MessagePane>
                            {
                                !this.props.disabled && <Shell
                                    ref={this._saveShellRef}
                                    showBrandMessage={state.format.showBrandMessage}
                                />
                            }
                            {
                                this.props.resize === 'detect' &&
                                <ResizeDetector onresize={this.resizeListener} />
                            }
                            {
                                state.format.showBrandMessage && <div className="wc-brandmessage">{state.format.brandMessage}</div>
                            }
                        </div>
                    </div>
                </Provider>
            </div>
        );
    }
}

export type IDoCardAction = (type: CardActionTypes, value: string | object) => void;

export const doCardAction = (
    botConnection: IBotConnection,
    from: User,
    locale: string,
    sendMessage: (value: string, user: User, locale: string) => void
): IDoCardAction => (
    type,
    actionValue
) => {
        const text = (typeof actionValue === 'string') ? actionValue as string : undefined;
        const value = (typeof actionValue === 'object') ? actionValue as object : undefined;

        switch (type) {
            case 'imBack':
                if (typeof text === 'string') {
                    sendMessage(text, from, locale);
                }
                break;
            case 'postBack':
                sendPostBack(botConnection, text, value, from, locale);
                break;
            case 'call':
            case 'openUrl':
            case 'playAudio':
            case 'playVideo':
            case 'showImage':
            case 'downloadFile':
                window.open(text);
                break;
            case 'signin':
                const loginWindow = window.open();
                if (botConnection.getSessionId) {
                    botConnection.getSessionId().subscribe(sessionId => {
                        konsole.log('received sessionId: ' + sessionId);
                        loginWindow.location.href = text + encodeURIComponent('&code_challenge=' + sessionId);
                    }, error => {
                        konsole.log('failed to get sessionId', error);
                    });
                } else {
                    loginWindow.location.href = text;
                }
                break;

            default:
                konsole.log('unknown button type', type);
        }
    };

export const sendPostBack = (botConnection: IBotConnection, text: string, value: object, from: User, locale: string) => {
    botConnection.postActivity({
        type: 'message',
        text,
        value,
        from,
        locale,
        channelData: {
            postback: true
        }
    })
        .subscribe(
            id => konsole.log('success sending postBack', id),
            error => konsole.log('failed to send postBack', error)
        );
};

export const sendEventPostBack = (botConnection: IBotConnection, name: string, value: object, from: User) => {
    botConnection.postActivity({
        type: 'event',
        name,
        value,
        from,
        channelData: {
            postback: true
        }
    })
        .subscribe(
            id => konsole.log('success sending postBack', id),
            error => konsole.log('failed to send postBack', error)
        );
};

export const renderIfNonempty = (value: any, renderer: (value: any) => JSX.Element) => {
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > 0)) {
        return renderer(value);
    }
};

export const classList = (...args: Array<string | boolean>) => {
    return args.filter(Boolean).join(' ');
};

// note: container of this element must have CSS position of either absolute or relative
const ResizeDetector = (props: {
    onresize: () => void
}) =>
    // adapted to React from https://github.com/developit/simple-element-resize-detector
    <iframe
        style={{
            border: 'none',
            height: '100%',
            left: 0,
            margin: '1px 0 0',
            opacity: 0,
            pointerEvents: 'none',
            position: 'absolute',
            top: '-100%',
            visibility: 'hidden',
            width: '100%'
        }}
        ref={frame => {
            if (frame) {
                frame.contentWindow.onresize = props.onresize;
            }
        }}
    />;

// For auto-focus in some browsers, we synthetically insert keys into the chatbox.
// By default, we insert keys when:
// 1. evt.key.length === 1 (e.g. "1", "A", "=" keys), or
// 2. evt.key is one of the map keys below (e.g. "Add" will insert "+", "Decimal" will insert ".")
const INPUTTABLE_KEY: { [key: string]: string } = {
    Add: '+',      // Numpad add key
    Decimal: '.',  // Numpad decimal key
    Divide: '/',   // Numpad divide key
    Multiply: '*', // Numpad multiply key
    Subtract: '-'  // Numpad subtract key
};

function inputtableKey(key: string) {
    return key.length === 1 ? key : INPUTTABLE_KEY[key];
}
