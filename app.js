const express = require('express');
const app = express();
const mongoose = require("mongoose");

const userModel = require("./models/user");
const postModel = require("./models/post");

const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");

mongoose.connect("mongodb://127.0.0.1:27017/minP1");

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// middleware
function isLoggedIn(req, res, next) {
    if (!req.cookies.token) return res.redirect("/login");

    try {
        const data = jwt.verify(req.cookies.token, "secret");
        req.user = data;
        next();
    } catch (err) {
        res.send("Invalid token");
    }
}

// routes
app.get("/", (req, res) => res.render("index"));
app.get("/login", (req, res) => res.render("login"));

// register
app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);

    await userModel.create({ username, email, password: hash });
    res.redirect("/login");
});

// login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    let user = await userModel.findOne({ email });
    if (!user) return res.send("User not found");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.send("Wrong password");

    const token = jwt.sign(
        { email: user.email, userid: user._id },
        "secret"
    );

    res.cookie("token", token);
    res.redirect("/profile");
});

// profile
app.get("/profile", isLoggedIn, async (req, res) => {
    let user = await userModel
        .findOne({ email: req.user.email })
        .populate({
            path: "posts",
            populate: { path: "comments.user" }
        });

    res.render("profile", { user });
});

// create post
app.post("/post", isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({ email: req.user.email });

    let post = await postModel.create({
        user: user._id,
        content: req.body.content
    });

    user.posts.push(post._id);
    await user.save();

    res.redirect("/profile");
});

// like
app.get("/like/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findById(req.params.id);

    if (!post.likes) post.likes = [];

    let index = post.likes.indexOf(req.user.userid);

    if (index === -1) {
        post.likes.push(req.user.userid);
    } else {
        post.likes.splice(index, 1);
    }

    await post.save();
    res.redirect("/profile");
});

// delete
app.get("/delete/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findById(req.params.id);

    await userModel.findByIdAndUpdate(post.user, {
        $pull: { posts: post._id }
    });

    await postModel.findByIdAndDelete(req.params.id);

    res.redirect("/profile");
});

// edit page
app.get("/edit/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findById(req.params.id);
    res.render("edit", { post });
});

// update
app.post("/update/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findById(req.params.id);

    post.content = req.body.content;

    await post.save();
    res.redirect("/profile");
});

// comment
app.post("/comment/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findById(req.params.id);

    if (!post.comments) post.comments = [];

    post.comments.push({
        user: req.user.userid,
        text: req.body.text
    });

    await post.save();
    res.redirect("/profile");
});

// logout
app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});
console.log("All models loaded successfully");
app.listen(3000, () => console.log("Server running"));
