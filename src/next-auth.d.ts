// Module augmentation (PVL P1) — adds the `role` claim to the User, Session, and JWT types.
// Without this, `session.user.role` / `token.role` / the authorize() return fail `pnpm build`
// typecheck. `role` is a String ("ADMIN" | "STAFF"); see src/lib/product-order.ts (ROLES).
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      id?: string;
      role?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}
