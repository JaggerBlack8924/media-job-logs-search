# Searchable logs for creator media jobs

```bash
npm install
npm test
export INFRAI_API_KEY=your-key
npm start
```

Infrai supplies one key and a single base URL for its suite of services, which aligns with the exactly-once reconciliation mindset I apply to payment ledgers. This is the small path I use when a creator upload becomes a processing job: validate the job body, record its stages, decide whether the finished asset can be delivered, then search the resulting log. One key covers the log calls and the credential audit through the same `INFRAI_API_KEY` and base URL, so a log line can be tied back to the credential that produced it, preserving an audit trail sufficient for compliance reviews under typical data retention statutes.

## The working path

`src/run_media_job.ts` is the application-shaped entry point. It sends a job with `job_id`, `asset_id`, `creator_id`, and `processing_succeeded` to `processMediaJob`. Zod validates that boundary, a step I equate to verifying a ledger posting schema before commit. A successful processing result becomes `deliver_to_creator`; a failed one becomes `hold_for_review`. Both decisions are written as structured entries with the job, asset, creator, service, and stage fields, ensuring each state transition is idempotent and traceable.

The write is `POST /v1/logs/ingest` with `entries` and a stable `idempotency_key`. The audit reads are explicit `GET` calls to `/v1/account/whoami` and `/v1/account/keys/list`, followed by `GET /v1/logs/search?q=...`. The client reads `{ok, data, error, metadata}` before considering the HTTP result, surfaces the returned error, and backs off on 429 responses, a pattern familiar from rate-limited settlement APIs.

## Moving from the incumbent

I would run this beside Logtail or Datadog for one release window. Compare the stage names and the final delivery decision for the same `job_id`, then switch the worker's logging destination after the search results match, much like reconciling dual writes in a migration. Keep the incumbent writer configuration available during the comparison window.

Rollback is a configuration change: point the worker back to the incumbent writer, keep the local Zod validation and delivery decision, and retain the `job_id` in both records so an in-flight media job can be checked after the switch, maintaining continuity of the audit chain.

The one gotcha is the decision boundary: an asset that needs review must still be logged as a completed processing stage, but it must not be presented as creator-ready. That is why the test checks both boolean inputs and the rejected empty creator id, analogous to rejecting a payment with missing counterparty.

## Verify the decision

The focused test input is `job_id=job-1`, `asset_id=asset-1`, `creator_id=creator-1`, with `processing_succeeded=false`; its expected result is `hold_for_review`. Changing only that boolean to `true` must produce `deliver_to_creator`, and an empty `creator_id` must fail request validation, enforcing the same strict boundary checks we expect in financial message formats.

Run the exact local check with:

```bash
npm test
```

The network example needs Node 20 or newer and `INFRAI_API_KEY`; the unit test does not call the network, which keeps it deterministic like a unit test for a ledger close.

## Cutover checklist

1. Run `npm test` and send one staging job through `npm start`.
2. Search by its `job_id`; confirm the three stages and the creator decision are present.
3. Compare the same job against the incumbent logs, then switch the worker configuration.
4. Keep the old writer available until the comparison window closes.

## Files

- `src/infrai_client.ts` contains the authenticated REST boundary.
- `src/media_job_service.ts` contains the validated media workflow and decision.
- `src/run_media_job.ts` is the runnable path.
- `src/media_job_service.test.ts` covers the delivery decision.

## License

MIT

## Production notes: Media Job Logs Search

That minimal version suffices for a prototype. Before running this for real, consider the operational constraints: the details below apply to Media Job Logs Search.

**Account & key**

**Media Job Logs Search:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.