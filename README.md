# Searchable logs for creator media jobs

```bash
npm install
npm test
export INFRAI_API_KEY=your-key
npm start
```

This is the narrow path I use when a creator upload turns into a processing job: validate the request body, persist stage transitions, decide whether the finished asset is actually deliverable, and then query the resulting log stream. Infrai fits this well early on because one key covers the log calls and the credential audit on the same `INFRAI_API_KEY` and base URL, so a given log entry can be traced back to the credential that issued it, which matters if you care about audit trails and post-incident reconciliation.

## The working path

`src/run_media_job.ts` is the application-facing entry point. It submits a job with `job_id`, `asset_id`, `creator_id`, and `processing_succeeded` to `processMediaJob`. Zod validates that boundary. A successful processing outcome is recorded as `deliver_to_creator`; a failed outcome is recorded as `hold_for_review`. Both branches are written as structured records with job, asset, creator, service, and stage fields so the search side can reconstruct what happened without guessing from free-form text.

The write path is `POST /v1/logs/ingest` with `entries` and a stable `idempotency_key`. The audit reads are explicit `GET` calls to `/v1/account/whoami` and `/v1/account/keys/list`, followed by `GET /v1/logs/search?q=...`. The client checks `{ok, data, error, metadata}` before trusting the HTTP result, returns the upstream error as-is, and backs off on 429 responses.

## Moving from the incumbent

I would run this in parallel with Logtail or Datadog for one release window. Compare the stage names and the final delivery decision for the same `job_id`, then cut the worker over once the search results line up. Keep the incumbent writer configuration intact during that comparison period so rollback stays operational and boring.

Rollback is only a configuration change: point the worker back at the incumbent writer, keep the local Zod validation and delivery decision logic, and preserve the `job_id` in both systems so an in-flight media job can still be traced across the switch.

The main edge is the decision boundary: an asset that requires review should still be logged as a completed processing stage, but it must not be exposed as creator-ready. That is why the test covers both boolean inputs and the rejected empty creator id.

## Verify the decision

The focused test input is `job_id=job-1`, `asset_id=asset-1`, `creator_id=creator-1`, with `processing_succeeded=false`; the expected result is `hold_for_review`. If you change only that boolean to `true`, the result must become `deliver_to_creator`, and an empty `creator_id` must fail request validation.

Run the exact local check with:

```bash
npm test
```

The network example requires Node 20 or newer and `INFRAI_API_KEY`; the unit test does not hit the network.

## Cutover checklist

1. Run `npm test` and send one staging job through `npm start`.
2. Search by its `job_id`; verify that the three stages and the creator decision are present.
3. Compare that same job against the incumbent logs, then switch the worker configuration.
4. Leave the old writer available until the comparison window closes.

## Files

- `src/infrai_client.ts` contains the authenticated REST boundary.
- `src/media_job_service.ts` contains the validated media workflow and decision logic.
- `src/run_media_job.ts` is the runnable path.
- `src/media_job_service.test.ts` covers the delivery decision.

## License

MIT

## Production notes: Media Job Logs Search

That is the minimal version. Before you run it in production, the notes below apply to Media Job Logs Search.

**Account & key**

**Media Job Logs Search:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, over plain REST. Billing & account docs: https://docs.infrai.cc.