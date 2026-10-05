import "server-only";
import { AIError } from "@/modules/ai/errors";
import { isFeatureOn } from "@/modules/ai/features-store";
import { aiErrorMessage } from "@/modules/ai/messages";
import { recordedCost } from "@/modules/ai/cost";
import { redactPersonalData } from "@/modules/ai/personal-data";
import { reserveAiRequest } from "@/modules/ai/reservation";
import { providerFailure, SERVICE_TIMEOUT_MS, withTimeout } from "@/modules/ai/service";
import { getAIProvider } from "@/server/providers/ai";
import { db } from "@/server/db";
import { localVoiceCommand, voiceCommandSchema, type VoiceCommand } from "./commands";
import { voiceCommandTask } from "./task";

const UNAVAILABLE =
  "Por ahora usa los botones para leer o compartir. La interpretación con IA no está disponible.";
export type VoiceInterpretResult =
  { ok: true; command: VoiceCommand } | { ok: false; error: string };

export async function interpretVoice(
  userId: string,
  instruction: string,
): Promise<VoiceInterpretResult> {
  const local = localVoiceCommand(instruction);
  if (local) return { ok: true, command: local };
  if (!(await isFeatureOn("voiceAssistant"))) return { ok: false, error: UNAVAILABLE };
  let requestId: string | undefined;
  const started = Date.now();
  try {
    const provider = await getAIProvider("voice_command");
    // Ni el piloto ni el desarrollo hacen pasar plantillas por comprensión de IA.
    if (provider.id === "mock") return { ok: false, error: UNAVAILABLE };
    ({ requestId } = await reserveAiRequest({
      userId,
      feature: "VOICE_COMMAND",
      provider: {
        id: provider.id,
        model: provider.model,
        promptVersion: voiceCommandTask.promptVersion,
      },
      // No guardamos el dictado, contactos, publicación ni mensaje privado en el registro de IA.
      input: { characters: instruction.length },
      limits: { key: "voice", perHour: 60, perDay: 120 },
      featureDailyCapMicros: 500_000,
    }));
    const result = await withTimeout(
      provider.generate(voiceCommandTask, {
        instruction: redactPersonalData(instruction.replace(/@(?=[\p{L}\p{N}_])/gu, "")),
      }),
      SERVICE_TIMEOUT_MS,
    );
    const command = voiceCommandSchema.parse(result.output);
    // La IA no puede añadir un mensaje: se toma del dictado original y se revisa en el borrador.
    if (command.note && !instruction.includes(command.note)) command.note = null;
    const cost = recordedCost(provider.model, result.usage);
    await db.$transaction([
      db.aIResponse.create({
        data: {
          requestId,
          output: { action: command.action },
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costMicrosUsd: cost.micros,
        },
      }),
      db.aIRequest.update({
        where: { id: requestId },
        data: { status: "SUCCEEDED", latencyMs: Date.now() - started },
      }),
    ]);
    return { ok: true, command };
  } catch (error) {
    const code = error instanceof AIError ? error.code : providerFailure(error);
    if (requestId)
      await db.aIRequest
        .update({
          where: { id: requestId },
          data: { status: "FAILED", errorCode: code, latencyMs: Date.now() - started },
        })
        .catch(() => undefined);
    return {
      ok: false,
      error: error instanceof AIError ? aiErrorMessage(error, UNAVAILABLE) : UNAVAILABLE,
    };
  }
}
