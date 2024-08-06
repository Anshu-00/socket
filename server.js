const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const connectDB = require("./config");
const User = require("./model");
require("dotenv").config();
const cors = require("cors");
const http = require("http");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Connect to the database
connectDB();
app.use(
  cors({
    origin: "https://socket-1-uc5x.onrender.com",
  })
);
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

let usersInRoom = {};

io.on("connection", (socket) => {
  socket.on("joinRoom", (user) => {
    const { emailId, name } = user;
    usersInRoom[emailId] = { emailId, socketId: socket.id, name };
    socket.user = { emailId, name };
    socket.join("live_users");
    io.to("live_users").emit("updateUserList", usersInRoom);
  });

  socket.on("disconnect", () => {
    if (socket.user) {
      usersInRoom[socket.user.emailId].socketId = null;
      io.to("live_users").emit("updateUserList", usersInRoom);
    }
  });
});



app.post("/api/users/:emailId", async (req, res) => {
  try {
    const emailId = req.params.emailId;

    req.body.emailId =emailId;

    const user = new User(req.body);
    await user.validate();
    await user.save();
    const userData = {
      emailId: user.emailId,
      name: `${user.firstName} ${user.lastName}`,
      socketId: null,
    };
    usersInRoom[user.emailId] = userData;
    io.emit("userAdded", userData);
    io.to("live_users").emit("updateUserList", usersInRoom);
    res.status(201).send(user);
  } catch (error) {
    const errorMessages = {};
    if (error.errors) {
      for (const key in error.errors) {
        errorMessages[key] = error.errors[key].message;
      }
    } else {
      errorMessages.general = error.message;
    }
    res
      .status(400)
      .send({ message: "Error saving user", errors: errorMessages });
  }
});
app.get("/api/users/:emailId", async (req, res) => {
  try {
    const emailId = req.params.emailId;

    // Validate that the emailId follows the correct pattern for a Gmail address
    //const emailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
     const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(emailId)) {
      return res.status(400).send({ message: "Invalid email address" });
    }

    const user = await User.findOne({ emailId: emailId });
    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.status(200).send(user);
  } catch (error) {
    res.status(400).send({ message: "Error fetching user", error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
