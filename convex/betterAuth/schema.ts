import { defineSchema } from "convex/server";
import { tables } from "./generatedSchema";

// Don't edit the generated tables here — change the Better Auth config and
// regenerate (see ./auth.ts).
const schema = defineSchema({
  ...tables,
});

export default schema;
