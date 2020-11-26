import Binance from "binance-api-node";
import Logger from "./Logger";
import CONFIG from './config/config'

type TOrderSide = 'SELL' | 'BUY';

enum EBotMethod {
    UP = 'up',
    DOWN = 'down'
}

interface IBotConfig {
    pair: string;
    currency: string;
    candlePeriod: string;
    candleAmount: number;
    balancePercent: number;
    method: EBotMethod;
    buyMargin: number;
}

interface IOrder {
    orderId: number;
    price: number;
}

class Bot {
    private config: IBotConfig;

    private quantity: number;
    private buyPrice: number;
    private sellPrice: number;

    private initialBTCBalance: number;

    private buyOrder: IOrder;
    private sellOrder: IOrder;

    private publicBinance: any;
    private authBinance: any;

    private currencyPrice: number;
    private currencyStepSize: number;
    private currencyMinQty: number;
    private currencyMaxQty: number;
    private wsClean: Function;

    constructor() {
        this.publicBinance = Binance();
        this.authBinance = Binance({
            apiKey: CONFIG.BINANCE.API_KEY,
            apiSecret: CONFIG.BINANCE.API_SECRET,
            getTime: () => Date.now(),
        });
    }


    public async check(config: IBotConfig): Promise<void> {
        this.config = config;
        await this.refreshCurrencyInfo();
        await this.configure();
    }


    public async start(config: IBotConfig): Promise<void> {
        await Logger.log('- - - - - STARTING BOT - - - - -');
        await this.check(config);

        if (this.quantity <= 0 || this.buyPrice < 0 || this.sellPrice < 0 || this.buyPrice > this.sellPrice) {
            await Logger.log('Bot could not be executed with this configuration. Please review your BTC free balance too.');
            return;
        }

        // Start listening
        if (!this.wsClean) {
            this.wsClean = await this.authBinance.ws.user(async (message) => {
                if (message?.eventType === 'executionReport' && message?.orderStatus === 'FILLED' && message?.executionType === 'TRADE') {
                    if (message.orderId === this.buyOrder?.orderId) {
                        await Logger.log('BUY ORDER done!');
                        this.buyOrder = null;
                        const CBalance = await this.getUserBalance(this.config.currency);
                        this.quantity = CBalance >= this.quantity ? this.quantity : this.roundStep(CBalance);
                        this.sellOrder = await this.order('SELL', this.sellPrice);
                    }
                    if (message.orderId === this.sellOrder?.orderId) {
                        const BTCBalance = await this.getUserBalance('BTC');
                        await Logger.log('SELL ORDER done!');
                        await Logger.log('- - - - - DEAL ACCOMPLISHED! - - - - -');
                        await Logger.log('You have earned ' + (BTCBalance - this.initialBTCBalance) + ' BTC');
                        this.sellOrder = null;
                        await this.start(config);
                    }
                }
            });
        }
        this.buyOrder = await this.order('BUY', this.buyPrice);
    }

    public async stop(): Promise<void> {
        if (this.wsClean) {
            this.wsClean();
            this.wsClean = null;
        }
        if (this.buyOrder) {
            await this.cancelOrder(this.buyOrder.orderId);
            this.buyOrder = null;
        }
        if (this.sellOrder) {
            await this.cancelOrder(this.sellOrder.orderId);
            this.sellOrder = null;
        }
        await Logger.log('- - - - - - BOT STOPPED - - - - - -');
    }

    public isStarted(): boolean {
        return !!this.wsClean;
    }

    private async order(side: TOrderSide, price: number): Promise<IOrder> {
        try {
            const order = await this.authBinance.order({
                symbol: this.config.pair,
                type: 'LIMIT',
                side,
                quantity: this.quantity,
                price
            });
            await Logger.log(side + ' ORDER created.', 'price: ' + order.price + ' '
                + this.config.currency + ' quantity: ' + this.quantity + ' '
                + this.config.currency);
            return order;
        } catch (e) {
            await Logger.log(side + ' ORDER error', e);
        }
    }

    private async cancelOrder(orderId: number): Promise<void> {
        try {
            await this.authBinance.cancelOrder({
                symbol: this.config.pair,
                orderId
            });
        } catch (e) {
            console.error('Cancel order error', e);
        }
    }

    private async refreshCurrencyInfo(): Promise<void> {
        const {symbols} = await this.publicBinance.exchangeInfo();
        const pairSymbol = symbols.find(({symbol}) => symbol === this.config.pair);
        const lotSize = pairSymbol.filters.find(({filterType}) => filterType === 'LOT_SIZE');
        this.currencyStepSize = Number(lotSize.stepSize);
        this.currencyMinQty = Number(lotSize.minQty);
        this.currencyMaxQty = Number(lotSize.maxQty);
    }

    private async configure(): Promise<void> {
        const prices = await this.publicBinance.prices({symbol: this.config.pair});
        this.currencyPrice = Number(Object.keys(prices).map(k => prices[k])[0]);
        this.initialBTCBalance = await this.getUserBalance('BTC');
        const summary = await this.getCandleSummary();

        this.quantity = this.roundStep((this.initialBTCBalance * this.config.balancePercent / 100) / this.currencyPrice);
        this.buyPrice = this.config.method === EBotMethod.UP
            ? this.parseTo7Digits(this.currencyPrice - this.config.buyMargin)
            : this.parseTo7Digits(summary.low - this.config.buyMargin);
        this.sellPrice = this.config.method === EBotMethod.UP
            ? this.parseTo7Digits(summary.high)
            : this.parseTo7Digits(this.currencyPrice);

        await Logger.log('BOT CONFIGURATION', {
            quantity: this.quantity,
            buyPrice: this.buyPrice,
            sellPrice: this.sellPrice,
        });
    }

    private async getUserBalance(currency: string): Promise<number> {
        try {
            const {balances} = await this.authBinance.accountInfo();
            return Number(balances.find((b) => b.asset === currency).free);
        } catch (e) {
            console.error('Get user balance error', e);
        }
    }

    private async getCandleSummary(): Promise<any> {
        try {
            const candles = await this.publicBinance.candles({
                symbol: this.config.pair,
                interval: this.config.candlePeriod,
                limit: this.config.candleAmount
            });
            return candles.reduce((current, next) => ({
                high: current.high !== null && current.high > next.high ? current.high : Number(next.high),
                low: current.low !== null && current.low < next.low ? current.low : Number(next.low),
            }), {high: null, low: null});
        } catch (e) {
            console.error('Get candle summary error', e);
        }
    }

    private parseTo7Digits(price: number): number {
        return Math.round(price * 1000000) / 1000000
    }

    private roundStep(qty: number): number {
        if (Number.isInteger(qty)) return qty;
        const qtyString = qty.toFixed(16);
        const desiredDecimals = Math.max(String(this.currencyStepSize).indexOf('1') - 1, 0);
        const decimalIndex = qtyString.indexOf('.');
        return parseFloat(qtyString.slice(0, decimalIndex + desiredDecimals + 1));
    };

}

const bot = new Bot();
export default bot;
