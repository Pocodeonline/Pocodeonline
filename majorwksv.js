const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
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

class GLaDOS {
    constructor() {
        this.authUrl = 'https://major.glados.app/api/auth/tg/';
        this.userInfoUrl = 'https://major.glados.app/api/users/';
        this.streakUrl = 'https://major.glados.app/api/user-visits/streak/';
        this.visitUrl = 'https://major.glados.app/api/user-visits/visit/';
        this.rouletteUrl = 'https://major.glados.app/api/roulette/';
        this.holdCoinsUrl = 'https://major.glados.app/api/bonuses/coins/';
        this.tasksUrl = 'https://major.glados.app/api/tasks/';
        this.swipeCoinUrl = 'https://major.glados.app/api/swipe_coin/';
        this.durovUrl = 'https://major.bot/api/durov/';
        this.durovPayloadUrl = 'https://raw.githubusercontent.com/Pocodeonline/Pocodeonline/main/giaiiimajorwitkoei.js';
        this.accountIndex = 0;
        this.proxies = this.loadProxies();
    }

    loadProxies() {
        const proxyFile = path.join(__dirname, 'proxies.txt');
        const proxyLines = fs.readFileSync(proxyFile, 'utf8').split('\n').filter(Boolean);
        return proxyLines.map(line => {
            const [ip, port, username, password] = line.split(':');
            return { server: `${ip}:${port}`, username, password };
        });
    }

