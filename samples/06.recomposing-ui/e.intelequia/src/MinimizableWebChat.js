import classNames from 'classnames';
import React, { useCallback, useMemo, useState } from 'react';
import { createStore, createCognitiveServicesSpeechServicesPonyfillFactory } from 'botframework-webchat';
import WebChat from './WebChat';
import Header from './Header';
import MaximizeButton from './MaximizeButton';
import './fabric-icons-inline.css';
import './MinimizableWebChat.css';
import { setCookie, getCookie, checkCookie } from './CookiesUtils';
import ReactMarkdown from 'react-markdown';

//create your forceUpdate hook
function useForceUpdate() {
  const [value, setValue] = useState(0); // integer state
  return () => setValue(value => ++value); // update the state to force render
}
let interval;
let inTimeout;

const MinimizableWebChat = parameters => {
  const options = parameters.parameters.parameters;
  if (options.reactivateChat && options.proactiveTimeOut == undefined) {
    options.proactiveTimeOut = 50000;
  }

  const store = useMemo(
    () =>
      createStore({}, ({ dispatch }) => next => action => {
        if (action.type === 'DIRECT_LINE/CONNECT_FULFILLED') {
          inTimeout = false;

          dispatch({
            type: 'WEB_CHAT/SEND_EVENT',
            payload: {
              name: 'StartConversation',
              value: {
                locale: options.language
              }
            }
          });
        } else if (action.type === 'DIRECT_LINE/INCOMING_ACTIVITY') {
          if (action.payload.activity.from.role === 'bot') {
            setNewMessage(true);
            if (options.reactivateChat) {
              if (inTimeout == false) {
                clearInterval(interval);

                interval = setTimeout(() => {
                  dispatch({
                    type: 'WEB_CHAT/SEND_EVENT',
                    payload: {
                      name: 'inactive'
                    }
                  });
                }, options.proactiveTimeOut);
                inTimeout = true;
              }
            }
          }

          if (action.payload.activity.type === 'event') {
            clearInterval(interval);
            switch (action.payload.activity.name) {
              case 'Minimize':
                setMinimized(true);
                setNewMessage(false);
              case 'ChangeLanguage':
                setLanguage(action.payload.activity.value);
              case 'Geolocation':
                if (navigator.geolocation) {
                  function success(pos) {
                    const crd = pos.coords;

                    let gps = {
                      latitude: crd.latitude,
                      longitude: crd.longitude
                    };
                    dispatch({
                      type: 'WEB_CHAT/SEND_EVENT',
                      payload: {
                        name: 'GeolocationEvent',
                        value: gps
                      }
                    });
                  }
                  navigator.geolocation.getCurrentPosition(success);
                }
              case 'ToogleStreaming':
                setStreaming(action.payload.activity.value);
              case 'StreamingInfo':
                console.log(options);
                console.log(action.payload.activity.value);
                setStreamingText(action.payload.activity.value);
            }
          }
        } else if (action.type === 'WEB_CHAT/SEND_MESSAGE') {
          //Message from user
          inTimeout = false;
          clearTimeout(interval);
          switch (action.payload.method) {
            case 'keyboard':
              if (options.onUserMessage) {
                options.onUserMessage(action.payload.text, options.language);
              }
              break;
            case 'imBack':
            case 'postBack':
              if (options.onActionClick) {
                options.onActionClick(action.payload.text, options.language);
              }
              break;
          }
        }

        return next(action);
      }),
    []
  );

  var styleSet = {
    fontSizeSmall: '80%',
    primaryFont: "'Segoe UI', sans-serif",

    //Bot Nub
    showNub: true,
    bubbleNubOffset: -8,
    bubbleNubSize: 10,
    bubbleBorderRadius: 10,
    avatarSize: 32,

    //User Nub
    bubbleFromUserNubOffset: -8,
    bubbleFromUserNubSize: 10,
    bubbleFromUserBorderRadius: 10,

    // //buttons
    suggestedActionBorderRadius: 5,

    //SendBox
    hideUploadButton: true,
    sendBoxBackground: '#F1F1F4',
    sendBoxButtonColor: undefined, // defaults to subtle
    sendBoxButtonColorOnDisabled: '#CCC',
    sendBoxButtonColorOnFocus: '#333',
    sendBoxButtonColorOnHover: '#333',
    sendBoxDisabledTextColor: undefined, // defaults to subtle
    sendBoxHeight: 50,
    sendBoxMaxHeight: 200,
    sendBoxTextColor: 'Black',
    sendBoxBorderBottom: 'solid 10px white',
    sendBoxBorderTop: 'solid 10px white',
    sendBoxBorderLeft: 'solid 10px white',
    sendBoxBorderRight: 'solid 10px white',
    sendBoxPlaceholderColor: undefined, // defaults to subtle
    sendBoxTextWrap: false,

    transcriptOverlayButtonBackground: '#d2dde5',
    transcriptOverlayButtonBackgroundOnHover: '#ef501f',
    transcriptOverlayButtonColor: '#ed823c',
    transcriptOverlayButtonColorOnHover: 'White' //parameter
  };
  styleSet = { ...styleSet, ...options.style };

  const [loaded, setLoaded] = useState(false);
  const [minimized, setMinimized] = useState(true);
  const [newMessage, setNewMessage] = useState(false);
  const [side, setSide] = useState('right');
  const [token, setToken] = useState();
  const [conversationId, setConversationId] = useState();
  const firstTimeVisit = checkCookie('firstTimeVisit', true, { path: '/', maxAge: 2592000 });
  const [credentials, setCredentials] = useState();
  const [language, setLanguage] = useState();

  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState();

  // To learn about reconnecting to a conversation, see the following documentation:
  // https://docs.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-direct-line-3-0-reconnect-to-conversation?view=azure-bot-service-4.0

  // call your hook here
  const forceUpdate = useForceUpdate();

  const handleFetchToken = useCallback(async () => {
    if (!token) {
      let localStorageConversationId = getCookie('bci');
      setConversationId(localStorageConversationId);

      let url = '';
      if (localStorageConversationId) {
        url = options.directlineReconnectTokenUrl + localStorageConversationId;
      } else {
        url = options.directlineTokenUrl;
      }
      const res = await fetch(url, {
        method: 'GET'
      });
      const kk = await res.json();
      setLanguage(options.language);
      setToken(kk.token);
    }
  }, [setToken, token, setConversationId, setLanguage]);

  const setFirstTimeCookie = () => {
    var cookie = getCookie('firstTimeVisit');
    if (cookie != false) setCookie('firstTimeVisit', false, { path: '/', maxAge: 2592000 });
    forceUpdate();
  };

  const handleMaximizeButtonClick = useCallback(async () => {
    setLoaded(true);
    setMinimized(false);
    setNewMessage(false);
    setFirstTimeCookie();
    if (options.onMaximizeMinimize) {
      options.onMaximizeMinimize(false, options.language);
    }
  }, [setMinimized, setNewMessage]);

  const handleMinimizeButtonClick = useCallback(() => {
    setMinimized(true);
    setNewMessage(false);
    if (options.onMaximizeMinimize) {
      options.onMaximizeMinimize(true, options.language);
    }
  }, [setMinimized, setNewMessage]);

  const handleSwitchButtonClick = useCallback(() => {
    setSide(side === 'left' ? 'right' : 'left');
  }, [setSide, side]);

  // TODO: [P2] Currently, we cannot unmount Web Chat from DOM when it is minimized.
  //       Today, if we unmount it, Web Chat will call disconnect on DirectLineJS object.
  //       When minimized, we still want to maintain that connection while the UI is gone.
  //       This is related to https://github.com/microsoft/BotFramework-WebChat/issues/2750.

  const handleMessageClick = useCallback(async () => {
    setFirstTimeCookie();
    setSide(side);
  }, [setSide, side]);

  function handleRequestSpeechToken() {
    let expireAfter = 0;
    let lastPromise;

    return () => {
      const now = Date.now();

      if (now > expireAfter) {
        expireAfter = now + 300000;
        lastPromise = fetch(options.speechTokenUrl, {
          method: 'POST'
        }).then(
          res => res.json(),
          err => {
            expireAfter = 0;

            return Promise.reject(err);
          }
        );
      }
      return lastPromise;
    };
  }

  const fetchSpeechServicesCredentials = handleRequestSpeechToken();

  const webSpeechPonyfillFactory = useMemo(() => {
    if (typeof options.speechTokenUrl != 'undefined' && options.speechTokenUrl != '')
      return createCognitiveServicesSpeechServicesPonyfillFactory({
        credentials: fetchSpeechServicesCredentials
      });
    else return null;
  }, []);

  const handleTest = useCallback(() => {
    if (streaming == true) {
      setStreaming(false);
    } else {
      setStreaming(true);
    }
  }, [streaming]);

  return (
    <div className="minimizable-web-chat">
      {getCookie('firstTimeVisit') == 'true' &&
        (options.chatIconMessage !== undefined || options.chatIconMessage !== '') && (
          <div className="chat-button-message close-button-no-animate">
            <div className="chat-button-message-arrow"></div>
            <a className="chat-button-message-close" onClick={handleMessageClick}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="-38000 0 42000 2048">
                <path d="M1115 1024 L1658 1567 Q1677 1586 1677 1612.5 Q1677 1639 1658 1658 Q1639 1676 1612 1676 Q1587 1676 1567 1658 L1024 1115 L481 1658 Q462 1676 436 1676 Q410 1676 390 1658 Q371 1639 371 1612.5 Q371 1586 390 1567 L934 1024 L390 481 Q371 462 371 435.5 Q371 409 390 390 Q410 372 436 372 Q462 372 481 390 L1024 934 L1567 390 Q1587 372 1612 372 Q1639 372 1658 390 Q1677 409 1677 435.5 Q1677 462 1658 481 L1115 1024 Z "></path>
              </svg>
            </a>
            <a onClick={handleMaximizeButtonClick}>
              <span>{options.chatIconMessage}</span>
            </a>
          </div>
        )}

      <MaximizeButton
        maximizeOptions={options.maximize}
        handleMaximizeButtonClick={handleMaximizeButtonClick}
        newMessage={newMessage}
        minimized={minimized}
      />

      {loaded && (
        <div
          className={classNames(
            side === 'left' ? 'chat-box left' : 'chat-box right',
            minimized ? 'hide open-chat-no-animate' : 'open-chat-animate'
          )}
        >
          <Header
            handleMinimizeButtonClick={handleMinimizeButtonClick}
            handleSwitchButtonClick={handleSwitchButtonClick}
            headerOptions={options.header}
          />

          <button text="BUTTON" onClick={handleTest} />
          <div hidden={!streaming} className="markdown webchat--css-vhrtn-1idpc0m">
            <ReactMarkdown>{streamingText}</ReactMarkdown>
            <ReactMarkdown>
              Como asistente virtual, puedo proporcionarte información sobre una variedad de temas relacionados con el
              turismo en Tenerife, incluyendo: 1. **Alojamiento**: Puedo proporcionarte información sobre hoteles,
              apartamentos, casas rurales y otros tipos de alojamiento disponibles en Tenerife. 2. **Actividades**:
              Puedo informarte sobre las diversas actividades que puedes realizar en Tenerife, como senderismo,
              ciclismo, buceo, surf, golf, etc. 3. **Atracciones turísticas**: Puedo proporcionarte detalles sobre las
              diversas atracciones turísticas de Tenerife, como el Parque Nacional del Teide, la ciudad de Santa Cruz de
              Tenerife, la playa de Las Teresitas, etc. 4. **Gastronomía**: Puedo informarte sobre la deliciosa
              gastronomía de Tenerife, incluyendo los platos típicos que debes probar y los mejores lugares para comer.
              5. **Eventos**: Puedo mantenerte al día con los próximos eventos en Tenerife, como festivales, conciertos,
              exposiciones, etc. 6. **Transporte**: Puedo proporcionarte información sobre cómo moverte por Tenerife,
              incluyendo detalles sobre el servicio de autobuses, taxis, alquiler de coches, etc. 7. **Información
              práctica**: Puedo proporcionarte información práctica para tu viaje a Tenerife, como el clima, la moneda,
              los servicios de emergencia, etc. Por favor, ten en cuenta que toda la información que proporciono está
              basada en los datos disponibles en la página web www.webtenerife.com.
            </ReactMarkdown>
            ;
          </div>
          {
            <WebChat
              className="react-web-chat"
              onFetchToken={handleFetchToken}
              store={store}
              styleOptions={styleSet}
              token={token}
              webSpeechPonyfillFactory={webSpeechPonyfillFactory}
              language={language}
              selectVoice={options.selectVoice}
            />
          }

          {options.brandMessage != undefined && options.brandMessage != '' && (
            <div className="brandmessage">{options.brandMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default MinimizableWebChat;
