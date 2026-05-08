import { IsInt, IsString, IsOptional } from 'class-validator';

export class CreateHealthDto {
  @IsString()
  name!: string;

  @IsInt()
  age!: number;

  @IsOptional()
  @IsString()
  gender!: string;
}
