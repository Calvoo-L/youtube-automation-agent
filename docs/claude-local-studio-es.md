# Usar AgentTube con Claude en tu PC

Esta guía configura la web que ya incluye AgentTube para uso local. No crea una web pública: el panel solo se abre en tu PC en `http://127.0.0.1:3456`.

## Qué hará cada parte

- **Claude API** prepara temas, guiones y texto del video.
- **AgentTube** organiza la generación, audio, visuales, montaje del MP4 y revisión.
- **YouTube** requiere una conexión OAuth de Google. Los videos esperan tu aprobación antes de publicarse; la privacidad predeterminada es privada.

Claude API no crea por sí sola el MP4, las imágenes ni la narración. Para esas etapas AgentTube usa sus proveedores de medios. Si no hay un proveedor visual disponible, puede crear diapositivas locales sencillas.

## 1. Obtener una clave para Claude

1. Entra en [Anthropic Console](https://console.anthropic.com/) y crea una clave de API.
2. Añade créditos o configura un límite de gasto antes de probarla.
3. La API se factura aparte de una suscripción Claude.ai. La aplicación no usa tu sesión ni contraseña de Claude.

No compartas la clave en el chat ni la subas a GitHub.

## 2. Descargar y preparar el proyecto en Windows

1. Descarga tu fork: [Calvoo-L/youtube-automation-agent](https://github.com/Calvoo-L/youtube-automation-agent).
2. Abre PowerShell dentro de la carpeta del proyecto.
3. Instala las dependencias:

```powershell
npm install
npx playwright install chromium
```

## 3. Configurar Claude y el canal

Hay dos maneras de guardar la clave; elige solo una:

- **Más sencilla:** ejecuta `npm run walkthrough`. Cuando pregunte por el proveedor de texto, elige **Anthropic Claude**, pega tu clave y confirma que la prueba funcione. El asistente la guarda en `config/credentials.json`, que Git excluye.
- **Con archivo .env:** copia `.env.example` como `.env` y añade estas líneas. Luego ejecuta el asistente; como ya detectará la clave, responde **No** si pregunta si quieres configurar otro proveedor.

```env
ANTHROPIC_API_KEY=pega_aqui_tu_clave
ANTHROPIC_MODEL=claude-sonnet-5-5
CHANNEL_NAME=Tecnología, IA y herramientas digitales
TARGET_AUDIENCE=Personas de 16 años en adelante interesadas en tecnología, inteligencia artificial y herramientas digitales
DEFAULT_PRIVACY_STATUS=private
```

En el asistente, conecta YouTube si quieres gestionar subidas desde el panel. Te guía para crear credenciales OAuth de tipo **Desktop app** en Google Cloud. Deja la privacidad en **private** mientras revisas los primeros resultados.

## 4. Abrir el panel y crear un video

Ejecuta:

```powershell
npm start
```

Abre [http://127.0.0.1:3456](http://127.0.0.1:3456), pulsa **Create video**, escribe el tema y elige la duración. Si dejas el tema vacío, el agente puede proponer uno según la estrategia del canal.

Cuando termine, revisa el MP4 y sus datos en **Pipeline**. La publicación requiere aprobación. Mantén la sesión abierta y el PC encendido mientras genera el video.

## Importante sobre el aspecto del video

Claude redacta y planifica; AgentTube compone el video con las herramientas de audio y video configuradas. Tener Claude conectado no habilita generación de imágenes ni video por IA. Sin un proveedor de medios disponible, el montaje local usa diapositivas sencillas. Antes de activar un proveedor de pago, revisa sus precios y añade un límite de gasto en su propia consola.

Las claves y archivos OAuth de este modo local deben quedarse en tu PC. No pegues `.env`, `config/credentials.json` ni `config/tokens.json` en chats ni los añadas a commits.
