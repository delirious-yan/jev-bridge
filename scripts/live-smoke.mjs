// Synthetic-only smoke. Do not run on customer data. Executes one potentially billable call.
import { evaluateChoice } from "../src/jev.mjs";

if (process.env.JEV_ALLOW_LIVE !== "YES_LIVE_CALL") {
  console.error("NOT RUN: set JEV_ALLOW_LIVE=YES_LIVE_CALL only after explicit approval.");
  process.exitCode = 2;
} else {
  const verdict = await evaluateChoice({
    state: "A person asks: please show the latest open browser tab.",
    instructions: "Which user intent is expressed?",
    criteria: {
      switch_tab: "Switch to a browser tab",
      create_tab: "Open a brand new browser tab",
      no_match: "Neither action is expressed",
    },
    apiKey: process.env.TYPESAFE_API_KEY,
    allowNetwork: true,
  });
  if (verdict.status !== "advisory") {
    console.error(`JEV SMOKE FAILED: ${verdict.reason}`);
    process.exitCode = 1;
  } else {
    // Synthetic intent only. Do not print state, tokens, or upstream payloads.
    console.log(`JEV SYNTHETIC READ-ONLY PASS model=${verdict.model} choice=${verdict.choice}`);
  }
}
