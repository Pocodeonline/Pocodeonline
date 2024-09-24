const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');
const tunnel = require('tunnel');

const SILVER = '\x1b[38;5;231m';
const LIGHT_PINK = '\x1b[38;5;207m';
const PINK = '\x1b[38;5;13m';
const YELLOW = '\x1b[38;5;11m';
const GREEN = '\x1b[38;5;10m';
const RED = '\x1b[38;5;9m';
const LIGHT_BLUE = '\x1b[38;5;12m';
const RESET = '\x1b[0m';

class FreeDogsAPIClient {
    constructor() {
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Origin": "https://app.freedogs.bot",
            "Referer": "https://app.freedogs.bot/",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
        this.proxies = this.loadProxies();
    }

    loadProxies() {
        const proxyFile = path.join(__dirname, 'proxies.txt');
        if (!fs.existsSync(proxyFile)) {
            console.log(`${RED}Vui lòng thêm file proxies.txt${RESET}`);
            process.exit(1);
        }
        const proxyLines = fs.readFileSync(proxyFile, 'utf8').split('\n').filter(Boolean);
        return proxyLines.map(line => {
            const [ip, port, username, password] = line.split(':');
            return { server: `${ip}:${port}`, username, password };
        });
    }

    getProxy(index) {
        return this.proxies[index % this.proxies.length];
    }

