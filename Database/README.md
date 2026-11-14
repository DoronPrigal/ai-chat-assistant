# Database

`db_export.sql` – a full MySQL export (`mysqldump`): the structure of the three tables and sample data.

- **Sample data:** the user `demo` (password `demo1234`) with 4 conversations – English with code, Hebrew, weather, and a generated image (its file is in `Backend/uploads`).
- **Import:** see "Sample data" in the main [README](../README.md). The file creates the database `chat_db` if needed and **replaces** its tables.
- **Tables:**
  - `users` – passwords are stored only as bcrypt hashes.
  - `conversations` – each conversation has an `id` (the conversation id) and a `user_id`.
  - `messages` – each message has a `role` (`user` / `assistant`), a `conversation_id`, and an optional `image_path`.

Without the import, the Backend creates empty tables on its first run (`CREATE TABLE IF NOT EXISTS`).
