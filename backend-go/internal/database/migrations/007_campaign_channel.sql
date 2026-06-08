-- ============================================================
-- CAMPAIGN CHANNEL — campaigns can be Email or SMS. Email uses
-- subject + body_html (delivered via Resend); SMS uses body_html
-- as the plain message text (delivered via Twilio to contacts'
-- phone numbers). Recipients can now be tracked without an email.
-- ============================================================
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email';

-- SMS recipients have a phone, not an email.
ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE campaign_recipients ALTER COLUMN email DROP NOT NULL;
