const express = require("express");
const app = express();
const fs = require("fs");
const crypto = require("crypto");
const chokidar = require("chokidar");
const http = require("http");
const { Server } = require("socket.io");
const { exec, spawn } = require("child_process");
const bodyParser = require("body-parser");
const path = require("path");
const indexFile = path.join(__dirname, "..", "frontend", "index.html");
const adminFile = path.join(__dirname, "..", "frontend", "admin.html");
const pathToLogFile = "/opt/minecraftserver/log";

const port = 80;

// Socket.io stuff
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("Ein Benutzer ist verbunden");
  fs.readFile(pathToLogFile, "utf8", (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    const words = data.split(" ");
    const lastWords = words.slice(-100).join(" ");
    socket.emit("initialData", lastWords);
  });

  const watcher = chokidar.watch(pathToLogFile, {
    persistent: true,
  });

  watcher.on("change", (path) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      socket.emit("consoleData", data);
    });
  });

  socket.on("sendCommand", (command) => {
    const screenSession = spawn("screen", [
      "-S",
      "minecraftserver",
      "-p",
      "0",
      "-X",
      "stuff",
      `${command}\n`,
    ]);
    screenSession.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });
  });
});

app.use(bodyParser.urlencoded({ extended: true }));
const passwordPath = path.join(__dirname, "pwd");
const PASSWORD = fs.readFileSync(passwordPath, "utf8").trim();
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Start Server
server.listen(port, () => {
  console.log("Server listening on Port: ", port);
  console.log();
});

// API Enpoints
// Login and Main Page

app.get("*", (req, res) => {
  res.redirect("/");
});

app.get("/", (req, res) => {
  res.sendFile("index.html");
});

app.post("/login", (req, res) => {
  const hashedPassword = crypto
    .createHash("sha512")
    .update(req.body.password)
    .digest("hex");
  if (hashedPassword === PASSWORD) {
    res.sendFile(adminFile);
  } else {
    res.redirect("/");
  }
});

// Start, Restart or Stop Server with systemd

app.post("/server/restart", (req, res) => {
  exec("systemctl restart minecraftserver", (error, stdout, stderr) => {
    if (error) {
      console.error(`Ausführungsfehler: ${error}`);
      return res.status(500).send("Service konnte nicht neugestartet werden");
    }
    res.send("Service erfolgreich neugestartet");
  });
});

app.post("/server/start", (req, res) => {
  exec("systemctl start minecraftserver", (error, stdout, stderr) => {
    if (error) {
      console.error(`Ausführungsfehler: ${error}`);
      return res.status(500).send("Service konnte nicht neugestartet werden");
    }
    res.send("Service erfolgreich neugestartet");
  });
});

app.post("/server/stop", (req, res) => {
  exec("systemctl stop minecraftserver", (error, stdout, stderr) => {
    if (error) {
      console.error(`Ausführungsfehler: ${error}`);
      return res.status(500).send("Service konnte nicht neugestartet werden");
    }
    res.send("Service erfolgreich neugestartet");
  });
});
