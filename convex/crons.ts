import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Timed suspensions end on their own; the user is emailed and it's audited.
crons.interval("expire suspensions", { minutes: 10 }, internal.admin.expireSuspensions, {});

export default crons;
