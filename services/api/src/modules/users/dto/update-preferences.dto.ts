import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class TimeSlotDto {
  @IsString()
  @Matches(TIME_REGEX, { message: "开始时间格式必须为 HH:mm" })
  start: string;

  @IsString()
  @Matches(TIME_REGEX, { message: "结束时间格式必须为 HH:mm" })
  end: string;
}

export class AvailableTimeDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  monday?: TimeSlotDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  tuesday?: TimeSlotDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  wednesday?: TimeSlotDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  thursday?: TimeSlotDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  friday?: TimeSlotDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  saturday?: TimeSlotDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  sunday?: TimeSlotDto[];
}

export class EnergyCurveDto {
  [hour: string]: "high" | "medium" | "low";
}

export class NotificationSettingDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  reminderMinutesBefore?: number;

  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: "免打扰开始时间格式必须为 HH:mm" })
  doNotDisturbStart?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: "免打扰结束时间格式必须为 HH:mm" })
  doNotDisturbEnd?: string;

  @IsOptional()
  @IsBoolean()
  weekendOff?: boolean;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AvailableTimeDto)
  availableTime?: AvailableTimeDto;

  @IsOptional()
  energyCurve?: EnergyCurveDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationSettingDto)
  notificationSetting?: NotificationSettingDto;
}