    log(msg, type = 'info', proxy = null, accountIndex = null) {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Tài khoản ${YELLOW}${accountIndex + 1} ${PINK}IP${YELLOW}: ${LIGHT_PINK}${proxy ? proxy.server.split(':')[0] : ''} ${GREEN} ${msg}`);
                break;
            case 'custom':
                console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Tài khoản ${YELLOW}${accountIndex + 1} ${PINK}IP${YELLOW}: ${LIGHT_PINK}${proxy ? proxy.server.split(':')[0] : ''} ${GREEN} ${msg}`);
                break;        
            case 'error':
                console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Tài khoản ${YELLOW}${accountIndex + 1} ${PINK}IP${YELLOW}: ${LIGHT_PINK}${proxy ? proxy.server.split(':')[0] : ''} ${RED} ${msg}${RED}`);
                break;
            case 'warning':
                console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Tài khoản ${YELLOW}${accountIndex + 1} ${PINK}IP${YELLOW}: ${LIGHT_PINK}${proxy ? proxy.server.split(':')[0] : ''} ${GREEN} ${msg}`);
                break;
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] ${LIGHT_PINK} Vui Lòng chờ\x1b[38;5;11m ${i} ${LIGHT_PINK}giây để tiếp tục`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.log('', 'info'); 
    }

    createProxyAgent(proxy) {
        return tunnel.httpsOverHttp({
            proxy: {
                host: proxy.server.split(':')[0],
                port: proxy.server.split(':')[1],
                proxyAuth: `${proxy.username}:${proxy.password}`
            }
        });
    }

    async callAPI(initData, proxy) {
        const url = `https://api.freedogs.bot/miniapps/api/user/telegram_auth?invitationCode=oscKOfyL&initData=${initData}`;
        
        try {
            const agent = this.createProxyAgent(proxy);
            const response = await axios.post(url, {}, { 
                headers: this.headers,
                httpsAgent: agent,
                timeout: 10000
            });
            if (response.status === 200 && response.data.code === 0) {
                return { success: true, data: response.data.data };
            } else {
                return { success: false, error: response.data.msg };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    isExpired(token) {
        const [header, payload, sign] = token.split('.');
        const decodedPayload = Buffer.from(payload, 'base64').toString();
        
        try {
            const parsedPayload = JSON.parse(decodedPayload);
            const now = Math.floor(DateTime.now().toSeconds());
            
            if (parsedPayload.exp) {
                const expirationDate = DateTime.fromSeconds(parsedPayload.exp).toLocal();
                this.log(colors.cyan(`${expirationDate.toFormat('')}`));
                
                const isExpired = now > parsedPayload.exp;
                this.log(colors.cyan(` ${isExpired ? '' : ''}`));
                
                return isExpired;
            } else {
                this.log(colors.yellow(``));
                return false;
            }
        } catch (error) {
            this.log(colors.red(`Lỗi rồi`));
            return true;
        }
    }

    async getGameInfo(token, proxy, accountIndex) {
        const url = "https://api.freedogs.bot/miniapps/api/user_game_level/GetGameInfo?";
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        try {
            const agent = this.createProxyAgent(proxy);
            const response = await axios.get(url, { 
                headers,
                httpsAgent: agent,
                timeout: 10000
            });
            if (response.status === 200 && response.data.code === 0) {
                const data = response.data.data;
                this.log(`Số dư hiện tại${YELLOW}: ${LIGHT_BLUE} ${data.currentAmount}`, 'custom', proxy, accountIndex);
                this.log(`Số point có thể taptap ${YELLOW}: ${LIGHT_BLUE}${data.coinPoolLeft}${PINK}/${GREEN}${data.coinPoolLimit}`, 'custom', proxy, accountIndex);
                this.log(`Số lần click hôm nay${YELLOW}: ${LIGHT_BLUE}${data.userToDayNowClick}${PINK}/${GREEN}${data.userToDayMaxClick}`, 'custom', proxy, accountIndex);
                return { success: true, data: data };
            } else {
                return { success: false, error: response.data.msg };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    md5(input) {
        return crypto.createHash('md5').update(input).digest('hex');
    }

    async collectCoin(token, gameInfo, proxy, accountIndex) {
        const url = "https://api.freedogs.bot/miniapps/api/user_game/collectCoin";
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        let collectAmount = Math.min(gameInfo.coinPoolLeft, 10000 - gameInfo.userToDayNowClick);
        const collectSeqNo = Number(gameInfo.collectSeqNo);
        const hashCode = this.md5(collectAmount + String(collectSeqNo) + "7be2a16a82054ee58398c5edb7ac4a5a");

        const params = new URLSearchParams({
            collectAmount: collectAmount,
            hashCode: hashCode,
            collectSeqNo: collectSeqNo
        });

        try {
            const agent = this.createProxyAgent(proxy);
            const response = await axios.post(url, params, { 
                headers,
                httpsAgent: agent,
                timeout: 10000
            });
            if (response.status === 200 && response.data.code === 0) {
                this.log(`Đã nhận point thành công ${YELLOW}${collectAmount}`, 'success', proxy, accountIndex);
                return { success: true, data: response.data.data };
            } else {
                return { success: false, error: response.data.msg };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    
    async getTaskList(token, proxy) {
        const url = "https://api.freedogs.bot/miniapps/api/task/lists?";
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        try {
            const agent = this.createProxyAgent(proxy);
            const response = await axios.get(url, { 
                headers,
                httpsAgent: agent,
                timeout: 10000
            });
            if (response.status === 200 && response.data.code === 0) {
                const tasks = response.data.data.lists.filter(task => task.isFinish === 0);
                return { success: true, data: tasks };
            } else {
                return { success: false, error: response.data.msg };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async completeTask(token, taskId, proxy, accountIndex) {
        const url = `https://api.freedogs.bot/miniapps/api/task/finish_task?id=${taskId}`;
        const headers = { ...this.headers, "Authorization": `Bearer ${token}` };

        try {
            const agent = this.createProxyAgent(proxy);
            const response = await axios.post(url, {}, { 
                headers,
                httpsAgent: agent,
                timeout: 10000
            });
            if (response.status === 200 && response.data.code === 0) {
                return { success: true };
            } else {
                return { success: false, error: response.data.msg };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async processTasks(token, userId, proxy, accountIndex) {
        const taskListResult = await this.getTaskList(token, proxy);
        if (taskListResult.success) {
            for (const task of taskListResult.data) {
                this.log(`Đang thực hiện nhiệm vụ ${YELLOW}: ${task.name}`, 'info', proxy, accountIndex);
                const completeResult = await this.completeTask(token, task.id, proxy, accountIndex);
                if (completeResult.success) {
                    this.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Làm nhiệm vụ ${YELLOW}${task.name} ${GREEN}thành công ${PINK}-${task.rewardParty.toString().green} ${GREEN}point${RESET} `, 'success', proxy, accountIndex);
                } else {
                    this.log(`Không thể hoàn thành nhiệm vụ ${YELLOW}${task.name}`, 'error', proxy, accountIndex);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } else {
            this.log(`Không thể lấy danh sách nhiệm vụ cho tài khoản ${userId}`, 'error', proxy, accountIndex);
        }
    }

    async main() {
        const dataFile = path.join(__dirname, 'freedogs.txt');
        const tokenFile = path.join(__dirname, 'token.json');
        let tokens = {};

        if (fs.existsSync(tokenFile)) {
            tokens = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        }

        if (!fs.existsSync(dataFile)) {
            console.log(`${RED}Vui lòng thêm file freedogs.txt${RESET}`);
            process.exit(1);
        }

        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);
        
        const nonEmptyLines = data.length;
        console.log(`${SILVER}FRREEDOGS ${LIGHT_PINK}code by ${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] ${RESET}`);
        console.log(`${LIGHT_PINK}tele${YELLOW}: ${PINK}@${GREEN}witkoei ${RESET}`);
        console.log(`${GREEN}Hiện tại bạn có ${YELLOW}${nonEmptyLines}${GREEN} tài khoản`);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${YELLOW}(${GREEN}hoặc ${YELLOW}'all' ${GREEN}để chạy tất cả${YELLOW}): `, async (answer) => {
            let numAccountsToRun = nonEmptyLines;
            if (answer.toLowerCase() !== 'all') {
                numAccountsToRun = parseInt(answer, 10);
                if (isNaN(numAccountsToRun) || numAccountsToRun <= 0 || numAccountsToRun > nonEmptyLines) {
                    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED} Số lượng tài khoản không hợp lệ. Chạy tất cả tài khoản.`);
                    numAccountsToRun = nonEmptyLines;
                }
            }

            rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Bạn muốn chạy 1 lần xử lý bao nhiêu tài khoản? ví dụ ${YELLOW}( ${GREEN}30${YELLOW} ) ${YELLOW}: `, async (batchSizeAnswer) => {
                rl.close();
                let batchSize = parseInt(batchSizeAnswer, 10);
                if (isNaN(batchSize) || batchSize <= 0) {
                    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Số lượng tài khoản xử lý cùng lúc không hợp lệ. Chạy mặc định 30 tài khoản.`);
                    batchSize = 30;
                }

                const processBatch = async () => {
                    let currentIndex = 0;
                    while (true) {
                        const endIndex = Math.min(currentIndex + batchSize, numAccountsToRun);
                        const batchPromises = [];
                        for (let i = currentIndex; i < endIndex; i++) {
                            batchPromises.push(processAccount(i));
                        }
                        await Promise.all(batchPromises);
                        currentIndex = endIndex;
                        if (currentIndex >= numAccountsToRun) {
                            currentIndex = 0; // Reset to start again
                            await this.countdown(300);
                        }
                    }
                };

                const processAccount = async (index) => {
                    if (index >= numAccountsToRun) return;

                    const rawInitData = data[index];
                    const initData = rawInitData.replace(/&/g, '%26').replace(/=/g, '%3D');
                    const userDataStr = decodeURIComponent(initData.split('user%3D')[1].split('%26')[0]);
                    const userData = JSON.parse(decodeURIComponent(userDataStr));
                    const userId = userData.id;
                    const firstName = userData.first_name;
                    const proxy = this.getProxy(index);

                    let token = tokens[userId];
                    let needNewToken = !token || this.isExpired(token);

                    if (needNewToken) {
                        this.log(``, 'info', proxy, index);
                        const apiResult = await this.callAPI(initData, proxy);
                        
                        if (apiResult.success) {

                            tokens[userId] = apiResult.data.token;
                            token = apiResult.data.token;
                            fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2));

                        } else {

                            return;
                        }
                    }

                    const gameInfoResult = await this.getGameInfo(token, proxy, index + 1);
                    if (gameInfoResult.success) {
                        
                        if (gameInfoResult.data.coinPoolLeft > 0) {
                            await this.collectCoin(token, gameInfoResult.data, proxy, index + 1);
                        } else {
                            this.log(`Không có point để nhận cho tài khoản ${index + 1}`, 'warning', proxy, index);
                        }

                        await this.processTasks(token, userId, proxy, index + 1);
                    } else {
                        this.log(`Không thể lấy dữ liệu tài khoản ${index + 1}: ${gameInfoResult.error}`, 'error', proxy, index);
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000));
                };

                await processBatch();
            });
        });
    }
}

const client = new FreeDogsAPIClient();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});
