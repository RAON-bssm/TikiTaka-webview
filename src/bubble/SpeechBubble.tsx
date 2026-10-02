import type { Bubble } from './useBubbles';
import './SpeechBubble.css';

interface SpeechBubbleProps {
  bubble: Bubble;
}

export default function SpeechBubble({ bubble }: SpeechBubbleProps) {
  if (bubble.kind === 'typing') {
    return (
      <div className="speech-bubble" role="status" aria-label="답변을 기다리는 중">
        <span className="speech-bubble__typing" aria-hidden="true">
          <span className="speech-bubble__dot" />
          <span className="speech-bubble__dot" />
          <span className="speech-bubble__dot" />
        </span>
      </div>
    );
  }
  return (
    <div className="speech-bubble">
      <p className="speech-bubble__text">{bubble.text}</p>
    </div>
  );
}
