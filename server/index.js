require('dotenv').config();
const express = require("express");
const mongoose = require('mongoose');
mongoose.set('strictQuery', false);
const mongoString = process.env.DB_URL;
const bodyParser = require("body-parser");
const app = express();
const port = 8088;
const cors = require('cors');

app.use(cors({
    origin: '*'
}));

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect(mongoString);
const database = mongoose.connection;

database.on('error', (error) => {
    console.log(error);
})

database.once('connected', () => {
    console.log('Connected to DB');
})

require("./routes/main")(app);

app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.set("style", __dirname + "/assets/css");
app.set("scripts", __dirname + "/assets/js");
app.engine("html", require("ejs").renderFile);

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
