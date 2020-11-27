import TelegramBot from 'node-telegram-bot-api';
import CONFIG from './config/config'
import bot from "./Bot";


class Telegram {
    private tb: TelegramBot;
    private chatId: number;

    constructor() {
        this.tb = new TelegramBot(CONFIG.TELEGRAM.BOT_TOKEN, {polling: true});
    }

    public async send(message: string): Promise<void> {
        if (this.chatId) {
            await this.tb.sendMessage(this.chatId, message);
        } else {
            console.error('Could not send the message: no chat id!');
        }
    }

    public listen(): void {
        console.log('TELEGRAM listening...');

        this.tb.onText(/\/(start|check) ([1-9][m|h|d|M]) ([1-9]\d?\d?) ([1-9]\d?\d?%) (.+) (up|down)/, async (message, match) => {
            if (!bot.isStarted()) {
                const config = {
                    pair: CONFIG.CURRENCY.PAIR,
                    currency: CONFIG.CURRENCY.NAME,
                    candlePeriod: match[2],
                    candleAmount: Number(match[3]),
                    balancePercent: Number(match[4].replace('%', '')),
                    buyMargin: Number(match[5]),
                    method: match[6]
                };
                if (match[1] === 'start') {
                    await bot.start(config);
                } else {
                    await bot.check(config);
                }
            } else {
                this.send('Bot is already started!');
            }
        });

        this.tb.onText(/\/stop/, async () => {
            if (bot.isStarted()) {
                await bot.stop();
            } else {
                this.send('Bot is already stopped!');
            }
        });

        this.tb.onText(/\/help/, async () => {
            this.send('Start example: /start 1m 10 50% 0.001 up');
            this.send('1m is candle period, 10 is number of candles, 50% is the balance percentage, 0.001 is the buy margin, up/down is the method');
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
