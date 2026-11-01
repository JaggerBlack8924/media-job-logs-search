import { InfraiClient } from "./infrai_client.js";
import { processMediaJob } from "./media_job_service.js";

const client = new InfraiClient();
const job = {
  job_id: process.env.MEDIA_JOB_ID ?? "job_creator_reel_204",
  asset_id: process.env.MEDIA_ASSET_ID ?? "asset_reel_204",
  creator_id: process.env.MEDIA_CREATOR_ID ?? "creator_17",
  processing_succeeded: true
};
const result = await processMediaJob(job, client);
const audit = await client.whoami();
const keys = await client.keysList();
const found = await client.search(job.job_id);
console.log(JSON.stringify({ result, audit, keys, found }, null, 2));
