ALTER TABLE users ADD race_id integer REFERENCES races(id);
CREATE INDEX users_race_id ON users USING btree(race_id);
