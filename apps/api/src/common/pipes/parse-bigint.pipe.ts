import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    const v = String(value ?? '').trim();
    if (!v) throw new BadRequestException('ID is required');
    if (!/^\d+$/.test(v))
      throw new BadRequestException('ID must be a number string');
    try {
      return BigInt(v);
    } catch {
      throw new BadRequestException('Invalid ID');
    }
  }
}
