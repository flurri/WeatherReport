"use strict";

var Discord = require("discord.js");
var libxmljs = require("libxmljs");
var http = require("http");
var fs = require("fs");
var config = require("./config.json");
var state = null;

// called every time we poll for RSS updates (see main)
function onRssPoll(botInstance, data) {
    var doc = libxmljs.parseXml(data);
    var title = doc.get("/rss/channel/item/title").text();
    var link = doc.get("/rss/channel/item/link").text();
    if (state !== link) {
        if (config.debug) console.log("New link: %s", link);
        if (config.sendMessage === false) {
            console.log("Would have sent: %s%s - %s", config.header, title, link);
            state = link;
            return;
        }
        botInstance.sendMessage(botInstance.channels.get("name", config.channel),
                                config.header + title + " - " + link, (err) => {
                                    if (err) {
                                        console.error(err);
                                        cleanupAndQuit(botInstance, state, "Couldn't send message");
                                    } else {
                                        state = link;
                                    }
        });
    } else if (config.debug) console.log("Nothing new...");
}

// quit cleanly-- save state info, properly logout, etc
function cleanupAndQuit(botInstance, state, errorInfo) {
    if (state !== null) {
        fs.writeFileSync(config.state_dir + "/state", state);
    }
    console.error("Quitting, reason: %s", errorInfo);
    botInstance.destroy((err) => {
        if (err) console.error(err);
    });
    process.exit();
}

function main() {
    var bot = new Discord.Client();

    // make sure we exit cleanly on sigint (^C)
    process.on("SIGINT", () => {
       cleanupAndQuit(bot, null, "Caught interrupt signal");
    });

    // get last known state (if any)
    try {
        if (fs.statSync(config.state_dir + "/state").isFile()) {
            state = fs.readFileSync(config.state_dir + "/state");
        }
    } catch (e) {
        if (config.debug) console.log(e);
    }

    bot.on("ready", function () {
        // make sure the channel even exists before we bother with anything else
        if (config.debug) console.log("Readying... checking channel...");
        if (bot.channels.has("name", config.channel) === false) {
            console.error("Channel #%s does not exist", config.channel);
            cleanupAndQuit(bot, null, "Channel error");
        }
        if (config.debug) console.log("Ready!");
        setInterval(() => {
            if (config.debug) console.log("Getting %s", config.feed_url);
            http.get(config.feed_url, (res) => {
                var pageData = "";
                res.setEncoding("utf8");
                res.on("data", (rssData) => {
                    pageData += rssData;
                });
                res.on("end", () => {
                    onRssPoll(bot, pageData);
                });
                res.on("error", (err) => {
                    console.error(err);
                    cleanupAndQuit(bot, state, "HTTP Error");
                });
            });
        }, config.polling_time*1000);
    });

    bot.loginWithToken(config.token);
}

if (require.main === module) {
    main();
}
