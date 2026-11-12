# SOP: Using the Password Reset API (`/auth/reset-password`, `/auth/update-password`)

## Purpose

Let a user who forgot their password set a new one through Backbone, using a two-step
flow: request a one-time reset code, then submit that code with the new password.

**Scope limit:** Backbone does **not** email or text the code. `POST /auth/reset-password`
returns the code directly in its response body, to whoever calls it, with no proof that the
caller owns the account. Your own backend must therefore decide *who is allowed to call
it* and deliver the code to the real user (see [Security model](#security-model)).

## Prerequisites

| Item | Value |
| --- | --- |
| Base URL | `<BACKBONE_URL>` (local default `http://localhost:5000`) |
| Auth header | **None.** Same public `/auth/*` prefix as [sop-user-auth.md](sop-user-auth.md); do not send the API key. |
| Content type | `Content-Type: application/json` |
| Prior state | The account already exists (see [sop-user-auth.md](sop-user-auth.md)). |

Always use HTTPS in production; codes and passwords travel in the request/response body.

## How it works

1. **Request.** Client calls `POST /auth/reset-password` with a `username`. The server
   looks the user up (case-insensitive), generates a random 6-character code from
   `A-Z a-z 0-9` using a cryptographically secure generator, and stores it in that user's
   `user_metadata` JSON under the key `reset_key`. The code is returned in the response.
2. **Confirm.** Client calls `PUT /auth/update-password` with `username`, `code`, and the
   new `password`. The server checks the password length, loads the stored `reset_key`,
   compares it to `code` with a constant-time comparison (case-sensitive), and on a match
   replaces the password hash and **deletes `reset_key`**.

Resulting behavior:

- **Single use.** A code stops working once it has been used.
- **Latest wins.** Calling `/reset-password` again overwrites the previous code, so older
  codes become invalid.
- **No expiry.** A code stays valid until it is used or replaced.
- **No attempt limit.** A wrong code does not invalidate the stored one.
- **No session or token** is issued. A successful update returns the user object, exactly
  like login; your app still owns session handling. Existing sessions in your app are not
  revoked by Backbone.

## Endpoints

### `POST /auth/reset-password`

```json
{ "username": "jane_doe" }
```

| Status | Meaning | Body |
| --- | --- | --- |
| 200 | Code generated and stored | `{"message": "Password reset code generated.", "reset_code": "aB3xY9"}` |
| 400 | `username` missing / not a string / malformed JSON | `{"error": "username is required."}` |
| 404 | No such user | `{"error": "User not found."}` |

### `PUT /auth/update-password`

```json
{ "username": "jane_doe", "code": "aB3xY9", "password": "new-secure-password-456" }
```

All three fields must be strings. `password` must be at least 8 characters (the same rule
as signup). `code` is case-sensitive.

| Status | Meaning | Body |
| --- | --- | --- |
| 200 | Password updated, code consumed | `{"user": {"id", "user_id", "username", "full_name", "created_at"}}` |
| 400 | A field is missing / not a string, or malformed JSON | `{"error": "username, password, and code are required."}` |
| 400 | Password shorter than 8 characters | `{"error": "password must be at least 8 characters."}` |
| 400 | No reset was requested (or the code was already used) | `{"error": "No password reset has been requested."}` |
| 400 | Code does not match | `{"error": "Invalid password reset code."}` |
| 404 | No such user | `{"error": "User not found."}` |

Checks run in this order: body shape, password length, user exists, a code is pending,
code matches. The success body is the same user object as login; it never includes the
password or hash.

## Security model

Because the code is handed back to the caller, **anyone who can reach `/auth/reset-password`
can reset any user's password** if they know the username. Treat these endpoints as
privileged:

- **Do not expose them directly to end users from a browser or mobile app** unless
  account takeover by username is acceptable for your use case.
- **Recommended pattern:** call both endpoints from your own backend only.
  1. Your backend verifies the user's identity out of band (email link, SMS OTP, security
     question, admin approval).
  2. Your backend calls `POST /auth/reset-password`, receives `reset_code`, and delivers
     it to the verified user through that channel. Never return `reset_code` to an
     unverified caller.
  3. The user submits the code and a new password to your backend, which forwards them to
     `PUT /auth/update-password`.
- Never log or persist `reset_code` or the new password.
- There is no rate limiting and the code space is about 5.7 x 10^10, so throttle attempts
  per username in your own backend.
- `404 User not found` reveals whether a username exists. If that matters, have your
  backend return a generic response to the end user.

## Procedure

1. **Verify the user** through your own mechanism (see above).
2. `POST /auth/reset-password` with the `username`. On `200`, read `reset_code`. On `404`,
   tell the user the account does not exist (or show a generic message). On `400`, fix the
   request.
3. **Deliver `reset_code`** to the verified user. Do not display it to unverified callers.
4. Collect the code and a new password from the user. Validate length (>= 8) client-side.
5. `PUT /auth/update-password` with `username`, `code`, `password`.
   - `200`: success. Store the returned `user` object and start a new session on your side.
     Invalidate any older sessions for that user in your own app.
   - `400` "Invalid password reset code": let the user retry; the stored code is still
     valid. Apply your own attempt limit.
   - `400` "No password reset has been requested": the code was already used or never
     issued; restart from step 2.
   - `400` password too short: ask for a longer password; the code is still valid.
6. The user can now log in with `POST /auth/login` using the new password.

## Example

```bash
# 1. Request a code (backend-to-backend)
curl -X POST "$URL/auth/reset-password" -H "Content-Type: application/json" \
  -d '{"username":"jane_doe"}'
# -> {"message":"Password reset code generated.","reset_code":"aB3xY9"}

# 2. Set the new password with the code
curl -X PUT "$URL/auth/update-password" -H "Content-Type: application/json" \
  -d '{"username":"jane_doe","code":"aB3xY9","password":"new-secure-password-456"}'

# 3. Log in with the new password
curl -X POST "$URL/auth/login" -H "Content-Type: application/json" \
  -d '{"username":"jane_doe","password":"new-secure-password-456"}'
```

## Client gotchas

- The code is case-sensitive; do not lowercase or trim-and-transform it beyond whitespace.
- `username` is matched case-insensitively, but the code is not.
- Requesting a new code invalidates the previous one. Do not let users trigger it
  repeatedly while they are still typing the earlier code.
- Codes never expire. If your product needs a time limit, enforce it in your backend
  (record when you issued the code and reject late submissions).
- Reset state lives in `user_metadata.reset_key`. `user_metadata` is not part of the user
  object returned by the API, so clients cannot read it back.
- Malformed JSON gives `400`, not `500`.

## Verification checklist

- [ ] `POST /auth/reset-password` for an existing user returns `200` with a 6-character `reset_code`.
- [ ] Unknown username returns `404` on both endpoints.
- [ ] `PUT /auth/update-password` with a wrong code returns `400` and the old password still works.
- [ ] With the correct code, it returns `200` with the user object and no password/hash fields.
- [ ] Login with the old password now returns `401`; login with the new one returns `200`.
- [ ] Reusing the same code returns `400` "No password reset has been requested."
- [ ] A password under 8 characters returns `400`.
- [ ] Your app never exposes `reset_code` to unverified callers and never logs it.
- [ ] No API key is sent to these endpoints.
