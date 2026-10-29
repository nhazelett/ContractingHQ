# N00024 network-stop repair

The second automatic queue batch (40792241362) stopped with `fetch failed`.
Its report contained no source network error or source HTTP failure, while the
R2 gateway helper retried only HTTP response statuses. A connection exception
before an HTTP response escaped that helper as an unclassified terminal error.
The checkpoint retained 16,234 discovered awards; no publication changed.

The gateway now retries recognized temporary connection errors using the
existing finite backoff, jitter, per-job request/upload limits and conditional
write headers. Exhaustion is reported with a gateway-specific prefix and yields
to the next bounded job after the configured delay. Source-facade timeout and
unreadable-response errors also retain their resumable classification.
Validation mismatches, invalid URLs, certificate errors, caller cancellations,
storage limits and uncertain D1 write outcomes still stop rather than being
blindly replayed. Conditional-write 412 checksum reconciliation is preserved.

The dedicated recovery workflow waits for the exact deployed commit to pass,
then atomically reopens only N00024's observed `fetch failed` stop. It refuses
active or uncertain leases, a different failure, exhausted attempts, a missing
checkpoint or another stopped office. It records a recovery receipt and retains
the existing checkpoint reference, attempts, usage and storage reservations.
It then dispatches the existing ranked queue; it does not start a fresh import.

GitHub run artifacts and D1 recovery receipts contain the actual recovery result.
