# HTTP and webhook logs

The portal, ZICB, Zanaco and IZB Node services install the shared HTTP logger at startup. Their separate worker entry points install it too. It records inbound HTTP requests (including callbacks, webhooks, authentication, health checks and rejected routes), outbound `fetch` and Node HTTP/HTTPS calls, response status/headers/bodies, elapsed time, connection failures and interrupted responses. Logs go to stdout, so systemd or Docker retains them with the existing service logs. Restart each deployed process to enable it.

Readable blocks begin with `[HTTP service-name correlation-id] INBOUND` or `OUTBOUND`. Incoming `x-correlation-id` values are validated or replaced, returned in response headers, and propagated on outgoing calls within that request. Follow a correlation ID across portal and agent journals. HTTP errors are observations only: logging does not retry, resend or change payment outcomes. The older ZICB detailed body blocks are suppressed when the shared logger is installed; its outcome summaries remain.

```bash
journalctl -u banksportal.service -f -o cat --no-pager
journalctl -u zicb-agent-service.service -f -o cat --no-pager
# Substitute the actual unit names for your Zanaco and IZB deployments.
```

Defaults require no additional environment settings. Set these per service if needed:

```dotenv
HTTP_LOG_ENABLED=true
HTTP_LOG_BODIES=true
HTTP_LOG_MAX_BODY_BYTES=262144
HTTP_LOG_BODY_TIMEOUT_MS=10000
```

`HTTP_LOG_ENABLED=false` disables the shared logger at startup. `HTTP_LOG_BODIES=false` retains HTTP metadata while omitting payloads. Payload capture is bounded to 256 KiB by default (configurable up to 10 MiB); over-limit or incomplete previews are omitted because partial credentials cannot be reliably redacted. Streaming `fetch` response capture stops after the configured time without cancelling the application's response. Binary, compressed native responses and multipart bodies are identified rather than dumped. Text/JSON bodies are displayed with credential redaction, and JSON is indented for readability. This is not a byte-for-byte packet capture.

Authorization, cookies, API keys, client secrets, tokens, signatures, passwords and PEM private keys are redacted. Authentication endpoint bodies are omitted. Account numbers, names, amounts and payment references remain visible to support reconciliation; restrict journal access and retention accordingly. Incoming streams are observed as the application consumes them; an unread incoming body cannot be reconstructed. Outgoing `Request` bodies are inspected through a bounded clone; custom stream/multipart `init.body` uploads are marked rather than consumed by the logger. Existing request parsing, response consumption, stream backpressure and error handling are preserved.

The implementation covers HTTP/HTTPS traffic in the repository's Node processes. It does not capture SQL, Redis, WebSocket messages, traffic in a separate Sage server, or requests rejected by a reverse proxy before they reach Node. Keep proxy logs for those failures. There is no Sage wrapper source in this checkout to instrument.

Run the real HTTP integration checks with:

```bash
node --test shared/http-logging/test/httpLogging.test.cjs
```

Docker builds now use the repository root as their context so each image contains the shared logger. From the root, build with `docker build -f microservices/zanaco-agent-service/Dockerfile .` (and the corresponding portal/ZICB Dockerfile), or use the updated compose configuration. The portal image uses Node 22, which meets the existing Next.js 16 runtime requirement. Zanaco key directories and private PEM files are excluded from the root Docker context.
