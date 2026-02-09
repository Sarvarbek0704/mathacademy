import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsBigIntString(opts?: ValidationOptions) {
  return (obj: object, propertyName: string) => {
    registerDecorator({
      name: 'IsBigIntString',
      target: obj.constructor,
      propertyName,
      options: opts,
      validator: {
        validate(value: unknown) {
          const s = String(value ?? '').trim();
          return /^\d+$/.test(s) && s !== '0';
        },
      },
    });
  };
}
