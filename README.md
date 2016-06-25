# WeatherReport
Not actually involving the weather. Relatively simple Discord bot to automatically message a channel RSS updates for webcomics.

## Installation
WeatherReport depends on [discord.js](https://www.npmjs.com/package/discord.js) and [libxmljs](https://www.npmjs.com/package/libxmljs).

Make sure there is a `config.json` file in the same directory as `WeatherReport.js`. A template `config.json.sample` already exists in the directory.

## Configuration
`config.json.sample` contains all the necessary elements for configuration. More information on each is specified below.

`token`: Discord bot token.

`channel`: Discord server name, without the #. For example, if you want the bot to post to #general, use `"general"`.

`feed_url`: RSS feed url.

`polling_time`: Amount of time between RSS feed polls in seconds. `300` (5 minutes) is pretty safe.

`header`: Text prepended to the update information. For example, the default of `"New comic: "` would show `"New Comic: Comic Title - Comic URL"`.

`state_dir`: This holds the directory for state information if the bot is shut down.

`debug`: Set to `true` to show extra debugging information.

`sendMessage`: If `false`, the messages that would typically sent to the channel are instead sent to stdout.
