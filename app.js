const express = require('express');
const app = express();
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
function isLoggedIn(req, res, next) {
    if (!req.cookies.token) {
        return res.redirect("/login");
    }
    try {
        const data = jwt.verify(req.cookies.token, "secret");
        req.user = data;
        next();
    } catch (err) {
        return res.send("Invalid token");
    }
}
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/login", (req, res) => {
    res.render("login");
});
app.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const hash = await bcrypt.hash(password, 10);

        await userModel.create({
            username,
            email,
            password: hash
        });

        res.send("User registered");
    } catch (err) {
        console.log(err);
        res.send("Error in register");
    }
});
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await userModel.findOne({ email });
        if (!user) return res.send("User not found");

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.send("Wrong password");

        const token = jwt.sign(
            { email: user.email, userid: user._id },
            "secret"
        );

        res.cookie("token", token);
        res.redirect("/profile");

    } catch (err) {
        console.log(err);
        res.send("Login error");
    }
});
app.get("/profile", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel
            .findOne({ email: req.user.email })
            .populate("posts");

        res.render("profile", { user });
    } catch (err) {
        console.log(err);
        res.send("Error loading profile");
    }
});
app.post("/post", isLoggedIn, async (req, res) => {
    try {
        let user = await userModel.findOne({ email: req.user.email });

        let { content } = req.body;

        let post = await postModel.create({
            user: user._id,
            content
        });

        user.posts.push(post._id);
        await user.save();

        res.redirect("/profile");
    } catch (err) {
        console.log(err);
        res.send("Error creating post");
    }
});
app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});

app.get("/like/:id",isLoggedIn,async(req,res)=>{
    let post=await postModel.findOne({_id:req.params.id}).populate("user");
    if(post.likes.indexOf(req.user.userid)===-1){
           post.likes.push(req.user.userid);
    }
    else{
        post.likes.splice(post.likes.indexOf(req.user.userid),1);

    }
    
    await post.save();
    res.redirect("/profile");
})
app.get("/edit/:id", isLoggedIn, async (req, res) => {
    try {
        let post = await postModel.findById(req.params.id);

        if (!post) {
            return res.send("Post not found");
        }

        res.render("edit", { post: post });
    } catch (err) {
        console.log(err);
        res.send("Error");
    }
});
app.post("/update/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({ _id: req.params.id });

    if (!post) return res.send("Post not found");

    post.content = req.body.content; // ✅ THIS is the actual edit

    await post.save();

    res.redirect("/profile");
});
app.get("/delete/:id", isLoggedIn, async (req, res) => {
    try {
        let post = await postModel.findById(req.params.id);

        if (!post) return res.send("Post not found");

        // remove post from user's posts array
        await userModel.findByIdAndUpdate(post.user, {
            $pull: { posts: post._id }
        });

        // delete post
        await postModel.findByIdAndDelete(req.params.id);

        res.redirect("/profile");
    } catch (err) {
        console.log(err);
        res.send("Error deleting post");
    }
});
app.listen(3000, () => {
    console.log("Server running on port 3000");
});