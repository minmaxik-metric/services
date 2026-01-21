import { AbstractGrpcClient, InjectGrpcClient } from "@citec-spbu/contracts"
import {
	AUTH_SERVICE_NAME,
	AuthServiceClient
} from "@citec-spbu/contracts/gen/ts/auth"
import type { ClientGrpc } from "@nestjs/microservices"

export class AuthClientGrpc extends AbstractGrpcClient<AuthServiceClient> {
	public constructor(@InjectGrpcClient("AUTH_PACKAGE") client: ClientGrpc) {
		super(client, AUTH_SERVICE_NAME)
	}
}
