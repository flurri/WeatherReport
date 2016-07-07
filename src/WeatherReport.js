"use strict";

var Discord = require("discord.js");
var libxmljs = require("libxmljs");
var http = require("http");
var fs = require("fs");
var config = null;
var state = null;
var mainInterval = null;

// called every time we poll for RSS updates (see main)
function onRssPoll(botInstance, data) {
    var doc = libxmljs.parseXml(data);
    var title = doc.get("/rss/channel/item/title").text();
    var link = doc.get("/rss/channel/item/link").text();
    if (state != link) {
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
                                        cleanupAndQuit(botInstance, "Couldn't send message");
                                    } else {
                                        state = link;
                                        updateState();
                                    }
        });
    } else if (config.debug) console.log("Nothing new...");
}

function updateState() {
    if (state !== null) {
        fs.writeFileSync(config.state_dir + "/state", state);
    }
}

// quit cleanly-- save state info, properly logout, etc
function cleanupAndQuit(botInstance, errorInfo) {
    updateState();
    console.error("Quitting, reason: %s", errorInfo);
    botInstance.destroy((err) => {
        if (err) console.error(err);
    });
    process.exit();
}

function botReady(botInstance) {
    if (config.debug) console.log("Ready!");
    mainInterval = setInterval(() => {
        if (config.debug) console.log("Getting %s", config.feed_url);
        http.get(config.feed_url, (res) => {
            var pageData = "";
            res.setEncoding("utf8");
            res.on("data", (rssData) => {
                pageData += rssData;
            });
            res.on("end", () => {
                onRssPoll(botInstance, pageData);
            });
            res.on("error", (err) => {
                console.error(err);
                cleanupAndQuit(bot, "HTTP Error");
            });
        });
    }, config.polling_time*1000);
}

function getConfig() {
    var configStr = fs.readFileSync(__dirname + "/config.json");
    return JSON.parse(configStr);
}

function main() {
    var bot = new Discord.Client();
    config = getConfig();

    // make sure we exit cleanly on sigint (^C)
    process.on("SIGINT", () => {
       cleanupAndQuit(bot, "Caught interrupt signal");
    });

    // reload on SIGHUP
    process.on("SIGHUP", () => {
        console.log("Caught SIGHUP, reloading configuration...");
        try {
            var new_config = getConfig();
        } catch (e) {
            console.error("Can't load new config...");
            console.error(e);
            return;
        }
        if (bot.channels.has("name", new_config.channel) === false) {
            console.log("New channel #%s doesn't exist, keeping old config", new_config.channel);
        } else {
            config = new_config;
            if (mainInterval) {
                clearInterval(mainInterval);
                botReady(bot);
            }
        }
    });

    // get last known state (if any)
    try {
        if (fs.statSync(config.state_dir + "/state").isFile()) {
            state = fs.readFileSync(config.state_dir + "/state");
        }
    } catch (e) {
        if (config.debug) {
            if (e.code == 'ENOENT') {
                console.log("Could not find state file, this is usually ok");
            } else {
                console.log("Some file error is happening, code: %s", e.code);
            }
        }
    }

    bot.on("disconnected", () => {
        cleanupAndQuit(bot, "Disconnected");
    });

    bot.on("ready", () => {
        // make sure the channel even exists before we bother with anything else
        if (config.debug) console.log("Readying... checking channel...");
        var channelSet = false;
        if (bot.channels.has("name", config.channel) === false) {
            console.error("Channel #%s does not exist, entering wait mode...", config.channel);
            var channelWait = setInterval(() => {
                if (bot.channels.has("name", config.channel) === true) {
                    clearInterval(channelWait);
                    botReady(bot);
                } else {
                    console.error("Channel #%s does not exist, will poll again...", config.channel);
                }
            }, 10000);
        } else {
            botReady(bot);
        }
    });

    bot.loginWithToken(config.token);
}

if (require.main === module) {
    try {
        main();
    } catch (e) {
        console.error("UNEXPECTED ERROR");
        console.error(e);
        cleanupAndQuit();
    }
}
