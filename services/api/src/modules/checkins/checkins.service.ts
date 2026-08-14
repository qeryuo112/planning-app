import { Injectable } from "@nestjs/common";

@Injectable()
export class CheckinsService {
  create() {
    return { message: "create checkin placeholder" };
  }

  calendar() {
    return { message: "calendar placeholder" };
  }

  stats(from: string, to: string) {
    return { message: `stats from ${from} to ${to} placeholder` };
  }
}
