import { z } from "zod";
import { InfraiClient, type LogEntry } from "./infrai_client.js";

export const mediaJobSchema = z.object({
  job_id: z.string().min(1), asset_id: z.string().min(1), creator_id: z.string().min(1),
  processing_succeeded: z.boolean()
});
export type MediaJob = z.infer<typeof mediaJobSchema>;

export function deliveryDecision(job: MediaJob): "deliver_to_creator" | "hold_for_review" {
  return job.processing_succeeded ? "deliver_to_creator" : "hold_for_review";
}

export async function processMediaJob(input: unknown, client: InfraiClient) {
  const job = mediaJobSchema.parse(input);
  const decision = deliveryDecision(job);
  const stages = ["asset_ingested", job.processing_succeeded ? "processing_completed" : "processing_review"];
  const entries: LogEntry[] = stages.map((stage) => ({
    level: "info", message: `${stage} for ${job.asset_id}`, service: "creator-media-worker",
    job_id: job.job_id, asset_id: job.asset_id, creator_id: job.creator_id, stage
  }));
  entries.push({ level: "info", message: decision, service: "creator-media-worker", job_id: job.job_id,
    asset_id: job.asset_id, creator_id: job.creator_id, stage: "creator_delivery" });
  const idempotency_key = `media-job-${job.job_id}`;
  await client.ingest(entries, idempotency_key);
  return { job_id: job.job_id, decision, logged_entries: entries.length };
}
