# Local reliability fixes

Run `npm test` for the scheduler, renderer, caret insertion, and isolated server
regressions. The server test uses temporary storage and a fake provider; it does
not read `.env`, existing chats, or deliver notifications.

For manual UI checks, run `node tests/preview.js` and visit
`http://127.0.0.1:3344`. This preview uses fake streamed replies and temporary
in-memory conversations. It does not test Letta or real push delivery.

Verified locally:

- Composer remains editable during a streamed reply and retains the next draft.
- Standalone custom emoji render at 80px; Unicode emoji at 48px.
- Failed push attempts retain their generated response for retry.
- One successful push endpoint completes a schedule; zero does not.
- Existing conversations longer than 50 messages are preserved when sending.
- Conversation switching is rejected while a reply is being generated.
- The final saved reply is sent back to the UI, including server-resolved GIFs.
- Sent GIF URLs are stored with the message and restored when reopening.
- Reactions toggle on/off and reject requests for a different active conversation.
- Lincoln's reaction tags are applied idempotently on the server.
- Multiple GIF search tags resolve without skipping adjacent tags.
- Letta receives current reaction metadata, reaction additions/removals, Arden's
  selected mood, supported output directives, and the actual custom emoji names
  with the next message. Reacting alone does not invoke the provider.

Deployment/device verification still required:

1. Deploy server and frontend together. Reload the installed app to update its
   service worker.
2. Confirm the host runs one continuously available instance with `/data` mounted
   persistently, as described in DEPLOY.md.
3. Open notification settings on the target device, enable notifications, and
   schedule a message a few minutes ahead. Close the app and confirm receipt.
4. Reopen the original conversation and confirm the scheduled reply appears once.
5. Check schedule status in Settings. `sent` means a push service accepted at
   least one delivery; it cannot prove the operating system displayed it.

Previously failed jobs can be retried explicitly in Settings. Old jobs already
marked sent are left alone to avoid unexpectedly replaying old reminders. Message
history removed by older versions cannot be recovered by this patch.
