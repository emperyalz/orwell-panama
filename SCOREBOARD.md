# Shared Orwell scoreboard

Public page: https://orwell-panama.vercel.app/scoreboard

The production Convex `projectTasks` table is the shared status record. Its reactive query updates browsers as trusted internal writes change a task. The page does not accept public writes.

Use `scoreboard:setTask` internally to add or update a task. Keep its stable key, localized titles and details, status, icon and order. Completed tasks require verification evidence. Include a result URL when useful. Updating an existing task does not change its completion timestamp unless it is reopened.

`scoreboard:seed` adds only missing initial tasks. Deployments and repeated seeding do not reset progress. The JSON seed is bootstrap data, not the live status record.

Keep WORKLIST.md aligned for local reading. Voice questions and added requests do not remove previous work. Mark a task done only after delivery and relevant verification. Keep completed requests visible.

Design reference: Mobbin's Bonsai project task board, https://mobbin.com/screens/b9210f79-5ad5-402b-b72c-e4f2bfc24e78.
