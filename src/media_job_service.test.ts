import assert from "node:assert/strict";
import { deliveryDecision, mediaJobSchema } from "./media_job_service.js";

const input = { job_id: "job-1", asset_id: "asset-1", creator_id: "creator-1", processing_succeeded: false };
assert.equal(deliveryDecision(mediaJobSchema.parse(input)), "hold_for_review");
assert.equal(deliveryDecision(mediaJobSchema.parse({ ...input, processing_succeeded: true })), "deliver_to_creator");
assert.throws(() => mediaJobSchema.parse({ ...input, creator_id: "" }));
console.log("media delivery decision test passed");
