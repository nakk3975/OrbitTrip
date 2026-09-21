-- Apply using the migration/owner role. Runtime uses a separate restricted role.
CREATE SCHEMA IF NOT EXISTS orbittrip;
CREATE TABLE IF NOT EXISTS orbittrip.draft (
 owner_id text NOT NULL,
 country text NOT NULL CHECK (country IN ('JP','KR','FR','IT')),
 payload jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (owner_id,country)
);
ALTER TABLE orbittrip.draft ENABLE ROW LEVEL SECURITY;
CREATE POLICY draft_owner ON orbittrip.draft
 USING (owner_id=current_setting('app.owner_id',true))
 WITH CHECK (owner_id=current_setting('app.owner_id',true));
-- Provision a LOGIN role orbittrip_app with a generated password separately.
GRANT USAGE ON SCHEMA orbittrip TO orbittrip_app;
GRANT SELECT, INSERT, UPDATE ON orbittrip.draft TO orbittrip_app;
