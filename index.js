const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  }, 
  log:[
    {description: {
      type: String,
      required: true
    },
    duration: {
      type: Number, 
      required: true
    },
    date: {
      type: Date, 
      required: true
    }}
  ]
});

const User = mongoose.model("User", userSchema);

// POST for api/users
app.post("/api/users", (req, res) => {
  const newUsername = req.body.username;
  if (!newUsername) {
    return res.status(400).json({ error: "Username is required" });
  }
  User.findOne({ username: newUsername })
    .then((existingUser) => {
      if (existingUser) {
        return res.json({
          username: existingUser.username,
          _id: existingUser._id,
        });
      }
      const newUser = new User({
        username: newUsername,
      });

      newUser
        .save()
        .then((user) => {
          res.json({
            username: user.username,
            _id: user._id,
          });
        })
        .catch((err) => {
          console.log("Error saving user", err);
          res.status(500).json({ error: "Internal server error" });
        });
    })
    .catch((err) => {
      console.log("Error finding user:", err);
      res.status(500).json({ error: "Internal server error" });
    });
});

// GET for api/users
app.get("/api/users", (req, res) => {
  User.find({}, "username _id")
    .then((users) => {
      res.json(users);
    })
    .catch((err) => {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Internal server error" });
    });
});

// POST for "/api/users/:_id/exercises"
app.post("/api/users/:_id/exercises", (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;
  const exerciseDate = date ? new Date(date) : new Date();

  User.findByIdAndUpdate(
    userId,
    {
      $push: {
        log: {
          description,
          duration: parseInt(duration),
          date: exerciseDate,
        },
      },
    },
    {
      new: true,
    })
    .then(updatedUser=>{
      if(!updatedUser){
        return res.status(404).json({error: "User not found"})
      }
      res.json({
        _id: updatedUser._id,
        username: updatedUser.username,
        date: exerciseDate.toDateString(),
        duration: Number(duration),
        description
      });
    })
    .catch(err=>{
      res.status(500).json({error: "Failed to add exercise"})
    });
});

// GET for /api/users/:_id/logs
// Output format: {"_id":"67739a8a535b190013dd50e0","username":"Krishna","count":0,"log":[]}
app.get("/api/users/:_id/logs", (req, res)=>{
  const userId = req.params._id;
  const {from, to, limit} = req.query;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid user ID format" });
  }

  User.findById(userId)
  .then((user)=>{
    
    if(!user){
      res.status(404).json({error: "User not found"});
    }
    console.log("User fetched:", user);
    let logs = Array.isArray(user.log) ? user.log : [];
    console.log("Initial logs:", logs); 
    
    if (from){
      const fromDate = new Date(from);
      if (isNaN(fromDate.getTime()))
      {
        return res.status(400).json({error: "Invalid from date format"})
      }
      logs = logs.filter((log)=> log.date && new Date(log.date)>=fromDate);
    }

    if (to) {
      const toDate = new Date(to);
      if (isNaN(toDate.getTime())) {
        return res.status(400).json({ error: "Invalid 'to' date format" });
      }
      logs = logs.filter((log) => log.date && new Date(log.date) <= toDate);
    }

    if(!isNaN(limit)){
      logs = logs.slice(0, parseInt(limit));
    }

    const formattedLogs = logs.map((log)=>({
      description: log.description || "No description",
      duration: typeof log.duration === "number" ? log.duration : 0,
      date: log.date ? new Date(log.date).toDateString() : "Invalid date"
    }));
    
    console.log("Formatted logs:", formattedLogs); 
    
    res.json({
      _id: user._id,
      username: user.username,
      count: logs.length,
      log: formattedLogs,
    })
  })
  .catch((err)=>{
    console.error("Error fetching logs:", err)
    res.status(500).json({error: "Failed to fetch logs"});
  })
})



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
