import * as React from 'react';
import { Provider } from 'react-redux';

import { Chat, ChatProps } from './Chat';
import * as konsole from './Konsole';
import { ChatActions, createStore, sendMessage, WindowState } from './Store';

export class ChatIcon extends React.Component<ChatProps, {}> {
    private store = createStore();

    constructor(props: ChatProps) {
        super(props);
        konsole.log('BotChat.ChatIcon props', props);

        if (typeof props.chatIconColor !== 'undefined') {
            this.store.dispatch<ChatActions>({ type: 'Set_ChatIcon_Color', chatIconColor: props.chatIconColor });
        }
    }

    onClickChatIcon() {
        this.store.dispatch<ChatActions>({
            type: 'Set_Status',
            visible: true
        });
        this.forceUpdate();     // I had to do this; I don't know why this dispatch doesn't force a re-render
    }

    onCloseWindow() {
        this.store.dispatch<ChatActions>({
            type: 'Set_Status',
            visible: false
        });
        this.forceUpdate();     // I had to do this; I don't know why this dispatch doesn't force a re-render
    }

    render() {
        const state = this.store.getState();
        konsole.log('BotChat.Chat state', state);

        if (state.windowState.visible) {
            return (
                <Provider store={ this.store }>
                    <Chat
                        { ...this.props }
                        onCloseWindow={this.onCloseWindow.bind(this)}
                    />
                </Provider>
            );
        } else {
            return (
                <Provider store={ this.store }>
                    <div className="chat-button" style={{backgroundColor: `${state.format.chatIconColor}`}}>
                        <a onClick={ this.onClickChatIcon.bind(this) } className="chat-button-icon">
                            <span>
                                <svg style={{width: 'inherit'}} viewBox="0 0 38 35">
                                    <path fill="#FFF" fillRule="evenodd" d="M36.9 10.05c-1-4.27-4.45-7.6-8.8-8.4-2.95-.5-6-.78-9.1-.78-3.1 0-6.15.27-9.1.8-4.35.8-7.8 4.1-8.8 8.38-.4 1.5-.6 3.07-.6 4.7 0 1.62.2 3.2.6 4.7 1 4.26 4.45 7.58 8.8 8.37 2.95.53 6 .45 9.1.45v5.2c0 .77.62 1.4 1.4 1.4.3 0 .6-.12.82-.3l11.06-8.46c2.3-1.53 3.97-3.9 4.62-6.66.4-1.5.6-3.07.6-4.7 0-1.62-.2-3.2-.6-4.7zm-14.2 9.1H10.68c-.77 0-1.4-.63-1.4-1.4 0-.77.63-1.4 1.4-1.4H22.7c.76 0 1.4.63 1.4 1.4 0 .77-.63 1.4-1.4 1.4zm4.62-6.03H10.68c-.77 0-1.4-.62-1.4-1.38 0-.77.63-1.4 1.4-1.4h16.64c.77 0 1.4.63 1.4 1.4 0 .76-.63 1.38-1.4 1.38z"></path>
                                </svg>
                            </span>
                        </a>
                    </div>
                </Provider>
            );
        }
    }
}
