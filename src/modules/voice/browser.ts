/** Tipos mínimos de la API, todavía prefijada en algunos navegadores. */
export type RecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; [index: number]: { transcript: string } };
  };
};
export type VoiceRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};
type RecognitionConstructor = new () => VoiceRecognition;

export function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const browser = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition ?? null;
}

export function recognitionError(code: string) {
  if (code === "not-allowed" || code === "service-not-allowed")
    return "Permite el micrófono en el navegador para hablar con Spyke. También puedes escribir la orden.";
  if (code === "audio-capture") return "No encontramos un micrófono disponible.";
  if (code === "network")
    return "No pudimos reconocer la voz. Revisa tu conexión o escribe la orden.";
  if (code === "no-speech") return "No escuché una orden. Toca el micrófono e intenta otra vez.";
  return "No pudimos reconocer la voz. Puedes escribir la orden.";
}