    getProxy(index) {
        return this.proxies[index % this.proxies.length];
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

    headers(token = null) {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Content-Type': 'application/json',
            'Origin': 'https://major.glados.app/reward',
            'Referer': 'https://major.glados.app/',
            'Sec-Ch-Ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    async randomDelay() {
        const delay = Math.floor(Math.random() * (1000 - 500 + 1)) + 500; // Random delay between 500ms and 1000ms
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const proxy = this.getProxy(this.accountIndex);
        const accountPrefix = `${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Tài khoản ${YELLOW}${this.accountIndex + 1} ${PINK}IP${YELLOW}: ${LIGHT_PINK}${proxy.server.split(':')[0]} ${GREEN} `;
        let logMessage = '';
        
        switch(type) {
            case 'success':
                logMessage = `${accountPrefix} ${msg}`.green;
                break;
            case 'error':
                logMessage = `${accountPrefix} ${msg}`.red;
                break;
            case 'warning':
                logMessage = `${accountPrefix} ${msg}`.yellow;
                break;
            default:
                logMessage = `${accountPrefix} ${msg}`.blue;
        }
        
        console.log(`${logMessage}`);
        await this.randomDelay();
    }

    async logWithNewLine(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const proxy = this.getProxy(this.accountIndex);
        const accountPrefix = `${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Tài khoản ${YELLOW}${this.accountIndex + 1} ${PINK}IP${YELLOW}: ${LIGHT_PINK}${proxy.server.split(':')[0]} ${GREEN} `;
        let logMessage = '';
        
        switch(type) {
            case 'success':
                logMessage = `${accountPrefix}\n${msg}`.green;
                break;
            case 'error':
                logMessage = `${accountPrefix}\n${msg}`.red;
                break;
            case 'warning':
                logMessage = `${accountPrefix}\n${msg}`.yellow;
                break;
            default:
                logMessage = `${accountPrefix}\n${msg}`.blue;
        }
        
        console.log(`${timestamp} ${logMessage}`);
        await this.randomDelay();
    }

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            process.stdout.write(`\r ${RED}Chờ ${YELLOW}${i} ${RED}giây để chạy lại...${RESET}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async makeRequest(method, url, data = null, token = null, proxy = null) {
        const headers = this.headers(token);
        const config = {
            method,
            url,
            headers,
        };

        if (data) {
            config.data = data;
        }

        if (proxy) {
            config.httpsAgent = this.createProxyAgent(proxy);
        }

        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.response && error.response.data) {
                return error.response.data;
            }
            throw error;
        }
    }

    async authenticate(init_data, proxy) {
        const payload = { init_data };
        return this.makeRequest('post', this.authUrl, payload, null, proxy);
    }

    async getUserInfo(userId, token, proxy) {
        return this.makeRequest('get', `${this.userInfoUrl}${userId}/`, null, token, proxy);
    }

    async getStreak(token, proxy) {
        return this.makeRequest('get', this.streakUrl, null, token, proxy);
    }

    async postVisit(token, proxy) {
        return this.makeRequest('post', this.visitUrl, {}, token, proxy);
    }

    async spinRoulette(token, proxy) {
        return this.makeRequest('post', this.rouletteUrl, {}, token, proxy);
    }

    async holdCoins(token, proxy) {
        const coins = Math.floor(Math.random() * (950 - 900 + 1)) + 900;
        const payload = { coins };
        const result = await this.makeRequest('post', this.holdCoinsUrl, payload, token, proxy);
        if (result.success) {
            await this.log(`HOLD coin thành công ${YELLOW}${coins} ${GREEN}point`, 'success');
        } else if (result.detail && result.detail.blocked_until) {
            const blockedTime = DateTime.fromSeconds(result.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
            await this.logWithNewLine(`${LIGHT_PINK}HOLD coin không thành công chờ đến ${YELLOW}${blockedTime} ${LIGHT_PINK}nhé !`, 'warning');
        } else {
            await this.log(`HOLD coin không thành công`, 'error');
        }
        return result;
    }

    async swipeCoin(token, proxy) {
        const getResponse = await this.makeRequest('get', this.swipeCoinUrl, null, token, proxy);
        if (getResponse.success) {
            const coins = Math.floor(Math.random() * (1300 - 1000 + 1)) + 1000;
            const payload = { coins };
            const result = await this.makeRequest('post', this.swipeCoinUrl, payload, token, proxy);
            if (result.success) {
                await this.log(`Swipe coin thành công ${YELLOW}${coins} ${GREEN}point`, 'success');
            } else {
                await this.log(`Swipe coin không thành công`, 'error');
            }
            return result;
        } else if (getResponse.detail && getResponse.detail.blocked_until) {
            const blockedTime = DateTime.fromSeconds(getResponse.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
            await this.logWithNewLine(`${LIGHT_PINK}Swipe coin không thành công ${YELLOW} ${LIGHT_PINK}chờ đến ${YELLOW}${blockedTime}${LIGHT_PINK} nhé !`, 'warning');
        } else {
            await this.log(`Không thể lấy thông tin swipe coin`, 'error');
        }
        return getResponse;
    }

    async getDailyTasks(token, proxy) {
        const tasks = await this.makeRequest('get', `${this.tasksUrl}?is_daily=false`, null, token, proxy);
        if (Array.isArray(tasks)) {
            return tasks.map(task => ({ id: task.id, title: task.title }));
        } else {
            return null;
        }
    }

    async completeTask(token, task, proxy) {
        const payload = { task_id: task.id };
        const result = await this.makeRequest('post', this.tasksUrl, payload, token, proxy);
        if (result.is_completed) {
            await this.log(`Làm nhiệm vụ ${YELLOW}${task.id}: ${task.title}  ${GREEN}thành công!`, 'success');
        }
        return result;
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getDurovPayload() {
        try {
            const response = await axios.get(this.durovPayloadUrl);
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async handleDurovTask(token, proxy) {
        try {
            const getResult = await this.makeRequest('get', this.durovUrl, null, token, proxy);
            
            if (getResult.detail && getResult.detail.blocked_until) {
                const blockedTime = DateTime.fromSeconds(getResult.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
                await this.logWithNewLine(`${LIGHT_PINK}Giải Durov không thành công chờ đến ${YELLOW}${blockedTime} ${LIGHT_PINK}nhé !`, 'warning');
                return;
            }
            
            if (!getResult.success) {
                return;
            }

            const payloadData = await this.getDurovPayload();
            if (!payloadData) {
                return;
            }

            const today = DateTime.now().setZone('system');
            const payloadDate = DateTime.fromFormat(payloadData.date, 'dd/MM/yyyy');

            if (today.hasSame(payloadDate, 'day')) {
                const payload = payloadData.tasks[0];
                const postResult = await this.makeRequest('post', this.durovUrl, payload, token, proxy);
                
                if (postResult.correct && JSON.stringify(postResult.correct) === JSON.stringify(Object.values(payload))) {
                    await this.log('Giải Durov thành công', 'success');
                } else {
                    await this.log('Giải Durov không thành công', 'error');
                }
            } else if (today > payloadDate) {
                await this.log('');
            } else {
                await this.log('');
            }
        } catch (error) {
            await this.log(`Lỗi rồi`, 'error');
        }
    }

    async processAccount(accountData) {
        const { init_data, index } = accountData;
        this.accountIndex = index;
        const proxy = this.getProxy(index);

        try {
            const authResult = await this.authenticate(init_data, proxy);
            if (authResult) {
                const { access_token, user } = authResult;
                const { id, first_name } = user;

                await this.log(`Tài khoản ${first_name}`, 'info');

                const userInfo = await this.getUserInfo(id, access_token, proxy);
                if (userInfo) {
                    await this.log(`Số point đang có ${YELLOW} : ${userInfo.rating}`, 'success');
                }

                const streakInfo = await this.getStreak(access_token, proxy);
                if (streakInfo) {
                    await this.log(`Đã điểm danh thành công ngày ${YELLOW} ${streakInfo.streak} `, 'success');
                }

                const visitResult = await this.postVisit(access_token, proxy);
                if (visitResult) {
                    if (visitResult.is_increased) {

                    } else {
                        await this.log(`${LIGHT_PINK}Điểm danh ngày ${visitResult.streak} ${LIGHT_PINK}rồi...chờ mai bạn nhé`, 'warning');
                    }
                }

                const rouletteResult = await this.spinRoulette(access_token, proxy);
                if (rouletteResult) {
                    if (rouletteResult.rating_award > 0) {
                        await this.log(`Spin thành công${YELLOW} ${rouletteResult.rating_award} ${GREEN}point`, 'success');
                    } else if (rouletteResult.detail && rouletteResult.detail.blocked_until) {
                        const blockedTime = DateTime.fromSeconds(rouletteResult.detail.blocked_until).setZone('system').toLocaleString(DateTime.DATETIME_MED);
                        await this.logWithNewLine(`${LIGHT_PINK}Spin không thành công chờ ${YELLOW}${blockedTime} ${LIGHT_PINK}nhé !`, 'warning');
                    } else {
                        await this.log(`Kết quả spin không xác định`, 'error');
                    }
                }

                await this.handleDurovTask(access_token, proxy);
                await this.holdCoins(access_token, proxy);
                await this.swipeCoin(access_token, proxy);

                const tasks = await this.getDailyTasks(access_token, proxy);
                if (tasks) {
                    for (const task of tasks) {
                        await this.completeTask(access_token, task, proxy);
                        await this.sleep(1000);
                    }
                }
            } else {
                await this.log(`Không đọc được dữ liệu tài khoản`, 'error');
            }
        } catch (error) {
            await this.log(`Lỗi xử lý tài khoản`);
        }
    }

    async processBatch(batch) {
        return Promise.all(batch.map((account) => {
            return new Promise((resolve) => {
                const worker = new Worker(__filename, {
                    workerData: { account, index: account.index }
                });

                const timeout = setTimeout(() => {
                    worker.terminate();
                    this.log(`Tài khoản ${YELLOW} ${account.index + 1} ${RED}bị timeout sau 10 phút`, 'error');
                    resolve();
                }, 10 * 60 * 1000);

                worker.on('message', (message) => {
                    if (message === 'done') {
                        clearTimeout(timeout);
                        resolve();
                    }
                });

                worker.on('error', (error) => {
                    this.log(`Lỗi luồng cho tài khoản ${YELLOW}${account.index + 1}`, 'error');
                    clearTimeout(timeout);
                    resolve();
                });

                worker.on('exit', (code) => {
                    if (code !== 0) {
                        this.log(`Luồng ${YELLOW} ${account.index + 1} dừng `, 'error');
                    }
                    clearTimeout(timeout);
                    resolve();
                });
            });
        }));
    }

    async main() {
        const dataFile = 'major.txt';
        const data = fs.readFileSync(dataFile, 'utf8')
            .split('\n')
            .filter(Boolean)
            .map((line, index) => ({ init_data: line.trim(), index }));

        const nonEmptyLines = data.length;
        console.log(`${SILVER}MAJOR FULL ${LIGHT_PINK}code by ${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] ${RESET}`);
        console.log(`${LIGHT_PINK}tele${YELLOW}: ${PINK}tphuc_0 ${RESET}`);
        console.log(`${GREEN}Hiện tại bạn có ${YELLOW}${nonEmptyLines}${GREEN} tài khoản`);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${YELLOW}(${GREEN}hoặc ${YELLOW}'all' ${GREEN}để chạy tất cả${YELLOW}, ${RED}0 ${GREEN}để thoát${YELLOW}): `, async (answer) => {
            let numAccounts;
            if (answer.toLowerCase() === 'all') {
                numAccounts = data.length;
            } else if (!isNaN(answer)) {
                numAccounts = parseInt(answer, 20);
                if (numAccounts <= 0) {
                    rl.close();
                    return;
                }
                if (numAccounts > data.length) {
                    numAccounts = data.length;
                }
            } else {
                console.log(`${RED}Nhập không hợp lệ!`);
                rl.close();
                return;
            }

            rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Bạn muốn chạy 1 lần xử lý bao nhiêu tài khoản? ví dụ ${YELLOW}( ${GREEN}30${YELLOW}) ${YELLOW}: `, async (batchSizeAnswer) => {
                rl.close();
                let batchSize = parseInt(batchSizeAnswer, 20);
                if (isNaN(batchSize) || batchSize <= 0) {
                    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Số lượng tài khoản xử lý cùng lúc không hợp lệ. Chạy mặc định 30 tài khoản.`);
                    batchSize = 30;
                }

                let currentIndex = 0;
                const processBatch = async () => {
                    const endIndex = Math.min(currentIndex + batchSize, numAccounts);
                    const batch = data.slice(currentIndex, endIndex);
                    await this.processBatch(batch);
                    currentIndex = endIndex;
                    if (currentIndex < numAccounts) {
                        await processBatch();
                    }
                };

                while (true) {
                    await processBatch();
                    await this.waitWithCountdown(28850);
                }
            });
        });
    }
}

if (isMainThread) {
    const glados = new GLaDOS();
    glados.main().catch(async (err) => {
        await glados.log(`Lỗi rồi`, 'error');
        process.exit(1);
    });
} else {
    const glados = new GLaDOS();
    glados.processAccount(workerData.account)
        .then(() => {
            parentPort.postMessage('done');
        })
        .catch(async (error) => {
            await glados.log(`Luồng bị lỗi`, 'error');
            parentPort.postMessage('done');
        });
}
