const Model = require('../models/model');

module.exports = function (app) {
    app.get("/", function (req, res) {
        // console.log("Ping");
        res.status(200).end();
    });

    // Store data received from the app

    app.post("/data", async (req, res) => {
        // App inventor is not generating correctly the JSON object.
        // This hack fixes the fact that App Inventor encloses 
        // arrays in double quotation marks
        let malformedJSON = JSON.stringify(req.body);
        // Accomodate for nodeJS versions older than v15
        malformedJSON = malformedJSON.replace(/\\/g, '').replace(/"\[/g, '[').replace(/\]"/g, ']');
        let correctedJSON = JSON.parse(malformedJSON);
        const data = new Model({
            timestamp: correctedJSON.timestamp,
            data: correctedJSON.data
        });
        await data.save().then((ans) => {
            res.status(201).send(correctedJSON.timestamp).end();
        }, (err) => {
            if (err.code === 11000) {
                // Reject repeated data gracefully
                res.status(201);
            } else {
                res.status(400);
            }
            res.send(correctedJSON.timestamp).end();
        });
    });

    // Get the data for all the events within a certain time period

    app.get("/data", async (req, res) => {
        let start = req.query.start;
        let stop = req.query.stop;
        let ans = [];
        Model.find({ timestamp: { $gte: start, $lte: stop } }, (err, answer) => {
            if (err) {
                res.status(400).end();
            } else {
                answer.forEach(event => {
                    ans.push({ timestamp: event.timestamp, data: event.data });
                });
                res.json({ events: ans });
            }
        });
    });

    // Get the timestamps for all the events within a certain time period

    app.get("/events", async (req, res) => {
        // console.log("/events");
        let start = req.query.start;
        let stop = req.query.stop;
        let ans = [];
        Model.find({ timestamp: { $gte: start, $lte: stop } }, (err, answer) => {
            if (err) {
                res.status(400).end();
            } else {
                answer.forEach(event => {
                    ans.push(event.timestamp);
                });
                res.json({ events: ans });
            }
        });
    });

    // Get the data of a specific event

    app.get("/event", async (req, res) => {
        let ts = req.query.timestamp;
        Model.findOne({ timestamp: ts }, (err, answer) => {
            if (err) {
                res.status(400).end();
            } else {
                res.json({ data: answer.data });
            }
        });
    });

    app.get("/medical", function (req, res) {
        res.render("dr.html");
    });

    // Serve JS scripts using regular expressions
    app.get(/(\/libs)?\/([a-zA-Z0-9]+)(.min)?\.js/, (req, res) => {
        res.sendFile(app.get("scripts") + req.url, (err) => {
            if (err) {
                console.log(err);
            }
        });
    });

    // Add support for CSS styling
    app.get("/style", (req, res) => {
        res.sendFile(app.get("style") + "/style.css", (err) => {
            if (err) {
                console.log(err);
            }
        });
    });
}
