ALTER TABLE profile ADD COLUMN wechat_qr_key TEXT;

CREATE TABLE media_objects_next (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('avatar', 'project-cover', 'resume', 'content-image', 'wechat-qr')),
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO media_objects_next (key, kind, content_type, size_bytes, created_at)
SELECT key, kind, content_type, size_bytes, created_at
FROM media_objects;

DROP TABLE media_objects;
ALTER TABLE media_objects_next RENAME TO media_objects;
