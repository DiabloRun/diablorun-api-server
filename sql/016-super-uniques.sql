CREATE TABLE super_uniques (
  character_id integer REFERENCES characters(id) NOT NULL,
  difficulty difficulty_type NOT NULL,
  monster_id integer NOT NULL,
  update_time integer NOT NULL,
  PRIMARY KEY(character_id, difficulty, monster_id)
);

CREATE INDEX super_uniques_character_id ON super_uniques USING btree (character_id);

ALTER TABLE race_rules ADD monster_id integer;
