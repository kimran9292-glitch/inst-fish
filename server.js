const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = 3000;

// ---------- База данных ----------
const db = new Database(path.join(__dirname, "users.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    fullname TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Регистрация ----------
app.post("/api/register", (req, res) => {
  const { email, fullname, username, password } = req.body;

  if (!email || !fullname || !username || !password) {
    return res.status(400).json({ error: "Заполните все поля." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Пароль должен содержать не менее 6 символов." });
  }

  const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existingEmail) {
    return res.status(409).json({ error: "Этот email уже зарегистрирован." });
  }
  const existingUsername = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existingUsername) {
    return res.status(409).json({ error: "Это имя пользователя уже занято." });
  }

  const stmt = db.prepare(
    "INSERT INTO users (email, fullname, username, password) VALUES (?, ?, ?, ?)"
  );
  const info = stmt.run(email, fullname, username, password);

  res.json({ success: true, id: info.lastInsertRowid, username });
});

// ---------- Вход ----------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const user = db
    .prepare("SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?")
    .get(username, username, password);

  if (!user) {
    return res.status(401).json({ error: "Неверное имя пользователя или пароль." });
  }

  res.json({ success: true, user: { id: user.id, fullname: user.fullname, username: user.username } });
});

// ---------- Просмотр всех пользователей (для тебя, чтобы видеть введённые данные) ----------
app.get("/api/users", (req, res) => {
  const users = db.prepare("SELECT id, email, fullname, username, password, created_at FROM users ORDER BY id DESC").all();
  res.json(users);
});

// ---------- Удаление пользователя (по желанию, для очистки тестовых данных) ----------
app.delete("/api/users/:id", (req, res) => {
  db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
  console.log(`Страница входа/регистрации: http://localhost:${PORT}/index.html`);
  console.log(`Просмотр всех данных: http://localhost:${PORT}/admin.html`);
});
