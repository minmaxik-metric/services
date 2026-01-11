import { ConfigService } from "@nestjs/config"
import { Params } from "nestjs-pino"

export function getLoggerModuleConfig(configService: ConfigService): Params {
	const logLevel = configService.getOrThrow<string>("LOG_LEVEL")
	const logPath = configService.getOrThrow<string>("LOG_PATH")

	return {
		pinoHttp: {
			level: logLevel,
			transport: {
				target: "pino/file",
				options: {
					destination: logPath,
					mkdir: true
				}
			},
			messageKey: "msg",
			customProps: () => ({
				service: "auth-service"
			})
		}
	}
}
