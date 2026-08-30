```js
const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@libsql/client");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- База данных Turso ----------
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ---------- Инициализация базы ----------
async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      fullname TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      last_login TEXT,
      login_count INTEGER DEFAULT 0
    )
  `);

  console.log("База данных успешнo подключена.");
}

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Регистрация ----------
app.post("/api/register", async (req, res) => {
  const { email, fullname, username, password } = req.body;

  if (!email || !fullname || !username || !password) {
    return res.status(400).json({
      error: "Заполните все поля."
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: "Пароль должен содержать не менее 6 символов."
    });
  }

  try {
    // Проверяем email
    const existingEmail = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });

    if (existingEmail.rows.length > 0) {
      return res.status(409).json({
        error: "Этот email уже зарегистрирован."
      });
    }

    // Проверяем username
    const existingUsername = await db.execute({
      sql: "SELECT id FROM users WHERE username = ?",
      args: [username],
    });

    if (existingUsername.rows.length > 0) {
      return res.status(409).json({
        error: "Это имя пользователя уже занято."
      });
    }

    // Создаём пользователя
    const result = await db.execute({
      sql: `
        INSERT INTO users
        (email, fullname, username, password, login_count)
        VALUES (?, ?, ?, ?, 0)
      `,
      args: [email, fullname, username, password],
    });

    res.json({
      success: true,
      id: Number(result.lastInsertRowid),
      username: username
    });

  } catch (err) {
    console.error("Ошибка регистрации:", err);

    res.status(500).json({
      error: "Ошибка сервера. Попробуйте позже."
    });
  }
});

// ---------- Вход ----------
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "Введите имя пользователя/email и пароль."
    });
  }

  try {
    // Ищем пользователя
    const result = await db.execute({
      sql: `
        SELECT *
        FROM users
        WHERE (username = ? OR email = ?)
        AND password = ?
      `,
      args: [username, username, password],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Неверное имя пользователя или пароль!"
      });
    }

    const user = result.rows[0];

    // ---------- Сохраняем факт авторизации ----------
    await db.execute({
      sql: `
        UPDATE users
        SET
          last_login = datetime('now', 'localtime'),
          login_count = COALESCE(login_count, 0) + 1
        WHERE id = ?
      `,
      args: [user.id],
    });

    // Получаем обновлённые данные
    const updatedUser = await db.execute({
      sql: `
        SELECT
          id,
          email,
          fullname,
          username,
          created_at,
          last_login,
          login_count
        FROM users
        WHERE id = ?
      `,
      args: [user.id],
    });

    const savedUser = updatedUser.rows[0];

    res.json({
      success: true,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        fullname: savedUser.fullname,
        username: savedUser.username,
        created_at: savedUser.created_at,
        last_login: savedUser.last_login,
        login_count: savedUser.login_count
      }
    });

  } catch (err) {
    console.error("Ошибка авторизации:", err);

    res.status(500).json({
      error: "Ошибка сервера. Попробуйте позже."
    });
  }
});

// ---------- Просмотр всех пользователей ----------
app.get("/api/users", async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT
        id,
        email,
        fullname,
        username,
        password,
        created_at,
        last_login,
        login_count
      FROM users
      ORDER BY id DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("Ошибка получения пользователей:", err);

    res.status(500).json({
      error: "Ошибка сервера."
    });
  }
});

// ---------- Удаление пользователя ----------
app.delete("/api/users/:id", async (req, res) => {
  try {
    await db.execute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [req.params.id],
    });

    res.json({
      success: true
    });

  } catch (err) {
    console.error("Ошибка удаления:", err);

    res.status(500).json({
      error: "Ошибка сервера."
    });
  }
});

// ---------- Проверка сервера ----------
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Сервер работает"
  });
});

// ---------- Запуск ----------
initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Сервер запущен на порту ${PORT}`);
      console.log("База данных: Turso");
    });
  })
  .catch((err) => {
    console.error("Не удалось подключиться к базе данных:", err);
    process.exit(1);
  });
```
