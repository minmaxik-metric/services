import {
	CallHandler,
	ExecutionContext,
	Injectable,
	type NestInterceptor
} from "@nestjs/common"
import { InjectMetric } from "@willsoto/nestjs-prometheus"
import { Counter, Histogram } from "prom-client"
import { finalize, Observable, tap } from "rxjs"

@Injectable()
export class GrpcMetricsInterceptor implements NestInterceptor {
	private readonly SERVICE_NAME: string

	public constructor(
		@InjectMetric("grpc_requests_total")
		private readonly counter: Counter<string>,

		@InjectMetric("grpc_request_duration_seconds")
		private readonly histogram: Histogram<string>
	) {
		this.SERVICE_NAME = "auth_service"
	}

	public intercept(
		context: ExecutionContext,
		next: CallHandler<any>
	): Observable<any> {
		const method = context.getHandler().name

		const endTimer = this.histogram.startTimer({
			service: this.SERVICE_NAME,
			method: method
		})

		return next.handle().pipe(
			tap({
				next: () => {
					this.counter.inc({
						service: this.SERVICE_NAME,
						method,
						status: "OK"
					})
				},
				error: () => {
					this.counter.inc({
						service: this.SERVICE_NAME,
						method,
						status: "ERROR"
					})
				}
			}),
			finalize(() => endTimer())
		)
	}
}
