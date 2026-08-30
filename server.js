app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  // ищем пользователя
  let user = db
    .prepare("SELECT * FROM users WHERE username = ? AND password = ?")
    .get(username, password);


  // если такого нет — создаём при первом входе
  if (!user) {

    const info = db.prepare(`
      INSERT INTO users (email, fullname, username, password)
      VALUES (?, ?, ?, ?)
    `).run(
      `${username}@local`,
      username,
      username,
      password
    );

    user = {
      id: info.lastInsertRowid,
      username,
      fullname: username
    };
  }


  res.json({
    success: true,
    user: {
      id: user.id,
      fullname: user.fullname,
      username: user.username
    }
  });
});
