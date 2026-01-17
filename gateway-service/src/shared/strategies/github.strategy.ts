import { Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PassportStrategy } from "@nestjs/passport"
import { Profile, Strategy } from "passport-github2"

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, "github") {
	public constructor(private readonly configService: ConfigService) {
		super({
			clientID: configService.getOrThrow<string>("GITHUB_CLIENT_ID"),
			clientSecret: configService.getOrThrow<string>("GITHUB_CLIENT_SECRET"),
			callbackURL: configService.getOrThrow<string>("GITHUB_CALLBACK_URL"),
			scope: ["read:user"]
		})
	}

	public validate(
		_accessToken: string,
		_refreshToken: string,
		profile: Profile
	) {
		return profile
	}
}
