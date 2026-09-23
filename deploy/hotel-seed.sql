-- Run with the migration/owner role. Additive and rerunnable.
BEGIN;
CREATE TABLE IF NOT EXISTS orbittrip.hotel (
 id text PRIMARY KEY,
 country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
 payload jsonb NOT NULL CHECK (payload->>'id'=id AND payload->>'country'=country),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON orbittrip.hotel TO orbittrip_app;
INSERT INTO orbittrip.hotel(id,country,payload) VALUES ('kr-anook-sinchon','KR','{"id": "kr-anook-sinchon", "country": "KR", "city": "서울", "name": "아늑 호텔 신촌", "aliases": ["아늑", "아늑호텔", "Anook Hotel Seoul Sinchon", "Aank Hotel Sinchon"], "address": "서울특별시 서대문구 연세로2길 49", "lat": 37.5566193, "lng": 126.9394827, "sourceUrl": "https://aankhotel.com/sinchon", "addressSourceUrl": "https://www.airbnb.co.kr/rooms/1332913455556608713", "coordinateSource": "Geoapify / OpenStreetMap: 아늑호텔 신촌점; address matched", "verifiedAt": "2026-09-23"}'::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now();
INSERT INTO orbittrip.hotel(id,country,payload) VALUES ('jp-apa-shinjuku-kabukicho-tower','JP','{"id": "jp-apa-shinjuku-kabukicho-tower", "country": "JP", "city": "도쿄", "name": "APA 호텔 신주쿠 가부키초 타워", "aliases": ["APA", "아파", "아파호텔", "APA Hotel Shinjuku Kabukicho Tower", "アパホテル 新宿 歌舞伎町タワー"], "address": "東京都新宿区歌舞伎町1丁目20-2", "lat": 35.69574468, "lng": 139.7011858, "sourceUrl": "https://map.apahotel.com/map/252", "coordinateSource": "Official hotel map outbound location link", "verifiedAt": "2026-09-23"}'::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now();
INSERT INTO orbittrip.hotel(id,country,payload) VALUES ('jp-apa-shinjuku-kabukicho-chuo','JP','{"id": "jp-apa-shinjuku-kabukicho-chuo", "country": "JP", "city": "도쿄", "name": "APA 호텔 신주쿠 가부키초 주오", "aliases": ["APA", "아파", "아파호텔", "APA Hotel Shinjuku Kabukicho Chuo", "アパホテル 新宿 歌舞伎町中央"], "address": "東京都新宿区歌舞伎町2-26-5", "lat": 35.6955566, "lng": 139.7028271, "sourceUrl": "https://map.apahotel.com/map/527", "coordinateSource": "Official hotel map outbound location link", "verifiedAt": "2026-09-23"}'::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now();
INSERT INTO orbittrip.hotel(id,country,payload) VALUES ('jp-apa-nishishinjuku-tower','JP','{"id": "jp-apa-nishishinjuku-tower", "country": "JP", "city": "도쿄", "name": "APA 호텔 앤 리조트 니시신주쿠 고초메 에키마에 타워", "aliases": ["APA", "아파", "아파호텔", "APA Hotel Resort Nishishinjuku Gochome Eki Tower", "アパホテル＆リゾート 西新宿五丁目駅前タワー", "アパホテル＆リゾート 西新宿五丁目駅タワー"], "address": "東京都渋谷区本町3丁目14-1", "lat": 35.68968275, "lng": 139.6835724, "sourceUrl": "https://map.apahotel.com/map/424", "coordinateSource": "Official hotel map outbound location link", "verifiedAt": "2026-09-23"}'::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now();
COMMIT;
