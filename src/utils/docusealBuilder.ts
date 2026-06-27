const DEFAULT_DOCUSEAL_HOST = 'docuseal.eu'

function resolveDocusealHost(host?: string | null): string {
  const trimmed = host?.trim()
  return trimmed || DEFAULT_DOCUSEAL_HOST
}

function docusealBuilderScriptUrl(host: string): string {
  return `https://cdn.${host}/js/builder.js`
}

export function buildDocusealBuilderSrcDoc(token: string, host?: string | null) {
  const resolvedHost = resolveDocusealHost(host)
  const scriptUrl = docusealBuilderScriptUrl(resolvedHost)

  return `<!DOCTYPE html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="${scriptUrl}"><\/script>
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #f8fafc;
      }

      docuseal-builder {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <docuseal-builder data-token="${token}" data-host="${resolvedHost}" data-with-send-button="false" data-with-sign-yourself-button="false" data-with-upload-button="false" data-background-color="#f8fafc"></docuseal-builder>
    <script>
      const builder = document.querySelector('docuseal-builder');

      if (builder) {
        builder.addEventListener('save', () => {
          window.parent.postMessage({ source: 'docuseal-builder', type: 'save' }, '*');
        });
      }
    <\/script>
  </body>
</html>`
}
