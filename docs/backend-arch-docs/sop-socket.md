# SOP: Using the Socket.IO room API (`/socket`)

## Purpose

Real-time rooms over Socket.IO. Your app joins a named room, sees who else is in it, and
broadcasts JSON messages that every member of the room receives. Use it for live features
such as multiplayer games, shared boards, or presence.

There is no REST endpoint for rooms. Everything happens over a Socket.IO connection.

## Prerequisites

| Item | Value |
| --- | --- |
| Server URL | `https://coffeecoders.cc` |
| Namespace | `/socket` (part of the connection URL: `https://coffeecoders.cc/socket`) |
| Socket.IO `path` | `/flask_api/socket.io` |
| Transport | `websocket` only |
| Client library | Any Socket.IO v4 client (`socket.io-client` for JS, `python-socketio` for Python) |
| API key | None. Nothing to configure or send. |

Your web app must be served from `https://coffeecoders.cc`, `http://localhost:3000` or
`http://127.0.0.1:3000`; browsers on any other origin are refused. To use another origin,
ask the Backbone owner to add it.

### Client configuration

Keep the connection settings in your app's config rather than hard-coding them:

```dotenv
SOCKET_URL=https://coffeecoders.cc/socket
SOCKET_PATH=/flask_api/socket.io
```

(Use your framework's public-variable prefix if the value is read in the browser, e.g.
`NEXT_PUBLIC_SOCKET_URL`.) These are not secrets.

### Always use the websocket transport

Set `transports: ["websocket"]`. The default (HTTP long-polling first) fails
intermittently with `400 "Invalid session"` against the live service. Websocket-only
connects reliably.

## Events

All events are on the `/socket` namespace. Every field is required.

### Client → server

| Event | Payload | Effect |
| --- | --- | --- |
| `join` | `{"username": "<str>", "room_id": "<str>"}` | Puts you in the room (creating it if new). Everyone in the room, including you, receives `status`. |
| `leave` | `{"username": "<str>", "room_id": "<str>"}` | Takes you out of the room. Remaining members receive `status`. |
| `message` | `{"username": "<str>", "room_id": "<str>", "socket_data": "<JSON string>"}` | Everyone in the room, including you, receives `message`. |

`socket_data` must be a **string containing JSON** (`JSON.stringify(payload)` /
`json.dumps(payload)`), not an object. Any JSON value is allowed. Receivers get it
already parsed.

### Server → client

| Event | Payload |
| --- | --- |
| `status` | `{"users": ["alice", "bob"], "log": "bob joined room room-1"}` |
| `message` | `{"username": "alice", "room_id": "room-1", "socket_data": {"text": "hi"}, "log": "alice sent a message to room room-1"}` |

- `users` is the sorted, de-duplicated list of usernames currently in the room.
- `status` is also sent when someone's connection drops without calling `leave`
  (`"<user> disconnected from room <id>"`).

## Creating and using rooms

Rooms are implicit:

- **Create** a room by being the first to `join` a `room_id`. Any string works; there is
  no registration step and no list-rooms call.
- **Share** the `room_id` with other users yourself (a link, a game code, your own
  backend). Whoever joins the same string is in the same room.
- A room disappears when its last member leaves or disconnects.
- Use unguessable ids (e.g. a UUID) for private rooms and prefix them per project
  (`pictionary:<uuid>`) so projects do not collide. Anyone who knows an id can join it.
- One connection can be in several rooms. `username` is a display label you choose; it
  is not verified and need not be unique.

## Procedure

1. Connect to `SOCKET_URL` with `path: SOCKET_PATH` and `transports: ["websocket"]`.
2. Register `status` and `message` handlers **before** emitting `join`.
3. Emit `join`. The first `status` you receive confirms you are in and shows who is present.
4. Emit `message` with `socket_data` as a JSON string; handle incoming `message` events.
5. Emit `leave` when the user exits the room, then disconnect. If the tab just closes,
   the room is still notified.
6. After an automatic reconnect you are a new connection with no rooms: emit `join` again
   (do this inside the `connect` handler so it runs on every reconnect).

## Examples

### Browser / Node (`socket.io-client` v4)

```js
import { io } from "socket.io-client";

const socket = io("https://coffeecoders.cc/socket", {
  path: "/flask_api/socket.io",
  transports: ["websocket"],
});

const room_id = "pictionary:3f2a9c1e";
const username = "alice";

socket.on("status", ({ users, log }) => console.log(users, log));
socket.on("message", ({ username, socket_data }) => console.log(username, socket_data));

socket.on("connect", () => socket.emit("join", { username, room_id }));

function send(payload) {
  socket.emit("message", { username, room_id, socket_data: JSON.stringify(payload) });
}

function leave() {
  socket.emit("leave", { username, room_id });
  socket.disconnect();
}
```

### Python (`python-socketio` + `websocket-client`)

```python
import json, socketio

sio = socketio.Client()
sio.on("status", lambda d: print("status", d), namespace="/socket")
sio.on("message", lambda d: print("message", d), namespace="/socket")

sio.connect(
    "https://coffeecoders.cc",
    namespaces=["/socket"],
    socketio_path="flask_api/socket.io",
    transports=["websocket"],
)
sio.emit("join", {"username": "alice", "room_id": "room-1"}, namespace="/socket")
sio.emit("message", {"username": "alice", "room_id": "room-1",
                     "socket_data": json.dumps({"text": "hi"})}, namespace="/socket")
sio.disconnect()
```

Do not pass your own `Origin` header with `python-socketio`; the library sends one and a
duplicate is rejected with `400`.

## Error handling

The server sends **no error events**. Invalid input is silently ignored and the
connection stays open:

| What you sent | What happens |
| --- | --- |
| `socket_data` is not valid JSON | Message dropped, nobody receives it |
| `socket_data` is an object instead of a string | Message dropped |
| A required field is missing | Event dropped |
| Connection from a disallowed browser origin | Connection refused |
| Polling transport instead of websocket | Intermittent `400 Invalid session` |

Since you receive your own broadcasts, treat the echo of your `message` / `status` as the
delivery confirmation.

## Security notes

- Connections are **not authenticated**. Any page on an allowed origin can connect, use
  any `username`, join any `room_id`, and post to any `room_id`. Treat the room id as the
  only secret and do not send sensitive data through rooms.
- If you need identity, have your own backend hand out room ids to logged-in users (see
  [sop-user-auth.md](sop-user-auth.md)) and validate usernames in your app.

## Verification checklist

- [ ] Client connects to `https://coffeecoders.cc/socket` with path
      `/flask_api/socket.io` and `transports: ["websocket"]`.
- [ ] `status` and `message` handlers are registered before `join` is emitted.
- [ ] After two clients `join` the same `room_id`, both receive `status` with
      `users: [<a>, <b>]`.
- [ ] A `message` from one client (with `socket_data` as a JSON **string**) arrives at
      both clients with `socket_data` parsed.
- [ ] After `leave`, the other client receives `status` without that user.
- [ ] Closing one client without `leave` makes the other receive a
      `"<user> disconnected from room <id>"` `status`.
- [ ] `join` is re-emitted on every `connect` so reconnects rejoin the room.
