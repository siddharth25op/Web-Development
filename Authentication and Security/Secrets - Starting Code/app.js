const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose")
const env = require('dotenv').config()
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "SakuraIsNotTrash",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO_URL);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    name: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
        cb(null, {
            id: user.id,
            username: user.username,
            name: user.name
        });
    });
});

passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
        return cb(null, user);
    });
});

passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function(accessToken, refreshToken, profile, cb) {
        //console.log(profile["displayName"]);
        User.findOrCreate({
            googleId: profile.id,
            name: profile["displayName"]
        }, function(err, user) {
            return cb(err, user);
        });
    }
));


app.get("/", function(req, res) {
    res.render("home");
})

app.get("/auth/google", passport.authenticate("google", {
    scope: ["profile"]
}));

app.get("/auth/google/secrets", passport.authenticate("google", {
        failureRedirect: "/login"
    }),
    function(req, res) {
        res.redirect("/secrets");
    }
)

app.get("/login", function(req, res) {
    res.render("login");
})

app.get("/register", function(req, res) {
    res.render("register");
})

app.get("/secrets", async function(req, res) {
    const foundUser = await User.find({
        "secret": {
            $ne: null
        }
    });
    try {
        if (req.isAuthenticated()) {
            if (foundUser) {
                res.render("secrets", {
                    usersWithSecrets: foundUser
                });
            }
        } else {
            res.redirect("/login");
        }
    } catch (err) {
        console.log(err);
    }
});

app.get("/submit", function(req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", async function(req, res) {
    const submittedSecret = req.body.secret;
    const UserId = req.user.id;
    //console.log(UserId);

    const foundUser = await User.findById(UserId);
    try {
        if (foundUser) {
            foundUser.secret = submittedSecret;
            foundUser.save(
                res.redirect("/secrets")
            );
        }
    } catch (err) {
        console.log(err);
    }
});

app.get('/logout', function(req, res, next) {
    req.logout(function(err) {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

app.post("/register", function(req, res) {
    User.register({
        username: req.body.username,
        name: req.body.name
    }, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }
    });
});

app.post("/login", function(req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function(err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }
    });
});

app.listen(3000, function() {
    console.log("server is running on port 3000");
});