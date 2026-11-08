# Automatización con GitHub Actions (generación sin publicación)

Esta configuración ejecuta AgentTube en una máquina temporal de GitHub Actions. El primer paso produce un vídeo largo y, en la ejecución semanal, también prepara tres Shorts a partir de ese vídeo. Los resultados quedan como borradores para que los revises.

## Antes de empezar

1. Integra en `master` la rama `codex/github-actions-generation-only` después de revisar el cambio.
2. En el repositorio, abre **Settings → Secrets and variables → Actions → New repository secret**.
3. Crea un secreto llamado `GEMINI_API_KEY` y pega ahí tu clave de Gemini. No la escribas en un archivo, en el código ni en un mensaje.
4. Abre **Actions** y, si GitHub muestra el botón para habilitar los flujos de trabajo, actívalo.

La clave solo se entrega al proceso que genera el contenido. Este modo no necesita credenciales de YouTube. Si falta la clave, el flujo se detiene antes de generar.

## Primera prueba manual

1. Ve a **Actions → AgentTube generation (no upload) → Run workflow**.
2. Elige **long-form**.
3. Deja el tema sugerido o escribe uno concreto, como «Cómo usar asistentes de IA para estudiar».
4. Elige la duración. Empieza por **short** para revisar el funcionamiento y el consumo.
5. Pulsa **Run workflow**.
6. Cuando termine, abre la ejecución y descarga **agenttube-drafts-[número]** desde **Artifacts**. Incluye el vídeo y los archivos que AgentTube haya generado.
7. En el registro busca **Production ID**. Guárdalo si después quieres volver a generar Shorts de ese vídeo.

La ejecución semanal crea un vídeo largo y trata de renderizar tres Shorts con sus escenas. También puedes lanzar una ejecución manual con **shorts** e introducir el Production ID de un vídeo largo anterior.

## Qué se guarda y por cuánto tiempo

- La carpeta de datos de AgentTube —incluida la base SQLite y los medios de trabajo— se conserva entre ejecuciones con la caché de Actions.
- El artefacto descargable de cada ejecución se conserva **7 días**. Descárgalo antes de que expire.
- Las cachés pueden caducar tras 7 días sin uso y se eliminan primero cuando se supera el límite de almacenamiento de caché de 10 GB. No son un archivo permanente. Si la caché se pierde, el flujo puede empezar con una base vacía.
- El plan GitHub Free incluye 500 MB de almacenamiento de Actions. Los vídeos pueden llenar ese espacio; si ocurre, descarga o elimina artefactos anteriores desde **Actions**. Para conservar una biblioteca de vídeos a largo plazo hará falta descargarla o conectarla a otro almacenamiento.

## Calendario y controles

La ejecución automática está configurada para **los lunes a las 06:17 UTC**. GitHub interpreta el cron en UTC; puede cambiar la hora local al entrar o salir del horario de verano.

El modo de Actions desactiva el programador permanente de AgentTube y bloquea la aprobación y publicación desde ese proceso. Los vídeos no se suben a YouTube. La variable de privacidad se fija en `private` como protección adicional si se reutiliza el proceso fuera de Actions.

El flujo tiene un límite de 180 minutos, no se solapa consigo mismo y usa permisos de lectura del código. Los borradores generados no contienen la clave API. La caché incluye la base y los medios de AgentTube; no guarda `.env`, archivos de credenciales ni tokens OAuth.

## Coste y límites

Este fork es público, por lo que GitHub ofrece sin coste los runners estándar alojados por GitHub. El almacenamiento de artefactos y caché sigue teniendo cuotas. Gemini tiene un nivel gratuito para determinados modelos, pero los modelos disponibles, cuotas y límites varían. La generación de vídeos, imágenes o voz puede no estar incluida en esas cuotas o puede agotarlas; comprueba el consumo en Google AI Studio. No se garantiza que el uso total sea siempre gratuito.

Fuentes oficiales consultadas el 8 de noviembre de 2026:

- [Facturación y uso de GitHub Actions](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [Uso incluido por plan de GitHub](https://docs.github.com/en/billing/reference/product-usage-included)
- [Límites y cuotas de caché de Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [Precios de Gemini Developer API](https://ai.google.dev/gemini-api/docs/pricing)
