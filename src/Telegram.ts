import TelegramBot from 'node-telegram-bot-api';
import CONFIG from './config/config'
import bot from "./Bot";


class Telegram {
    private tb: TelegramBot;
    private chatId: number;

    constructor() {
        this.tb = new TelegramBot(CONFIG.TELEGRAM.BOT_TOKEN, {polling: true});
    }

    public send(message: string): void {
        if (this.chatId) {
            this.tb.sendMessage(this.chatId, message);
        } else {
            console.error('Could not send the message: no chat id!');
        }
    }

    public listen(): void {
        console.log('TELEGRAM listening...');

        // Telegram bot: /start 1m 10 50% up
        this.tb.onText(/\/start ([1-9][m|h|d|M]) ([1-9]\d?\d?) ([1-9]\d?\d?%) (up|down)/, async (message, match) => {
            if (!bot.isStarted()) {
                await bot.start({
                    pair: CONFIG.CURRENCY.PAIR,
                    currency: CONFIG.CURRENCY.NAME,
                    candlePeriod: match[1],
                    candleAmount: Number(match[2]),
                    balancePercent: Number(match[3].replace('%', '')),
                    method: match[4]
                });
            } else {
                this.send('Bot is already started!');
            }
        });

        // Telegram bot: /stop
        this.tb.onText(/\/stop/, async () => {
            if (bot.isStarted()) {
                await bot.stop();
            } else {
                this.send('Bot is already stopped!');
            }
        });

        // Telegram bot: /help
        this.tb.onText(/\/help/, async () => {
            this.send('Start example: /start 1m 10 50% up');
            this.send('1m is candle period, 10 is number of candles, 50% is the balance percentage, up/down is the method');
        });

        // All messages
        this.tb.on('message', (message) => {
            console.log('TELEGRAM - Message received: ', message.text);
            this.chatId = message.chat.id;
        });
    }
}

const telegram = new Telegram();
export default telegram;
