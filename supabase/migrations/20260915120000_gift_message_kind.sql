-- Adds "gift" to the message_kind enum so a Blox / Spark Plus gift sent in a
-- DM can be shown as its own message bubble in the conversation, instead of
-- only moving balances silently in the background.
--
-- content stores a small JSON payload describing the gift, e.g.:
--   {"type":"blox","amount":500}
--   {"type":"spark_plus"}
alter type message_kind add value if not exists 'gift';
