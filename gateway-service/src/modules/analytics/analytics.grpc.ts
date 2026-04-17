import { AbstractGrpcClient, InjectGrpcClient } from "@citec-spbu/contracts"
import {
	ANALYTICS_SERVICE_NAME,
	AnalyticsServiceClient
} from "@citec-spbu/contracts/gen/ts/analytics"
import type { ClientGrpc } from "@nestjs/microservices"

export class AnalyticsClientGrpc extends AbstractGrpcClient<AnalyticsServiceClient> {
	public constructor(
		@InjectGrpcClient("ANALYTICS_PACKAGE") client: ClientGrpc
	) {
		super(client, ANALYTICS_SERVICE_NAME)
	}
}
