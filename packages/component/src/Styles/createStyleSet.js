import createActivitiesStyle from './StyleSet/Activities';
import createActivityStyle from './StyleSet/Activity';
import createAvatarStyle from './StyleSet/Avatar';
import createBubbleStyle from './StyleSet/Bubble';
import createCodeCardStyle from './StyleSet/CodeCard';
import createMicrophoneStyle from './StyleSet/Microphone';
import createMultipleCardActivityCardStyle from './StyleSet/MultipleCardActivityCard';
import createSendBoxStyle from './StyleSet/SendBox';
import createSingleCardActivityStyle from './StyleSet/SingleCardActivity';
import createTextCardStyle from './StyleSet/TextCard';
import createTimestampStyle from './StyleSet/Timestamp';
import createUploadButtonStyle from './StyleSet/UploadButton';

const DEFAULT_OPTIONS = {
  accent: '#6CF',

  bubbleBackground: 'White',
  bubbleImageHeight: 240,
  bubbleMaxWidth: 480, // screen width = 600px
  bubbleMinWidth: 250, // min screen width = 300px, Edge requires 372px (https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/13621468/)

  timestampColor: 'rgba(0, 0, 0, .2)'
};

export default function createStyleSet(options = DEFAULT_OPTIONS) {
  return {
    activity: createActivityStyle(options),
    activities: createActivitiesStyle(options),
    avatar: createAvatarStyle(options),
    bubble: createBubbleStyle(options),
    codeCard: createCodeCardStyle(options),
    microphone: createMicrophoneStyle(options),
    multipleCardActivityCard: createMultipleCardActivityCardStyle(options),
    options,
    sendBox: createSendBoxStyle(options),
    singleCardActivity: createSingleCardActivityStyle(options),
    textCard: createTextCardStyle(options),
    timestamp: createTimestampStyle(options),
    uploadButton: createUploadButtonStyle(options)
  };
}
