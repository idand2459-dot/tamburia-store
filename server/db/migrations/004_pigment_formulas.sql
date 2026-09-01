CREATE TABLE IF NOT EXISTS pigment_formulas (
  id                  SERIAL PRIMARY KEY,
  color_code          VARCHAR(50)  NOT NULL UNIQUE,
  color_name_he       VARCHAR(100) NOT NULL,
  hex                 VARCHAR(7)   NOT NULL,
  ml_per_liter_light  INTEGER      NOT NULL DEFAULT 30,
  ml_per_liter_medium INTEGER      NOT NULL DEFAULT 60,
  ml_per_liter_dark   INTEGER      NOT NULL DEFAULT 120,
  sort_order          INTEGER      NOT NULL DEFAULT 0
);
