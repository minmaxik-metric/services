import { AbstractGrpcClient, InjectGrpcClient } from "@citec-spbu/contracts"
import {
	ACCOUNT_SERVICE_NAME,
	AccountServiceClient
} from "@citec-spbu/contracts/gen/ts/account"
import type { ClientGrpc } from "@nestjs/microservices"

export class AccountClientGrpc extends AbstractGrpcClient<AccountServiceClient> {
	public constructor(@InjectGrpcClient("ACCOUNT_PACKAGE") client: ClientGrpc) {
		super(client, ACCOUNT_SERVICE_NAME)
	}
}
