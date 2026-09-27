-- Set your actual Payhip API key via the Dashboard → Settings → Publishing Channels,
-- or replace PAYHIP_API_KEY_HERE with the value from your Payhip account.
UPDATE publishing_channels
SET enabled = true,
    config  = '{"api_key":"PAYHIP_API_KEY_HERE"}'::jsonb
WHERE channel_type = 'PAYHIP';

SELECT id, name, channel_type, enabled, config
FROM publishing_channels
WHERE channel_type = 'PAYHIP';
