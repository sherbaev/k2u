import { Global, Module } from "@nestjs/common";
import { CONFIG, loadConfig } from "./configuration.js";

@Global()
@Module({
  providers: [{ provide: CONFIG, useValue: loadConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
