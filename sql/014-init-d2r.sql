CREATE TABLE d2r_items (
  id bigserial NOT NULL PRIMARY KEY,
  user_id integer REFERENCES users(id) NOT NULL,
  container item_container_type NOT NULL,
  slot item_slot_type NOT NULL,
  update_time integer NOT NULL,
  item_jpg bytea NOT NULL,
  description_jpg bytea NOT NULL
);

CREATE INDEX d2r_items_user_id_container_slot ON d2r_items USING btree (user_id, container, slot);
CREATE INDEX d2r_items_update_time ON d2r_items USING btree (update_time);
