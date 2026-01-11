import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"

const traceExporter = new OTLPTraceExporter({
	url: process.env.JAEGER_URL
})

const sdk = new NodeSDK({
	traceExporter,
	resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: "auth-service" }),
	instrumentations: [
		getNodeAutoInstrumentations({
			"@opentelemetry/instrumentation-grpc": { enabled: true },
			"@opentelemetry/instrumentation-http": { enabled: true },
			"@opentelemetry/instrumentation-nestjs-core": { enabled: true },
			"@opentelemetry/instrumentation-pg": { enabled: true }
		})
	]
})

sdk.start()
