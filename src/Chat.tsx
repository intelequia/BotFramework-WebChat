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
import { ChatActions, createStore, sendMessage, WindowState } from './Store';
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
    resize?: 'none' | 'window' | 'detect';
    selectedActivity?: BehaviorSubject<ActivityOrID>;
    sendTyping?: boolean;
    showUploadButton?: boolean;
    speechOptions?: SpeechOptions;
    user: User;
    botIconUrl: string;
    chatIconColor: string;
    showBrandMessage: boolean;
    brandMessage: string;
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

    private resizeListener = () => this.setSize();

    // tslint:disable:variable-name
    private _handleCardAction = this.handleCardAction.bind(this);
    private _handleKeyDownCapture = this.handleKeyDownCapture.bind(this);
    private _saveChatviewPanelRef = this.saveChatviewPanelRef.bind(this);
    private _saveHistoryRef = this.saveHistoryRef.bind(this);
    private _saveShellRef = this.saveShellRef.bind(this);
    // tslint:enable:variable-name

    getUser() {
        const user = { ...this.props.user };

        if (!this.props.user) {
            // Get the cookies Bot-UserId and Bot-UserName
            const cookie = new Cookies();
            const botUserId = cookie.get('Bot-UserId');
            const botUserName = cookie.get('Bot-UserName');

            user.id = botUserId ? botUserId : `${this.store.getState().format.strings.anonymousUsername} ${(Math.random() * 1000000).toString().substring(0, 5)}`;
            user.name = botUserName ? botUserName : user.id;
            user.role = 'user';

            // Set the cookies Bot-UserId and Bot-UserName
            cookie.set('Bot-UserId', user.id, { path: '/' });
            cookie.set('Bot-UserName', user.name, { path: '/' });
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

        if (typeof props.chatIconColor !== 'undefined') {
            this.store.dispatch<ChatActions>({ type: 'Set_ChatIcon_Color', chatIconColor: props.chatIconColor });
        }

        if (typeof props.showBrandMessage !== 'undefined') {
            this.store.dispatch<ChatActions>({ type: 'Set_BrandMessage_Status', showBrandMessage: props.showBrandMessage });
            if (typeof props.brandMessage !== 'undefined') {
                this.store.dispatch<ChatActions>({ type: 'Set_BrandMessage', brandMessage: props.brandMessage });
            } else {
                this.store.dispatch<ChatActions>({ type: 'Set_BrandMessage', brandMessage: 'Powered by Intelequia' });
            }
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
        // this.store.dispatch<ChatActions>({ type: 'Start_Connection', user: this.props.user, bot: this.props.bot, botConnection, selectedActivity: this.props.selectedActivity });
        this.store.dispatch<ChatActions>({ type: 'Start_Connection', user: this.user, bot: this.props.bot, botConnection, selectedActivity: this.props.selectedActivity });

        this.connectionStatusSubscription = botConnection.connectionStatus$.subscribe(connectionStatus => {
                if (this.props.speechOptions && this.props.speechOptions.speechRecognizer) {
                    const refGrammarId = botConnection.referenceGrammarId;
                    if (refGrammarId) {
                        this.props.speechOptions.speechRecognizer.referenceGrammarId = refGrammarId;
                    }
                }
                if (connectionStatus === ConnectionStatus.Online) {
                    sendEventPostBack(botConnection, 'StartConversation', {locale: this.props.locale}, this.user);
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
    }

    componentDidMount() {
        // Now that we're mounted, we know our dimensions. Put them in the store (this will force a re-render)
        this.setSize();

        if (this.store.getState().windowState.visible) {
            this.startConnection();
        }
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
            this.startConnection();
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

        const headerBotIcon = state.format.botIconUrl ? <div className="bot-icon" style={{backgroundImage: `url(${state.format.botIconUrl})`}}></div> : <div></div>;
        const headerCloseButton =   <div onClick={this.onCloseWindow.bind(this)} className="chat-close-button">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">
                                            <path d="M1115 1024 L1658 1567 Q1677 1586 1677 1612.5 Q1677 1639 1658 1658 Q1639 1676 1612 1676 Q1587 1676 1567 1658 L1024 1115 L481 1658 Q462 1676 436 1676 Q410 1676 390 1658 Q371 1639 371 1612.5 Q371 1586 390 1567 L934 1024 L390 481 Q371 462 371 435.5 Q371 409 390 390 Q410 372 436 372 Q462 372 481 390 L1024 934 L1567 390 Q1587 372 1612 372 Q1639 372 1658 390 Q1677 409 1677 435.5 Q1677 462 1658 481 L1115 1024 Z "></path>
                                        </svg>
                                    </div>;
        // only render real stuff after we know our dimensions
        return (
            <div>
                <div
                    className={ `chat-button ${state.windowState.visible ? 'open-button' : 'close-button'}` }
                    style={{backgroundColor: `${state.format.chatIconColor}`}}>
                    <a onClick={ this.onClickChatIcon.bind(this) } className="chat-button-icon">
                        <span>
                            <svg style={{width: 'inherit'}} viewBox="0 0 38 35">
                                <path fill="#FFF" fillRule="evenodd" d="M36.9 10.05c-1-4.27-4.45-7.6-8.8-8.4-2.95-.5-6-.78-9.1-.78-3.1 0-6.15.27-9.1.8-4.35.8-7.8 4.1-8.8 8.38-.4 1.5-.6 3.07-.6 4.7 0 1.62.2 3.2.6 4.7 1 4.26 4.45 7.58 8.8 8.37 2.95.53 6 .45 9.1.45v5.2c0 .77.62 1.4 1.4 1.4.3 0 .6-.12.82-.3l11.06-8.46c2.3-1.53 3.97-3.9 4.62-6.66.4-1.5.6-3.07.6-4.7 0-1.62-.2-3.2-.6-4.7zm-14.2 9.1H10.68c-.77 0-1.4-.63-1.4-1.4 0-.77.63-1.4 1.4-1.4H22.7c.76 0 1.4.63 1.4 1.4 0 .77-.63 1.4-1.4 1.4zm4.62-6.03H10.68c-.77 0-1.4-.62-1.4-1.38 0-.77.63-1.4 1.4-1.4h16.64c.77 0 1.4.63 1.4 1.4 0 .76-.63 1.38-1.4 1.38z"></path>
                            </svg>
                        </span>
                    </a>
                </div>
                <Provider store={ this.store }>
                    <div
                        className={ `wc-chatview-panel ${state.windowState.visible ? 'open-chat' : 'close-chat'}` }
                        onKeyDownCapture={ this._handleKeyDownCapture }
                        ref={ this._saveChatviewPanelRef }
                    >
                        {
                            !!state.format.chatTitle &&
                                <div className="wc-header">
                                    {headerBotIcon}
                                    <span>{ typeof state.format.chatTitle === 'string' ? state.format.chatTitle : state.format.strings.title }</span>
                                    {headerCloseButton}
                                </div>
                        }
                        <MessagePane disabled={ this.props.disabled }>
                            <History
                                disabled={ this.props.disabled }
                                onCardAction={ this._handleCardAction }
                                ref={ this._saveHistoryRef }
                                showBrandMessage={ state.format.showBrandMessage }
                            />
                        </MessagePane>
                        {
                            !this.props.disabled && <Shell
                                                        ref={ this._saveShellRef }
                                                        showBrandMessage={ state.format.showBrandMessage }
                                                    />
                        }
                        {
                            this.props.resize === 'detect' &&
                                <ResizeDetector onresize={ this.resizeListener } />
                        }
                        {
                            state.format.showBrandMessage && <div className="wc-brandmessage">{state.format.brandMessage}</div>
                        }
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
            if (botConnection.getSessionId)  {
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

export const renderIfNonempty = (value: any, renderer: (value: any) => JSX.Element ) => {
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
        ref={ frame => {
            if (frame) {
                frame.contentWindow.onresize = props.onresize;
            }
        } }
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
