import { Body, Controller, Post } from "@nestjs/common";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { ExternalService } from "./external.service";
import { ImportFitnessDataDto } from "./dto/import-fitness-data.dto";

@Controller("external")
export class ExternalController {
  constructor(private readonly externalService: ExternalService) {}

  @Post("fitness-import")
  importFitnessData(
    @Body() dto: ImportFitnessDataDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.externalService.importFitnessData(user.userId, dto);
  }
}
