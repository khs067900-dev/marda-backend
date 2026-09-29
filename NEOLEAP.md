# Neoleap bank-hosted checkout

Implemented against the supplied Merchant Integration Guide (313 pages):

- Pages 18-32: JSON-array token request to the account's `hosted.htm`, case-sensitive fields, and `paymentId:paymentPageURL` response.
- Pages 276-282: URL-encode JSON before AES-CBC encryption; use the entire UTF-8 resource key, IV `PGKEYENCDECIVSPC`, one PKCS7 padding pass, and hexadecimal output. The configured 32-byte key uses AES-256-CBC.
- Pages 133-140: inquire through `tranportal.htm` with action `8`, `udf5: PaymentID`, and the stored payment ID in `transId`.
- Pages 191-198: decrypt notifications, match the payment ID, track ID, and amount, then acknowledge with `[{"status":"1","result":"<frontend result URL>"}]`.

Use Node 22 or newer. Gateway IDs may arrive as unquoted integers beyond JavaScript's safe integer range; JSON parsing preserves their source text.

## Configuration

Keep credentials exclusively in `backend/.env`. Use the hosted and tranportal URLs provided for this specific account. Never put credentials in `NEXT_PUBLIC_*` variables.

Set `BACKEND_URL` to the public HTTPS backend origin and `FRONTEND_URL` to the frontend origin. The default gateway return/notification handler is:

`<BACKEND_URL>/api/orders/neoleap/return`

This route handles browser GET/form POST returns and JSON POST notifications. `NEOLEAP_CALLBACK_URL`, if set, must point to this backend handler. Legacy `NEOLEAP_SUCCESS_URL`/`NEOLEAP_FAILURE_URL` frontend overrides are no longer used for gateway requests, because notifications must be processed on the server.

`localhost` is useful for local development but cannot receive server-to-server gateway notifications. The gateway must be able to reach the public HTTPS URL. Notification enablement is configured by Neoleap for the merchant account.

The browser return redirects to `/order-success?id=...&verify=neoleap`. Verification queries the gateway using the stored reference; URL parameters cannot mark an order paid. Only a matched `CAPTURED` result confirms this purchase flow. An authorization (`APPROVED`), ambiguous response, or unavailable inquiry remains pending. Notifications are acknowledged before final inquiry because gateway settlement follows the acknowledgement.

## Verification

Run from `backend`:

```powershell
npm run test:neoleap
```

The 21 offline tests use synthetic credentials and mock gateway responses. They cover encryption interoperability, request/response formats, numeric ID precision, redirection, inquiry, notification acknowledgement, session reuse, and rejection of forged/mismatched payment results.

On 2026-09-28, the local server health check succeeded. A test-account session request for the existing order failed with `UND_ERR_CONNECT_TIMEOUT` before an HTTP response was received from Neoleap. It now returns HTTP 503 with a useful connection message. No card transaction was submitted. End-to-end gateway acceptance and settlement remain unverified until connectivity and public HTTPS callbacks are available.

If the connection timeout persists, check outbound HTTPS access to the account's gateway hostname and ask Neoleap whether the test account requires source-IP allowlisting. The timeout alone does not establish whether allowlisting, a network restriction, or gateway availability is responsible.

## Checkout regression fixed on 2026-09-29

The session service and controller had switched to returning form data, while the frontend and Mongoose schema still expected a hosted redirect. This caused a successful API response without redirectUrl, triggering the checkout error before the browser reached Neoleap. Five of the original 17 tests failed before the repair.

Restored the documented hosted JSON request and paymentId:URL response, persisted the gateway ID and redirect, excluded incomplete legacy sessions from reuse, and routed gateway returns to the backend handler. Order creation now retains the neoleap payment method. All 21 offline tests pass, including added coverage of persisted sessions, backend callback routing, gateway failures, malformed redirects and existing URL query parameters.

Live checks from this machine on 2026-09-29:
- DNS resolves securepayments.neoleap.com.sa to 185.148.150.98.
- Both configured hosted.htm and tranportal.htm endpoints time out before an HTTP response (UND_ERR_CONNECT_TIMEOUT).
- A real session request using the configured test-account credentials also times out and returns the expected HTTP 503 error. No card transaction was submitted.
- BACKEND_URL and FRONTEND_URL are localhost addresses. End-to-end notifications require public HTTPS URLs.

Gateway acceptance and completed payment remain unverified. Ask the provider to confirm the account-specific test endpoint and whether outbound source-IP allowlisting is required; these checks do not establish the cause of the connection timeout. Deploy/restart the backend with this fix and configure reachable public return URLs before an end-to-end payment test.
