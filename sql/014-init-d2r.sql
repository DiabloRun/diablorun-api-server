CREATE TABLE d2r_items (
  user_id integer REFERENCES users(id) NOT NULL,
  session_id integer NOT NULL,
  container item_container_type NOT NULL,
  slot item_slot_type NOT NULL,
  update_time integer NOT NULL,
  item_jpg bytea,
  description_jpg bytea,
  PRIMARY KEY (user_id, session_id, container, slot)
);
