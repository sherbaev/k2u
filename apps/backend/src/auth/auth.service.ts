import { Inject, Injectable, Logger, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CONFIG, type AppConfig } from "../config/configuration.js";
import { User } from "./user.schema.js";
import { hashPassword, verifyPassword } from "./auth-crypto.js";

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly log = new Logger(AuthService.name);

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly jwt: JwtService,
  ) {}

  /** Seed a default admin on first boot if the users collection is empty. */
  async onModuleInit(): Promise<void> {
    try {
      const count = await this.users.estimatedDocumentCount();
      if (count === 0 && this.config.seedAdminPassword) {
        await this.users.create({
          username: this.config.seedAdminUser,
          passwordHash: hashPassword(this.config.seedAdminPassword),
          role: "admin",
        });
        this.log.warn(`seeded admin user "${this.config.seedAdminUser}" — change the password`);
      }
    } catch (e) {
      this.log.warn(`admin seed skipped: ${(e as Error).message}`);
    }
  }

  async login(username: string, password: string): Promise<{ token: string; role: string }> {
    const user = await this.users.findOne({ username }).lean();
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("invalid credentials");
    }
    const token = await this.jwt.signAsync({ sub: username, role: user.role });
    return { token, role: user.role };
  }

  async createUser(username: string, password: string, role = "operator"): Promise<void> {
    await this.users.create({ username, passwordHash: hashPassword(password), role });
  }
}
