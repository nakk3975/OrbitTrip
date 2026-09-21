-- Apply using the migration/owner role. Runtime uses a separate restricted role.
CREATE SCHEMA IF NOT EXISTS orbittrip;
CREATE TABLE IF NOT EXISTS orbittrip.draft (
 owner_id text NOT NULL,
 country text NOT NULL CHECK (country IN ('JP','KR','FR','IT','GB','ES','DE','CH','US','CA','AU','NZ','TH','VN','SG','TW')),
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

-- Public read-only catalog; seed contents are in data/catalog.json.
CREATE TABLE IF NOT EXISTS orbittrip.catalog_country(
 code text PRIMARY KEY,name text NOT NULL,sort_order integer NOT NULL DEFAULT 0,payload jsonb NOT NULL
);
GRANT SELECT ON orbittrip.catalog_country TO orbittrip_app;
