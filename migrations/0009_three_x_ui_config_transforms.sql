-- migrations/0009_three_x_ui_config_transforms.sql
-- Per-panel config transforms: rules that rewrite fields of a specific config
-- (targeted by its tag = inbound remark) for every user. v1 overrides the port.
-- Shape: [{"tag": "Port443 XHTTP", "port": 443}]
ALTER TABLE three_x_ui_servers
  ADD COLUMN config_transforms jsonb NOT NULL DEFAULT '[]'::jsonb;
