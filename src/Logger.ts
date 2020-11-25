import telegram from "./Telegram";


class Logger{
    public static async log(message: string, context?: any): Promise<void>{
        console.log(message, context || '');
        if (typeof context === 'object') {
            context = JSON.stringify(context);
        }
        await telegram.send(message + (context ? ' ' + context : ''));
    }

}

export default Logger;
