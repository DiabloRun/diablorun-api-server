CREATE TYPE monster_type AS ENUM ('animal', 'demon', 'undead');

CREATE TABLE monster_kills (
  character_id integer REFERENCES characters(id) NOT NULL,
  difficulty difficulty_type NOT NULL,
  class_id integer NOT NULL,
  type monster_type NOT NULL,
  flags integer NOT NULL,
  update_time integer NOT NULL,
  kills integer NOT NULL,
  PRIMARY KEY(character_id, difficulty, class_id, flags)
);

CREATE INDEX monster_kills_character_id ON monster_kills USING btree (character_id);
