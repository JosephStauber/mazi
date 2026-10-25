"use client";

// Same UI as the root boundary, but inside the (protected) layout so AppShell
// stays mounted — its live suspension check can still redirect to /suspended
// when a query starts failing because the account was just suspended.
export { default } from "../error";
