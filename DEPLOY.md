# Vale House hosting

Vale House is packaged as a persistent Node service. It can run on any host that
supports a Docker container and a persistent volume.

## Required environment variables

Set these in the hosting provider's secret/environment settings:

```text
VALE_TOKEN=<a long random access key>
LETTA_URL=https://api.letta.com
LETTA_API_KEY=<your Letta API key>
LETTA_AGENT_ID=<your hosted agent ID>
```

Optional integrations:

```text
ANTHROPIC_API_KEY=
CLAUDE_MODEL=
GIPHY_API_KEY=
VALE_HUB_URL=
COMPANONION_URL=
VIDEO_MCP_URL=
GAMES_MCP_URL=
```

`PORT` is supplied by most hosts automatically. `VALE_DATA_DIR` defaults to
`/data` in the Docker image.

## Persistent storage

Attach one persistent volume at `/data`. This stores:

- `/data/chats` — Vale House chat history and reactions
- `/data/uploads` — images and voice notes uploaded through the chat
- `/data/scheduled-messages.json` — pending and completed scheduled messages
- `/data/push-subscriptions.json` — devices that opted into notifications
- `/data/push-vapid.json` — generated push-notification signing keys

Run exactly one application instance. The current chat, selected model,
presence, and mood are held in process memory, while chat files and uploads are
persisted on disk.

The `/data` volume is required for scheduled messages and push subscriptions to
survive a Railway redeploy. Push keys are generated automatically on first boot,
or can be supplied with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and
`VAPID_SUBJECT`.

On iPhone/iPad, install Vale House to the Home Screen before enabling push
notifications. Desktop and Android browsers can enable them directly in Settings.

## Domain

Point `house.valeverse.party` at the HTTPS domain supplied by the host. The
site and API are served from the same Node process, so no separate frontend
deployment or CORS configuration is required.

## Move the Letta agent

Before shutting down the local Letta server:

1. Export the current agent as an `.af` AgentFile from the Letta ADE.
2. Import that file into the hosted Letta API.
3. Copy the new hosted agent ID into `LETTA_AGENT_ID`.
4. Set `LETTA_URL=https://api.letta.com` and add the hosted `LETTA_API_KEY`.
5. Test a message before changing DNS or turning off the local computer.

The optional `npm run sync:letta-memory` command can copy the local
`persona.md` and `human.md` files into the configured hosted agent. It must be
run once while those local files are still available.

## First sign-in

The browser asks for `VALE_TOKEN` on first load and stores it only on that
device. The server no longer exposes the token through a public endpoint.

To sign out or change the token, remove the `vh-auth-token` entry from the
site's browser local storage.

## Local Docker check

Create a temporary environment file outside version control, then run:

```powershell
docker build -t vale-house .
docker run --rm -p 3333:3333 --env-file .env -v vale-house-data:/data vale-house
```

Open `http://localhost:3333`.
