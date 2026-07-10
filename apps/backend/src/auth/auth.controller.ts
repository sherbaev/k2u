import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard, Roles } from "./jwt.guard.js";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body() body: { username: string; password: string }) {
    return this.auth.login(body?.username, body?.password);
  }

  /** Admin-only user creation (enforced when AUTH_REQUIRED=true). */
  @Post("users")
  @UseGuards(JwtAuthGuard)
  @Roles("admin")
  async createUser(@Body() body: { username: string; password: string; role?: string }) {
    await this.auth.createUser(body.username, body.password, body.role ?? "operator");
    return { ok: true };
  }
}
