-- ============================================================
-- WatchParty: Migration v14 — Preset 3D avatars (no VRoid account needed)
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / ON CONFLICT DO NOTHING)
-- ============================================================
--
-- VRoid Hub's API only exposes a user's own uploaded models -- there's no
-- way to build "pick from a gallery, zero setup" out of that alone. This
-- adds a separate, always-available gallery of ready-to-use VRM characters
-- sourced from the Open Source Avatars registry (github.com/ToxSam/
-- open-source-avatars, "100Avatars" collection), which is explicitly
-- CC0-licensed (public domain -- free for any use, no attribution
-- required). Files are referenced directly from Arweave (permanent,
-- decentralized storage), not re-hosted, so there's nothing for us to
-- maintain.

CREATE TABLE IF NOT EXISTS preset_avatars (
  id            TEXT         PRIMARY KEY,
  name          TEXT         NOT NULL,
  thumbnail_url TEXT         NOT NULL,
  vrm_url       TEXT         NOT NULL,
  license       TEXT         NOT NULL DEFAULT 'CC0',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE preset_avatars ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS service_role_all ON preset_avatars;
  CREATE POLICY service_role_all ON preset_avatars FOR ALL USING (true) WITH CHECK (true);
END $$;

-- Which preset (if any) the user currently has selected as their 3D
-- avatar. Separate from vrm_model_id (v13, a VRoid Hub model id) -- a
-- user has either a VRoid Hub model selected or a preset selected, never
-- both meaning the same thing, so the frontend/backend track which
-- source is active by which of these two columns is non-null.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preset_avatar_id TEXT REFERENCES preset_avatars(id) ON DELETE SET NULL;

INSERT INTO preset_avatars (id, name, thumbnail_url, vrm_url) VALUES
  ('osa-27ccb24c-1fa1-4931-afed-e182b062c950', 'Devil', 'https://arweave.net/llxwUMPCfar71x4hLTU4f1-pcsYeGDUD4Gxm1dhWaDg', 'https://arweave.net/gfVzs1oH_aPaHVxpQK86HT_rqzyrFPOUKUrDJ30yprs'),
  ('osa-16aaf84a-3b1c-487f-9871-f9daabf4f504', 'Polydancer', 'https://arweave.net/SUPfb9dzBeLUUpJaEjGPGDkEE_6PylCs3_wU_Em69LM', 'https://arweave.net/jPOg-G0MPH55ZQmamFhT9f8cHn-hjeAQ0mRO5gWeKMQ'),
  ('osa-8eedc254-88d8-4320-9d96-73acbb7d61cc', 'Rose', 'https://arweave.net/MsKV9G8Dvzv1rOfU8aCLlxZ2PtzQ-J9ijkdkFU-ExPo', 'https://arweave.net/Ea1KXujzJatQgCFSMzGOzp_UtHqB1pyia--U3AtkMAY'),
  ('osa-56b866fc-c6e8-4635-8abb-b587c4c5b5dd', 'Robert', 'https://arweave.net/gaFPebQ9hSZDa_xNHkja8CH0Qde2y41L95VQTtroWNA', 'https://arweave.net/gwG7w4bY-A5c3R6A6GOz3xBCgbPvkFQmqPIDtvnNsYI'),
  ('osa-718c61cb-32e7-4292-b44c-0c4f6a903968', 'Bloody', 'https://arweave.net/sbTlKSCyltB4AqOU7W27QDKftwKgHgpSm-79nYKpHyc', 'https://arweave.net/VBFMTU6Y26re-WiEtl3FxV5wj0DzYUyjeYPyVrhYkic'),
  ('osa-8df2b84c-a9ad-41f7-b01a-e73fde7db568', 'Rabbit', 'https://arweave.net/wBqJHzcXuHV0NpFcbtcBB4O2kHqdVN0Zv2QO0jHNkdI', 'https://arweave.net/RymRtrmhHx_f9ZDvtvIQb1noTHvILdjoTg5G7L2DR-8'),
  ('osa-e82a8a1f-7dda-4fc3-9ff8-6d41e1648300', 'Eggplant', 'https://arweave.net/qNKlp6Up82OixiqIAJP5k2QZzWskhB735oMoABpunKI', 'https://arweave.net/64v_-jGcqFc4q_1ao0sjcXnhqkrtnjSSBotZoN2DDmc'),
  ('osa-98b2e431-9953-4ee7-9e0a-5ccc16bd85b6', 'Bullidan', 'https://arweave.net/Y8nxgSYUFZyANI9I2dcVJCs6Ag8q5CyCBgkOJsZQ_wA', 'https://arweave.net/uMDSdp_ENC77sR802M7hTFtigxLs0dRuzmkKlLEAa9U'),
  ('osa-3282fb07-86e6-4a10-b95b-bc85d886138c', 'Mikel', 'https://arweave.net/t_QkyGz6d1_mY312l7lt_-8VGL9QlkwmyPbvdmkpN8U', 'https://arweave.net/-eJyDjujQRvakRImdvulg-1dKQkPwMeQv-55IbKqLh4'),
  ('osa-c47d2c68-80ae-4131-802a-b1bf12f30398', 'CoolBanana', 'https://arweave.net/4X1LoMeFmjPx8gMrJn4NQv0U59CHKCiw1z7ZY4aYYHw', 'https://arweave.net/o4gWzn4PPzYo2KPm-wFXnvBC7KrN6N_R0NNfg1yPPeM'),
  ('osa-79d66c3e-9bee-4c39-a9d3-aeb96124805c', 'Skull', 'https://arweave.net/w2tx7t1-2zvmlx4Zk1004RE1WrP7TlB9YygDWIe9wYM', 'https://arweave.net/oiwKG3vW0dVdUNWaidyQS8ZOxN3V_Qrz8__FW-SBwLc'),
  ('osa-a082deff-650e-4f8e-97b1-e0ef305c9228', 'Observer', 'https://arweave.net/Wn_uMx09PDRvQ8JN69QHpQSCECTSOf-NASm72ZOm5fY', 'https://arweave.net/bDb0wMAxPHGbhirVjHi-7GF1QL6HrwD8SuKFEF5Sx2M'),
  ('osa-18db71ff-703c-4ebe-aace-7a57c592ac84', 'Nightmare', 'https://arweave.net/QmuZvdR4uJZhzb5LhMo0iShurvupDd9jottgugHvckI', 'https://arweave.net/aFMgc8_TJx3PxDiqE_5dS6lwqQusm1260WpmSwK3FCc'),
  ('osa-d5b25951-1564-411f-b441-5b5470687c40', 'Amazonas', 'https://arweave.net/AYDFnRtBRJSxZ_dYs23O53RvJfbhgnult2NrPBO_2kY', 'https://arweave.net/fqZDwToo41u1a7VnHhZX1BTK5lktXpK_H6H20MVbPqQ'),
  ('osa-a9556209-f3c4-4c34-909f-39aee67128e4', 'Cookieman', 'https://arweave.net/9_94Q1v77EHdwoSmtF7HazeIlPOekB9a1lBWSuwa_CU', 'https://arweave.net/x6i1T2qSesIvbRZnp6evtOW1awF8_m2oUH4VnYmW4gI'),
  ('osa-f53d6074-f71d-49b9-9f1f-26d7b71c7c9b', 'DinoKid', 'https://arweave.net/qRNTQjqGS9WiZUr-_dpKOBPyM9a6ucbBpRq_5yiz9lY', 'https://arweave.net/T1gkB95XKXAZl_VmU1ozg5Txm--o9nY0Nge3s8zNoBs'),
  ('osa-bd87c2d4-2dcd-435b-90a7-7617bb20f36d', 'Chad', 'https://arweave.net/CunA7AqeUljg1OBXtIURtIFVJIJFXGxz69xMZk8rh8s', 'https://arweave.net/s15TxeRcxamOZ0qDfjME1Bl2Ku7Vs4IQs8RthpxYjOQ'),
  ('osa-3a015e7a-58ff-4bb6-b51e-1dcd5359d392', 'Clown', 'https://arweave.net/ImbhmtcReMW_MVqqsPXfwLoAu5DceVuNdAeYKUxIgv0', 'https://arweave.net/pICFDWCb9lHSvhpBkoCXNdG3VngvYhvvi20lK51uwyA'),
  ('osa-1a26fefc-3e3c-4d37-8b0a-f97260da02a3', 'Chill', 'https://arweave.net/Gz2Lwo5DL3_6GttFePNwNwIZYzXnQXxKvcEM6bLIcKM', 'https://arweave.net/JCzmV7mgqDGNDu8YkdSMeJApOA09CCL2i71BqvJKCVs'),
  ('osa-4239c466-c3c1-4f97-ba56-a871f361ed84', 'Olivia', 'https://arweave.net/5wQlWAKsJjepBJacFSYjF72M0b5lbCOqWwDgoPZ8Hhw', 'https://arweave.net/MgsNlTetzAoVEC6E-lswj65vp7StkOZXXd5OjjqzYZI'),
  ('osa-560dae4f-0a0a-420c-9bb5-759ecd371ccd', 'Sticker', 'https://arweave.net/vv670fu9B42r-bTN8mYYXCe9agY6oJ6wxSwH8BB65rs', 'https://arweave.net/y9IXVbhB3QjHN8Iep329h0QEWDl7yMKfvH9p_QxkD0M'),
  ('osa-4917f167-2f2e-47c8-8be9-975d206ecd05', 'Zombie', 'https://arweave.net/6XkMKFXDh7B-C1GFe_oZOqK7p9fYX_SsQ6RVT6AgpJY', 'https://arweave.net/hM8199iDasTM_hlX6RykOToEiNHWxAUc8EegeTsjAuE'),
  ('osa-2492b104-ec88-4932-9326-2f5a8ad03bc8', 'Astrodisco', 'https://arweave.net/MSz3KAwK4h4pY7g8EMOqDNW6YmKgk34LvbtkZeaWHXk', 'https://arweave.net/uS4wvZn6sURMWJuwWzWnCqGaqDtZSiQQdTwci0f6hmM'),
  ('osa-66bbb692-ca42-4886-8c3e-a16f0f1d4a3b', 'Udom', 'https://arweave.net/pOm6lO7LfuIzVItozfPQn6JyZzIMfQOhL-2KSSE5DhQ', 'https://arweave.net/VZmDI9KtGRQQziDEURsw0a7cdkbPilVaAnMn3Eck0fg'),
  ('osa-dd705f7c-1abe-4f4d-8c8e-7668fe633d40', 'Fungus', 'https://arweave.net/s9K1QCTffDsj2beT54jzu8xpXjiDacyQN-eFfFFTjjs', 'https://arweave.net/8I0PA7uqsEBChnWB9dEmOXwLf1bnk2G-Z_AZZrlqwYc'),
  ('osa-a878f2be-2f1b-4ded-9b98-9362f729a41b', 'CoolChoco', 'https://arweave.net/HTcuOnRhzrGxLTxk4Y2RxAu4SEEGIr97kK6vUQphQow', 'https://arweave.net/hre4rgFOAWthLKTcgQgf5MRp5VcjFBYOofbsPhVqOew'),
  ('osa-e77c6b30-8cd4-45cc-ba6f-ae4bfb52511e', 'Polybot', 'https://arweave.net/PJ-ovenhR5xdQPv_Z1NkujIpPWjfD_7XENdf7yzHZ_0', 'https://arweave.net/DUR8v-IugXppdMBxPdE1rDO2dZCJJ7ZgBTXSRgPJFNo'),
  ('osa-40cf2651-f725-41a7-ade7-f94aa01aad3e', 'Ferk', 'https://arweave.net/jLYEkvUeqg3Cj5yDg_ygBmIBDkLsiJanjZLIq-9v-qE', 'https://arweave.net/-RwzCgnqAniy41JEYP-dGbgGnZJ7GFqEGwliEFHCHaI'),
  ('osa-f6c50bbf-b41a-470e-84b8-bb3a12efc902', 'Erika', 'https://arweave.net/C3HkA5xa9jXxSySEJCZEhtrFkrCyccD4RR25QfXIpyE', 'https://arweave.net/GZkfa0SNnrBWluRL_pXpakg7T3K3d4l87__wR4mD3UM'),
  ('osa-88fc50d9-4416-46e0-b839-cfd0a77209b1', 'Mummy', 'https://arweave.net/bgwEm3PB6yqpVQipatGEki8betYQi8RvKpQmfKpw730', 'https://arweave.net/JGv7n-LkirsjzCDI5iNnw8SLlpw5_Q7LPw0Ni8RZ8vk')
ON CONFLICT (id) DO NOTHING;
