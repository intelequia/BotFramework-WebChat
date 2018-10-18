import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ChatProps } from './Chat';
import { ChatIcon } from './ChatIcon';
import * as konsole from './Konsole';

export type AppProps = ChatProps;

export const App = (props: AppProps, container: HTMLElement) => {
    konsole.log('BotChat.App props', props);
    ReactDOM.render(React.createElement(AppContainer, props), container);
};

const AppContainer = (props: AppProps) =>
    <div className="wc-app">
        <ChatIcon { ...props } />
    </div>;
