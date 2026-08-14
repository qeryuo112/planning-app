import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  health() {
    return { status: "ok", service: "planning-app-api", version: "0.0.1" };
  }
}
