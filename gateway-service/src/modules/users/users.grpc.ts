import { AbstractGrpcClient, InjectGrpcClient } from "@citec-spbu/contracts"
import {
	USERS_SERVICE_NAME,
	UsersServiceClient
} from "@citec-spbu/contracts/gen/ts/users"
import type { ClientGrpc } from "@nestjs/microservices"

export class UsersClientGrpc extends AbstractGrpcClient<UsersServiceClient> {
	public constructor(@InjectGrpcClient("USERS_PACKAGE") client: ClientGrpc) {
		super(client, USERS_SERVICE_NAME)
	}
}
