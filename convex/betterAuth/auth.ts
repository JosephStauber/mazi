import { createAuth } from "../auth";

// Static instance used only by the Better Auth CLI to generate the schema:
//   cd convex/betterAuth && npx auth@1.6.33 generate --output generatedSchema.ts -y
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth = createAuth({} as any);
