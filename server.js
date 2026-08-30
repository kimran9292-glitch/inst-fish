const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();

// Render использует свой PORT
const PORT = process.env.PORT || 3000;

// ---------- База данных ----------
const db = new Database(path.join(__dirname, "users.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Вход / создание пользователя ----------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  // Проверяем заполнение
  if (!username || !password) {
    return res.status(400).json({
      error: "Введите имя пользователя и пароль."
    });
  }

  // Ищем существующего пользователя
  let user = db
    .prepare(
      "SELECT * FROM users WHERE username = ? AND password = ?"
    )
    .get(username, password);

  // Если пользователь не найден —
  // создаём его при первом входе
  if (!user) {
    try {
      const info = db
        .prepare(
          "INSERT INTO users (username, password) VALUES (?, ?)"
        )
        .run(username, password);

      user = {
        id: info.lastInsertRowid,
        username: username
      };

      console.log(`Создан новый пользователь: ${username}`);

    } catch (error) {
      // Если username уже существует,
      // но пароль неправильный
      return res.status(401).json({
        error: "Неверное имя пользователя или пароль."
      });
    }
  }

  // Успешный вход
  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username
    }
  });
});

// ---------- Просмотр пользователей ----------
app.get("/api/users", (req, res) => {
  const users = db
    .prepare(
      "SELECT id, username, password, created_at FROM users ORDER BY id DESC"
    )
    .all();

  res.json(users);
});

// ---------- Удаление пользователя ----------
app.delete("/api/users/:id", (req, res) => {
  db
    .prepare("DELETE FROM users WHERE id = ?")
    .run(req.params.id);

  res.json({
    success: true
  });
});

// ---------- Запуск ----------
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
