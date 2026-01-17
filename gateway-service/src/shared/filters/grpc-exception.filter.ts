import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException
} from "@nestjs/common"
import { Response } from "express"

import { grpcToHttpStatus } from "../utils"

type GrpcError = { code: number; details?: string }

const isGrpcError = (e: unknown): e is GrpcError =>
	typeof e === "object" &&
	e !== null &&
	"code" in e &&
	typeof (e as Partial<GrpcError>).code === "number" &&
	"details" in e

@Catch()
export class GrpcExceptionFilter implements ExceptionFilter {
	public catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp()
		const response = ctx.getResponse<Response>()

		if (isGrpcError(exception)) {
			const status = grpcToHttpStatus[exception.code] ?? 500

			return response.status(status).json({
				statusCode: status,
				message: exception.details || "Internal gRPC error"
			})
		}

		if (exception instanceof HttpException) {
			const status = exception.getStatus()

			return response.status(status).json({
				statusCode: status,
				message: exception.message
			})
		}

		return response.status(500).json({
			statusCode: 500,
			message: "Internal server error"
		})
	}
}
