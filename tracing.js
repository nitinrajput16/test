'use strict';

// tracing.js
// Preload this file with: node -r ./tracing.js src/app.js
// Ensures OpenTelemetry is initialized before the rest of the app.

const path = require('path');

// Load env vars early so exporter config picks them up.
// (Safe if the app also loads dotenv later.)
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_err) {
  // ignore
}

const opentelemetry = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');

const isDebug = String(process.env.OTEL_LOG_LEVEL || '').toLowerCase() === 'debug';

const serviceName = process.env.OTEL_SERVICE_NAME || process.env.APP_NAME || 'edit-code-editor';

// Enable OpenTelemetry diagnostic logs when requested.
// PowerShell: $env:OTEL_LOG_LEVEL="debug"
if (isDebug) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

// If Honeycomb isn't configured, don't crash local runs.
// You can still run with OTLP to a local collector by setting OTEL_EXPORTER_OTLP_ENDPOINT.
const hasOtlpEndpoint = !!(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
const hasHoneycomb = !!process.env.HONEYCOMB_API_KEY;
if (!hasOtlpEndpoint && !hasHoneycomb) {
  console.warn('[otel] OTEL_EXPORTER_OTLP_ENDPOINT or HONEYCOMB_API_KEY not set; telemetry disabled');
} else {
  // If Honeycomb vars are present but endpoint/headers aren't, set sensible defaults.
  if (hasHoneycomb) {
    // Honeycomb OTLP/HTTP endpoint base (the exporter will use /v1/traces)
    if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT && !process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://api.honeycomb.io';
    } else {
      // If a non-Honeycomb endpoint is explicitly set, keep it, but warn.
      // This is a very common "no data in Honeycomb" cause.
      const configuredEndpoint = String(
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || ''
      );
      if (configuredEndpoint && !/honeycomb\.io/i.test(configuredEndpoint)) {
        console.warn(
          '[otel] HONEYCOMB_API_KEY is set, but OTLP endpoint is not Honeycomb:',
          configuredEndpoint,
          '(traces will be sent there instead)'
        );
      }
    }

    // Honeycomb uses OTLP over HTTP/protobuf
    if (!process.env.OTEL_EXPORTER_OTLP_PROTOCOL) {
      process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'http/protobuf';
    }

    // OTLP/HTTP headers for Honeycomb
    // Format: "key1=value1,key2=value2"
    if (!process.env.OTEL_EXPORTER_OTLP_HEADERS) {
      const headers = [
        `x-honeycomb-team=${process.env.HONEYCOMB_API_KEY}`
      ];
      if (process.env.HONEYCOMB_DATASET) {
        headers.push(`x-honeycomb-dataset=${process.env.HONEYCOMB_DATASET}`);
      }
      process.env.OTEL_EXPORTER_OTLP_HEADERS = headers.join(',');
    }

    // Honeycomb typically requires a dataset header for OTLP ingestion.
    // Warn early to avoid the common "no data shows up" confusion.
    const headersStr = String(process.env.OTEL_EXPORTER_OTLP_HEADERS || '');
    const hasDatasetHeader = /(^|,)\s*x-honeycomb-dataset\s*=/.test(headersStr);
    if (!process.env.HONEYCOMB_DATASET && !hasDatasetHeader) {
      console.warn('[otel] HONEYCOMB_DATASET (or x-honeycomb-dataset header) is not set; Honeycomb may reject traces');
    }
  }

  // Helpful startup log (does not print secrets)
  try {
    const tracesEndpoint =
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      (process.env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? new URL('/v1/traces', process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toString()
        : '');
    const hasHeaders = !!process.env.OTEL_EXPORTER_OTLP_HEADERS;
    console.log('[otel] service:', serviceName);
    if (tracesEndpoint) console.log('[otel] traces endpoint:', tracesEndpoint);
    console.log('[otel] protocol:', process.env.OTEL_EXPORTER_OTLP_PROTOCOL || '(default)');
    console.log('[otel] headers set:', hasHeaders ? 'yes' : 'no');
  } catch (_err) {
    // ignore
  }

  const exporter = new OTLPTraceExporter();
  // Extra export diagnostics: show failures (and optionally success counts in debug).
  try {
    const originalExport = exporter.export.bind(exporter);
    exporter.export = (spans, resultCallback) => {
      return originalExport(spans, (result) => {
        const code = typeof result?.code === 'number' ? result.code : undefined;
        if (code !== 0) {
          console.warn('[otel] OTLP export failed:', result);
        } else if (isDebug) {
          console.log(`[otel] OTLP export ok: ${Array.isArray(spans) ? spans.length : 0} spans`);
        }
        resultCallback(result);
      });
    };
  } catch (_err) {
    // ignore
  }

  const sdk = new opentelemetry.NodeSDK({
    serviceName,
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // we recommend disabling fs autoinstrumentation since it can be noisy
        // and expensive during startup
        '@opentelemetry/instrumentation-fs': {
          enabled: false
        }
      })
    ]
  });

  // In some SDK versions, start() is synchronous (returns void).
  // In others, it returns a Promise.
  try {
    const res = sdk.start();
    if (res && typeof res.then === 'function') {
      res.catch((err) => {
        console.warn('[otel] sdk.start failed:', err && err.message);
      });
    }
  } catch (err) {
    console.warn('[otel] sdk.start failed:', err && err.message);
  }

  function shutdown() {
    return sdk
      .shutdown()
      .catch((err) => console.warn('[otel] shutdown failed:', err && err.message));
  }

  process.on('SIGTERM', () => shutdown().finally(() => process.exit(0)));
  process.on('SIGINT', () => shutdown().finally(() => process.exit(0)));
}

// If someone runs: node ./tracing.js <entry.js>
// load the provided entry after initializing telemetry.
if (require.main === module) {
  const entry = process.argv[2];
  if (!entry) {
    console.log('Usage: node -r ./tracing.js <entry>');
    console.log('   or: node ./tracing.js <entry>');
    process.exit(0);
  }
  // eslint-disable-next-line global-require, import/no-dynamic-require
  require(path.resolve(process.cwd(), entry));
}
