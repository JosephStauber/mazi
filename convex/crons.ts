import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Uploads that were never attached to a profile or post (abandoned composer,
// failed claim) are deleted once they're a day old.
crons.hourly("sweep orphaned uploads", { minuteUTC: 17 }, internal.files.sweepOrphanedUploads, {});

// Timed suspensions end on their own; the user is emailed and it's audited.
crons.interval("expire suspensions", { minutes: 10 }, internal.admin.expireSuspensions, {});

export default crons;
