-- cssdeals_item_id values are 18-19 digit snowflake-like IDs, exceeding
-- Number.MAX_SAFE_INTEGER (2^53 ~ 9e15). When read via supabase-js/PostgREST
-- as bigint, they are serialized as JSON numbers and lose precision in JS
-- (rounded to the nearest representable float64). Different real item ids
-- can round to the same JS number, causing collisions in the Discord
-- notification dedup logic (sentSet in src/notifications/discord.ts) and
-- silently skipping the Discord post for ~30% of new products.
--
-- Fix: store as text, matching the string type already used at the
-- scraping source (src/scraper/cssdeals.ts). PostgREST returns text
-- columns as JSON strings, preserving exact precision in JS.
-- bigint::text preserves the exact integer value (no precision loss).

alter table produtos_dealspro
  alter column cssdeals_item_id type text using cssdeals_item_id::text;

alter table notification_logs
  alter column cssdeals_item_id type text using cssdeals_item_id::text;
