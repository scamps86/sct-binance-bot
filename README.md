## SCT Binance Bot

This is a simple Binance bot written in NodeJs that could be controlled trough a Telegram bot.
This bot considers the last N candles to calculate the buying and selling prices. 

By setting the method to "down", it sets a buy order as the lower price found in the candles and
the sell order to the current price.

By setting the method to "up", it sets a buy order to the current price and a sell order to the
higher price found in the candles.

You can configure the number of the last candles and their period.


#### Steps to get it working
* Create a Telegram bot
* Set your Binance, Telegram credentials and currency in `./config/config.ts` file.
* Execute in the terminal: `docker-compose up -d`
* To read the logs, type: `docker-compose logs -f`

#### Telegram bot options
* `/start 5m 10 20% up` candle period | number of candles | balance percent | method
* `/stop`
* `/check 5m 10 20% up`
* `/help`

