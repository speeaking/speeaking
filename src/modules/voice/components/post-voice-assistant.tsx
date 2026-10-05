"use client";

import {
  AudioLines,
  Check,
  Loader2,
  Mic,
  MicOff,
  Search,
  Send,
  Square,
  Volume2,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { UserAvatar } from "@/components/brand/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPostTextAction } from "@/modules/social/post-text-actions";
import {
  confirmVoiceShareAction,
  findVoiceFriendsAction,
  interpretVoiceAction,
  prepareVoiceShareAction,
} from "../actions";
import { recognitionConstructor, recognitionError, type VoiceRecognition } from "../browser";
import {
  DEFAULT_SHARE_NOTE,
  isSendConfirmation,
  localVoiceCommand,
  MAX_SHARE_NOTE,
  MAX_VOICE_COMMAND,
  normalizeVoice,
  speechChunks,
  withoutWakeName,
  type VoiceCommand,
  type VoiceFriend,
} from "../commands";

type Phase = "idle" | "listening" | "working" | "reading";
type Draft = { friend: VoiceFriend; url: string; note: string; requestId: string };
const HELP =
  "Puedes decir: léeme esta publicación, envíasela a un amigo por su nombre, detener lectura o cancelar. El envío necesita una confirmación aparte.";

/** Cada botón selecciona su publicación: nunca adivina cuál está viendo la persona. */
export function PostVoiceAssistant({
  postId,
  authorName,
  isSignedIn,
  className,
  labelClassName,
}: {
  postId: string;
  authorName: string;
  isSignedIn: boolean;
  className?: string;
  labelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("Elige leer o toca el micrófono para dar una orden.");
  const [error, setError] = useState("");
  const [command, setCommand] = useState("");
  const [heard, setHeard] = useState("");
  const [canListen, setCanListen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [friends, setFriends] = useState<VoiceFriend[]>([]);
  const [note, setNote] = useState(DEFAULT_SHARE_NOTE);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sentThread, setSentThread] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const opened = useRef(false);
  const operation = useRef(0);
  const working = useRef(false);
  const recognition = useRef<VoiceRecognition | null>(null);
  const micTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechSequence = useRef(0);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  const stopAudio = useCallback(() => {
    if (micTimer.current) clearTimeout(micTimer.current);
    micTimer.current = null;
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onresult = null;
      current.onend = null;
      current.onerror = null;
      try {
        current.abort();
      } catch {
        /* Ya terminado. */
      }
    }
    speechSequence.current++;
    if (utterance.current && "speechSynthesis" in window) window.speechSynthesis.cancel();
    utterance.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    const hide = () => {
      if (document.visibilityState !== "hidden" || !opened.current) return;
      operation.current++;
      working.current = false;
      stopAudio();
      setPhase("idle");
      setStatus("Spyke se detuvo al salir de la app. Toca un botón para continuar.");
    };
    const leave = () => {
      operation.current++;
      opened.current = false;
      stopAudio();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [open, stopAudio]);

  function changeOpen(value: boolean) {
    opened.current = value;
    operation.current++;
    working.current = false;
    stopAudio();
    setPhase("idle");
    setError("");
    setOpen(value);
    if (value) {
      setCanListen(Boolean(recognitionConstructor()));
      setCanSpeak("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
      setStatus("Elige leer o toca el micrófono para dar una orden.");
      setHeard("");
      setCommand("");
      setDraft(null);
      setSentThread(null);
      setSearchingFriends(false);
      setFriends([]);
      setFriendQuery("");
      setNote(DEFAULT_SHARE_NOTE);
    }
  }

  function speak(text: string, finalStatus: string) {
    stopAudio();
    if (!canSpeak) {
      setPhase("idle");
      setStatus(finalStatus);
      return;
    }
    const sequence = speechSequence.current;
    const chunks = speechChunks(text);
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => /^es[-_]MX$/iu.test(v.lang) && v.localService) ??
      voices.find((v) => /^es/iu.test(v.lang) && v.localService) ??
      voices.find((v) => /^es/iu.test(v.lang));
    let index = 0;
    function next() {
      if (!opened.current || sequence !== speechSequence.current) return;
      const chunk = chunks[index++];
      if (!chunk) {
        utterance.current = null;
        setPhase("idle");
        setStatus(finalStatus);
        return;
      }
      const speech = new SpeechSynthesisUtterance(chunk);
      utterance.current = speech;
      speech.lang = "es-MX";
      if (voice) speech.voice = voice;
      speech.rate = 1;
      speech.onend = next;
      speech.onerror = () => {
        if (!opened.current || sequence !== speechSequence.current) return;
        utterance.current = null;
        setPhase("idle");
        setError("La lectura se interrumpió. Puedes volver a iniciarla.");
      };
      window.speechSynthesis.speak(speech);
    }
    setPhase("reading");
    next();
  }

  function run(work: (id: number) => Promise<void>) {
    if (working.current) return;
    stopAudio();
    const id = ++operation.current;
    working.current = true;
    setPhase("working");
    setError("");
    startTransition(async () => {
      try {
        await work(id);
      } catch {
        if (active(id)) {
          setError("No pudimos completar la petición. Intenta de nuevo.");
          setPhase("idle");
        }
      } finally {
        if (operation.current === id) working.current = false;
      }
    });
  }
  function active(id: number) {
    return opened.current && operation.current === id;
  }
  function fail(message: string) {
    setError(message);
    setPhase("idle");
  }

  async function read(id: number) {
    if (!canSpeak) {
      fail("Este navegador no permite la lectura en voz alta.");
      return;
    }
    setStatus("Preparando la lectura…");
    const result = await getPostTextAction(postId);
    if (!active(id)) return;
    if (!result.ok) {
      fail(result.error);
      return;
    }
    if (!result.body.trim()) {
      speak(
        "Esta publicación no tiene texto para leer. No puedo describir el contenido de su foto o video.",
        "Publicación sin texto.",
      );
      return;
    }
    setStatus("Leyendo la publicación. Puedes detenerla en cualquier momento.");
    speak(
      `Publicación de ${authorName}. ${result.body}`,
      "Lectura terminada. Puedes compartirla con un amigo.",
    );
  }

  async function prepare(friend: VoiceFriend, shareNote: string, id: number) {
    const result = await prepareVoiceShareAction(postId, friend.userId);
    if (!active(id)) return;
    if (!result.ok) {
      fail(result.error);
      return;
    }
    const prepared = {
      friend: result.friend,
      url: result.url,
      note: shareNote,
      requestId: crypto.randomUUID(),
    };
    setDraft(prepared);
    setSearchingFriends(false);
    setSentThread(null);
    setStatus(`Envío preparado para ${friend.displayName}. Revisa el mensaje y confirma.`);
    speak(
      `Preparé el envío a ${friend.displayName}, usuario ${friend.username}. Mensaje: ${shareNote || DEFAULT_SHARE_NOTE}. Para enviarlo toca confirmar envío o vuelve a tocar el micrófono y di confirmar envío.`,
      "Revisa el destinatario y el mensaje antes de confirmar.",
    );
  }

  async function search(query: string, shareNote: string, autoPrepare: boolean, id: number) {
    if (!isSignedIn) {
      fail("Entra a tu cuenta para compartir con tus amigos.");
      return;
    }
    setDraft(null);
    setSentThread(null);
    setSearchingFriends(true);
    setFriendQuery(query);
    setNote(shareNote);
    const result = await findVoiceFriendsAction(query);
    if (!active(id)) return;
    if (!result.ok) {
      fail(result.error);
      return;
    }
    setFriends(result.friends);
    if (autoPrepare && result.friends.length === 1) {
      await prepare(result.friends[0]!, shareNote, id);
      return;
    }
    const message = result.friends.length
      ? "Elige un amigo por su @usuario. Puedes decir: elige a, seguido de su usuario."
      : "No encontré amigos aceptados con ese nombre. Busca por su nombre o usuario.";
    setPhase("idle");
    setStatus(message);
    speak(
      result.friends.length
        ? `${message} ${result.friends.map((f) => `${f.displayName}, usuario ${f.username}`).join(". ")}`
        : message,
      message,
    );
  }

  async function send(prepared: Draft, id: number) {
    setStatus(`Confirmando el envío a ${prepared.friend.displayName}…`);
    const result = await confirmVoiceShareAction({
      postId,
      recipientId: prepared.friend.userId,
      note: prepared.note,
      requestId: prepared.requestId,
    });
    if (!active(id)) return;
    if (!result.ok) {
      fail(result.error);
      return;
    }
    setSentThread(result.conversationId);
    setDraft(null);
    setSearchingFriends(false);
    speak(
      `Publicación enviada a ${prepared.friend.displayName}.`,
      "Publicación enviada. La encuentras en su conversación.",
    );
  }

  async function execute(parsed: VoiceCommand, id: number) {
    if (parsed.action === "read") return read(id);
    if (parsed.action === "share")
      return search(
        parsed.recipient ?? "",
        parsed.note ?? DEFAULT_SHARE_NOTE,
        Boolean(parsed.recipient),
        id,
      );
    if (parsed.action === "cancel") {
      setDraft(null);
      setSearchingFriends(false);
      setFriends([]);
      setPhase("idle");
      setStatus("Envío cancelado.");
      return;
    }
    if (parsed.action === "stop") {
      setPhase("idle");
      setStatus("Lectura detenida.");
      return;
    }
    speak(HELP, HELP);
  }

  function handleCommand(raw: string) {
    const text = raw.trim();
    if (!text || text.length > MAX_VOICE_COMMAND) {
      fail("Di o escribe una orden corta.");
      return;
    }
    setHeard(text);
    run(async (id) => {
      // Solo una frase explícita posterior puede confirmar; la salida del modelo no puede hacerlo.
      if (isSendConfirmation(text)) {
        if (draft) await send(draft, id);
        else {
          setPhase("idle");
          setStatus("Primero elige un amigo y prepara el envío.");
        }
        return;
      }
      if (searchingFriends) {
        const wanted = normalizeVoice(
          withoutWakeName(text).replace(/^(?:elige|selecciona)(?:\s+a)?\s+/iu, ""),
        );
        const matches = friends.filter(
          (f) => normalizeVoice(f.username) === wanted || normalizeVoice(f.displayName) === wanted,
        );
        if (matches.length === 1) {
          await prepare(matches[0]!, note, id);
          return;
        }
      }
      const local = localVoiceCommand(text);
      if (local) {
        await execute(local, id);
        return;
      }
      setStatus("Spyke está interpretando tu orden…");
      const result = await interpretVoiceAction(text);
      if (!active(id)) return;
      if (!result.ok) {
        fail(result.error);
        return;
      }
      await execute(result.command, id);
    });
  }

  function listen() {
    if (working.current) return;
    if (phase === "listening") {
      stopAudio();
      setPhase("idle");
      setStatus("Micrófono apagado.");
      return;
    }
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      fail("Este navegador no reconoce voz. Puedes escribir la orden o usar los botones.");
      return;
    }
    stopAudio();
    setError("");
    setPhase("listening");
    setStatus("Te escucho. Di una orden corta.");
    const current = new Constructor();
    recognition.current = current;
    current.lang = "es-MX";
    current.continuous = false;
    current.interimResults = false;
    current.maxAlternatives = 1;
    current.onresult = (event) => {
      const words: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++)
        if (event.results[i]?.isFinal) words.push(event.results[i]![0]!.transcript);
      if (!words.length) return;
      stopAudio();
      handleCommand(words.join(" "));
    };
    current.onerror = (event) => {
      stopAudio();
      fail(recognitionError(event.error));
    };
    current.onend = () => {
      stopAudio();
      setPhase("idle");
      setStatus("No escuché una orden. Toca el micrófono para intentar otra vez.");
    };
    try {
      current.start();
      micTimer.current = setTimeout(() => {
        stopAudio();
        setPhase("idle");
        setStatus("Micrófono apagado. Toca para volver a hablar.");
      }, 20_000);
    } catch {
      stopAudio();
      fail("No pudimos iniciar el micrófono. Revisa el permiso del navegador.");
    }
  }

  const busy = pending || phase === "working";
  return (
    <>
      <button
        type="button"
        onClick={() => changeOpen(true)}
        aria-label="Abrir Spyke para leer o compartir esta publicación"
        className={className}
      >
        <AudioLines aria-hidden="true" className="size-5" />
        <span className={labelClassName}>Spyke</span>
      </button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="pr-6">
            <DialogTitle className="flex items-center gap-2">
              <AudioLines className="size-5 text-primary" aria-hidden="true" />
              Spyke
            </DialogTitle>
            <DialogDescription>Lee o comparte la publicación de {authorName}.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || !canSpeak}
              onClick={() => run(read)}
              className="flex-1"
            >
              <Volume2 aria-hidden="true" />
              Leer publicación
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => run((id) => search("", DEFAULT_SHARE_NOTE, false, id))}
              className="flex-1"
            >
              <Send aria-hidden="true" />
              Compartir
            </Button>
          </div>
          <div className="rounded-2xl bg-secondary p-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                variant={phase === "listening" ? "destructive" : "default"}
                disabled={busy || !canListen}
                onClick={listen}
                aria-label={phase === "listening" ? "Apagar micrófono" : "Hablar con Spyke"}
                aria-pressed={phase === "listening"}
                className="size-12 shrink-0 rounded-full"
              >
                {phase === "listening" ? (
                  <MicOff aria-hidden="true" />
                ) : busy ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Mic aria-hidden="true" />
                )}
              </Button>
              <p role="status" className="text-sm leading-relaxed">
                {status}
              </p>
              {phase === "reading" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    stopAudio();
                    setPhase("idle");
                    setStatus("Lectura detenida.");
                  }}
                  aria-label="Detener lectura"
                >
                  <Square aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            {heard ? (
              <p className="mt-3 text-xs text-muted-foreground">Escuché: «{heard}»</p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              {canListen
                ? "Toca el micrófono y di: «Hey Spyke, léeme esta publicación» o «envíasela a Ana»."
                : "Tu navegador no reconoce voz. Puedes leer con el botón o escribir la orden."}
            </p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleCommand(command);
            }}
          >
            <label className="sr-only" htmlFor={`voice-command-${postId}`}>
              Orden para Spyke
            </label>
            <Input
              id={`voice-command-${postId}`}
              value={command}
              maxLength={MAX_VOICE_COMMAND}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="También puedes escribir una orden…"
              disabled={busy || phase === "listening"}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={busy || phase === "listening" || !command.trim()}
              aria-label="Ejecutar orden"
            >
              <Send aria-hidden="true" />
            </Button>
          </form>
          {searchingFriends ? (
            <section className="flex flex-col gap-3 border-t pt-4">
              <h3 className="font-semibold">Compartir con un amigo</h3>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  run((id) => search(friendQuery, note, false, id));
                }}
              >
                <label htmlFor={`voice-friend-${postId}`} className="sr-only">
                  Buscar entre mis amigos
                </label>
                <Input
                  id={`voice-friend-${postId}`}
                  maxLength={80}
                  value={friendQuery}
                  placeholder="Nombre o @usuario"
                  onChange={(event) => setFriendQuery(event.target.value)}
                  disabled={busy || phase === "listening"}
                />
                <Button
                  type="submit"
                  variant="outline"
                  aria-label="Buscar amigo"
                  disabled={busy || phase === "listening"}
                >
                  <Search aria-hidden="true" />
                </Button>
              </form>
              <div className="flex flex-col gap-1">
                {friends.map((friend) => (
                  <button
                    key={friend.userId}
                    type="button"
                    className="flex min-h-14 items-center gap-3 rounded-xl p-2 text-left hover:bg-accent disabled:opacity-50"
                    disabled={busy || phase === "listening"}
                    onClick={() => run((id) => prepare(friend, note, id))}
                  >
                    <UserAvatar
                      src={friend.avatarUrl}
                      name={friend.displayName}
                      seed={friend.username}
                      className="size-9 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{friend.displayName}</span>
                      <span className="text-xs text-muted-foreground">@{friend.username}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Solo aparecen amigos aceptados. Busca por su usuario si hay varios con el mismo
                nombre.
              </p>
            </section>
          ) : null}
          {draft ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <h3 className="font-semibold">
                Para {draft.friend.displayName}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  @{draft.friend.username}
                </span>
              </h3>
              <label htmlFor={`voice-note-${postId}`} className="text-xs font-medium">
                Mensaje corto
              </label>
              <Textarea
                id={`voice-note-${postId}`}
                maxLength={MAX_SHARE_NOTE}
                value={draft.note}
                disabled={busy || phase === "listening"}
                onChange={(event) => {
                  setDraft({ ...draft, note: event.target.value, requestId: crypto.randomUUID() });
                  stopAudio();
                  setPhase("idle");
                }}
                rows={3}
              />
              <p className="text-xs break-all text-muted-foreground">{draft.url}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || phase === "listening"}
                  onClick={() => {
                    stopAudio();
                    setDraft(null);
                    setPhase("idle");
                    setStatus("Envío cancelado.");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={busy || phase === "listening"}
                  onClick={() => run((id) => send(draft, id))}
                >
                  <Check aria-hidden="true" />
                  Confirmar envío
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Por voz: toca el micrófono y di «confirmar envío». Compartir no cambia la audiencia.
              </p>
            </section>
          ) : null}
          {sentThread ? (
            <Link
              href={`/mensajes/${sentThread}` as Route}
              className="text-center font-medium text-primary underline underline-offset-4"
            >
              Ver conversación
            </Link>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!isSignedIn ? (
            <Link
              href={`/entrar?next=${encodeURIComponent(`/p/${postId}`)}` as Route}
              className="text-primary underline"
            >
              Entrar para compartir con amigos
            </Link>
          ) : null}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            El navegador puede procesar voz y lectura con sus proveedores. speeaking no guarda el
            audio. Solo escuchamos después de que tocas el micrófono, con la app abierta.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
