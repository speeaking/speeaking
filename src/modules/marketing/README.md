# marketing

Medición de la campaña en TikTok (ADR-072). Solo con permiso de quien visita y nunca en lo privado.

| Archivo                             | Qué hace                                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ad-pixel.ts`                       | Reglas puras: en qué páginas puede ir el pixel (`pixelAllowedOn`), la cookie de la decisión (`speeaking_anuncios`) y el ID configurado (`tiktokPixelId`). |
| `server.ts`                         | El pixel de este despliegue (`TIKTOK_PIXEL_ID`; nunca en vistas previas de Vercel).                                                                       |
| `tiktok.ts`                         | Código base de TikTok en TypeScript (sin script en línea), modo de consentimiento y el registro completo una vez por navegador.                           |
| `navigation-guard.ts`               | Con TikTok cargado, ir a una página no permitida es una carga completa: TikTok nunca ve una página privada.                                               |
| `components/ad-pixel.tsx`           | Aviso «Aceptar / No, gracias» y activación por página (layouts social y de registro).                                                                     |
| `components/registration-event.tsx` | `CompleteRegistration` en `/bienvenida`.                                                                                                                  |
| `components/ad-consent-control.tsx` | Cambiar la decisión en `/cookies`.                                                                                                                        |

Agregar otra página con pixel es cambiar `pixelAllowedOn`, sus pruebas, el aviso de privacidad y
`/cookies` (subiendo `LEGAL_VERSIONS.privacyNotice`).
