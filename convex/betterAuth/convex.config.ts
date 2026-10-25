import { defineComponent } from "convex/server";

// Better Auth "local install": the auth tables live in this component, with a
// schema generated from our Better Auth config (needed for the passkey table).
const component = defineComponent("betterAuth");

export default component;
