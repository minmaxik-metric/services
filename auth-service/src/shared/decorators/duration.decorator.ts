import {
	registerDecorator,
	ValidationArguments,
	ValidationOptions
} from "class-validator"

export function IsDuration(validationOptions?: ValidationOptions) {
	return function (object: object, propertyName: string) {
		registerDecorator({
			name: "isDuration",
			target: object.constructor,
			propertyName: propertyName,
			constraints: [],
			options: validationOptions,
			validator: {
				validate(value: any) {
					return typeof value === "string" && /^\d+(ms|s|m|h|d|w)$/.test(value)
				},
				defaultMessage(args: ValidationArguments) {
					return `${args.property} must be a duration string (e.g. 7d, 15m, 20s)`
				}
			}
		})
	}
}
