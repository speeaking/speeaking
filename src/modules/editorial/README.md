# editorial

Redacción diaria (ADR-066): la IA redacta borradores para la cuenta editorial de cada comunidad y
una persona del equipo decide qué se publica. Nada sale sin aprobación.

- **El encargo lo decide el código** (`brief.ts`, `calendar.ts`; puro, P2). Por comunidad y día: una
  fecha cercana del calendario mexicano que aún no haya tratado (escalonada entre comunidades) o, si
  no hay, dos preguntas por cada consejo (Humor, solo preguntas), con un enfoque que rota. El mismo
  día y la misma comunidad dan el mismo encargo.
- **La IA solo redacta** (`task.ts`, tarea `editorial_draft`). Recibe el nombre y la descripción de
  la comunidad, el encargo y el inicio de lo reciente de la propia cuenta editorial; nunca datos de
  personas. Modelo de arranque: Gemini 2.5 Flash Lite (`TASK_DEFAULT_MODELS` en `ai/routing.ts`).
- **El código limpia** (`draft-text.ts`): sin Markdown, hashtags, ligas, datos de contacto, montos ni
  porcentajes; por oraciones completas hasta 600 caracteres. Lo que queda vacío, choca con la
  política de contenido o repite algo reciente no se guarda.
- **El servicio** (`service.ts`): `runDailyDrafts` (paso `editorial-drafts` de la operación diaria:
  uno por comunidad y día, máximo 3 sin revisar por comunidad, con tiempo acotado y vencimiento a los
  3 días), `requestDraft` (uno más, con tema), `publishDraft` (un solo `Post` aunque se toque dos
  veces, como la cuenta editorial y con `isAiGenerated`), `discardDraft` y `getDesk`. Todo lo del
  equipo pasa por `assertAdmin`. Sin modelo de verdad (producción con el simulador) o con
  `editorialDesk` apagado, no redacta.
- **La cuenta editorial** (`account.ts`): «Equipo speeaking», `equipo.<comunidad>`, correo `.invalid`
  y sin contraseña; la misma del seed. En producción se crea al publicar el primer borrador. Solo se
  publica con una cuenta de perfil editorial y sin forma de iniciar sesión
  (`EditorialAccountConflictError`); nadie puede registrarse con un correo `.invalid`
  (`identity/schemas.ts`, `isReservedEmail`).
- **Pantalla:** `/admin/redaccion` (por revisar, pedir un borrador y lo último publicado).
