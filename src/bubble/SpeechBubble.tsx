import './SpeechBubble.css';

interface SpeechBubbleProps {
  text: string;
}

export default function SpeechBubble({ text }: SpeechBubbleProps) {
  return (
    <div className="speech-bubble">
      <p className="speech-bubble__text">{text}</p>
    </div>
  );
}
