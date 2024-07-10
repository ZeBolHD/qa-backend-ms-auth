import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

import { RegisterUserDto } from "@auth/dto/";

@ValidatorConstraint()
export class IsPasswordsMatchingConstraint implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments): boolean {
    const obj = args.object as RegisterUserDto;
    return obj.password === obj.passwordRepeat;
  }

  defaultMessage(): string {
    return "Passwords do not match";
  }
}
