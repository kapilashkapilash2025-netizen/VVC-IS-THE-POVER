# Supabase Realtime Production Integration

## Backend configured

- Supabase project `vdzyqwigzehfqrwysqrl` connected using its browser-safe publishable key.
- Shared `vvc_content`, `vvc_reactions` and `vvc_messages` tables created.
- Realtime publication enabled for content, reactions and moderation messages.
- Public `vvc-media` bucket created with a 10 MB per-file limit and image/PDF MIME allowlist.
- Production GitHub Pages Site URL and production/local callback allowlists configured.

## Security

- No Supabase secret or service-role key is stored in this repository.
- Row Level Security is enabled on every public table.
- Public visitors can read school content, submit pending messages and maintain one reaction record per browser identifier.
- Only the allowlisted authenticated administrator email can create, edit or delete school content and media, or moderate messages.
- Admin access uses a Supabase one-time email sign-in link; the previous hardcoded development password path is disabled.
- Visitor content remains sanitized and is not rendered through unsafe HTML.

## Shared features

- School updates and gallery posts synchronize across devices.
- Official notices, signature/seal images and attachments synchronize through cloud records and media URLs.
- Achievement posts, aggregate reactions and approved congratulation messages synchronize in realtime.
- Pending messages are visible to the authenticated administrator for approval/rejection.
- Scanner PDFs upload to shared cloud storage before attachment to a notice.
- Existing local data is backed up and migrated once when the authorized administrator first signs in.

## Free-tier considerations

- The implementation is designed for the Supabase Free plan and GitHub Pages.
- Supabase Free projects can pause after inactivity and have database, storage, egress and realtime quotas.
- A purchased custom domain is optional and is not required for shared realtime data.
- For high traffic, stronger anti-abuse controls, guaranteed uptime and formal backups, a paid production plan or server-side rate limiting is recommended.
