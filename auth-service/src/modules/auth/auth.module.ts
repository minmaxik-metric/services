import { JwtModule } from "@citec-spbu/jwt"
import { Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { getJwtModuleConfig } from "@/config"

import { UsersModule } from "../users/users.module"

import { AuthController } from "./auth.controller"
import { AuthRepository } from "./auth.repository"
import { AuthService } from "./auth.service"

export interface IssuerModuleOptions {
	privateKey: string
}

@Module({
	imports: [
		JwtModule.registerAsync({
			useFactory: getJwtModuleConfig,
			inject: [ConfigService]
		}),
		UsersModule
	],
	controllers: [AuthController],
	providers: [AuthService, AuthRepository]
})
export class AuthModule {}
