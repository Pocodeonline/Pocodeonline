const fs = require('fs');
const axios = require('axios');
const path = require('path');
const colors = require('colors');
const tunnel = require('tunnel');
const readline = require('readline');
const { DateTime } = require('luxon');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { HttpsProxyAgent } = require('https-proxy-agent');

const SILVER = '\x1b[38;5;231m';
const LIGHT_PINK = '\x1b[38;5;207m';
const PINK = '\x1b[38;5;13m';
const YELLOW = '\x1b[38;5;11m';
const GREEN = '\x1b[38;5;10m';
const RED = '\x1b[38;5;9m';
const LIGHT_BLUE = '\x1b[38;5;12m';
const RESET = '\x1b[0m';

class YesCoinBot {
    constructor(accountIndex, account, proxy, config) {
        this.accountIndex = accountIndex;
        this.account = account;
        this.proxy = proxy;
        this.proxyIP = 'Unknown';
        this.token = null;
        this.config = config;
        this.timeout = 30000;
    }

    async log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const accountPrefix = `${GREEN}Tài khoản \x1b[38;5;11m${this.accountIndex + 1} `;
        const ipPrefix = this.proxyIP ? `${PINK}IP ${YELLOW}: ${LIGHT_PINK}${this.proxyIP}` : '[Unknown IP]';
        let logMessage = '';
        
        switch(type) {
            case 'success':
                logMessage = `${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} ${accountPrefix}${PINK}${ipPrefix} ${GREEN}${msg}`.green;
                break;
            case 'error':
                logMessage = `${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED} ${accountPrefix}${PINK}${ipPrefix}${RED}${msg}`.red;
                break;
            case 'warning':
                logMessage = `${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} ${accountPrefix}${PINK}${ipPrefix} ${GREEN}${msg}`.yellow;
                break;
            default:
                logMessage = `${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} ${accountPrefix}${PINK}${ipPrefix} ${GREEN}${msg}`.blue;
        }
        
        console.log(logMessage);
        await this.randomDelay();
    }

    headers(token) {
        return {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'https://www.yescoin.gold',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'referer': 'https://www.yescoin.gold/',
            'sec-ch-ua': '"Microsoft Edge";v="125", "Chromium";v="125", "Not.A/Brand";v="24", "Microsoft Edge WebView2";v="125"',
            'sec-Ch-Ua-Mobile': '?1',
            'sec-Ch-Ua-Platform': '"Android"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'token': token,
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36'
        };
    }

    formatLoginPayload(encodedData) {
        const decodedData = decodeURIComponent(encodedData);
        return { code: decodedData };
    }

    async login(encodedData, proxy) {
        const url = 'https://api-backend.yescoin.gold/user/login';
        const formattedPayload = this.formatLoginPayload(encodedData);
        const headers = {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'origin': 'https://www.yescoin.gold',
            'referer': 'https://www.yescoin.gold/',
            'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Microsoft Edge";v="128", "Microsoft Edge WebView2";v="128"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0'
        };

        try {
            const proxyAgent = this.createProxyAgent(proxy);
            const response = await axios.post(url, formattedPayload, { headers, httpsAgent: proxyAgent });
            if (response.data.code === 0) {
                const token = response.data.data.token;
                return token;
            } else {
                throw new Error(`Đăng nhập thất bại: ${response.data.message}`);
            }
        } catch (error) {
            throw new Error(`Đăng nhập thất bại: ${error.message}`);
        }
    }

    async saveToken(accountIndex, token) {
        let tokens = {};
        if (fs.existsSync('token.json')) {
            tokens = JSON.parse(fs.readFileSync('token.json', 'utf-8'));
        }
        tokens[accountIndex] = token;
        fs.writeFileSync('token.json', JSON.stringify(tokens, null, 2));
    }

    loadToken(accountIndex) {
        if (fs.existsSync('token.json')) {
            const tokens = JSON.parse(fs.readFileSync('token.json', 'utf-8'));
            return tokens[accountIndex];
        }
        return null;
    }

    async getOrRefreshToken(encodedData, proxy) {
        const savedToken = this.loadToken(this.accountIndex);
        if (savedToken) {
            this.token = savedToken;
            return this.token;
        }
        
        this.token = await this.login(encodedData, proxy);
        await this.saveToken(this.accountIndex, this.token);
        return this.token;
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = this.createProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', { httpsAgent: proxyAgent });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy ${error.message}`);
        }
    }

    createProxyAgent(proxy) {
        return tunnel.httpsOverHttp({
            proxy: {
                host: proxy.split(':')[0],
                port: proxy.split(':')[1],
                proxyAuth: `${proxy.split(':')[2]}:${proxy.split(':')[3]}`
            }
        });
    }

    async makeRequest(method, url, data = null, token, proxy) {
        const headers = this.headers(token);
        const proxyAgent = this.createProxyAgent(proxy);
        const config = {
            method,
            url,
            headers,
            httpsAgent: proxyAgent,
            timeout: this.timeout,
        };
        if (data) {
            config.data = data;
        }
        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error(`Yêu cầu hết thời gian sau ${YELLOW}${this.timeout}ms`);
            }
            throw new Error(`Yêu cầu không thành công ${error.message}`);
        }
    }

    async randomDelay() {
        const delay = Math.floor(Math.random() * 1000) + 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    async collectCoin(token, amount, proxy) {
        const url = 'https://api.yescoin.gold/game/collectCoin';
        try {
            const response = await this.makeRequest('post', url, amount, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getAccountInfo(token, proxy) {
        try {
            const url = 'https://api.yescoin.gold/account/getAccountInfo';
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getGameInfo(token, proxy) {
        try {
            const url = 'https://api.yescoin.gold/game/getGameInfo';
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async useSpecialBox(token, proxy) {
        const url = 'https://api.yescoin.gold/game/recoverSpecialBox';
        try {
            const response = await this.makeRequest('post', url, {}, token, proxy);
            if (response.code === 0) {
                await this.log('Đang mở rương...', 'success');
                return true;
            } else {
                await this.log('Mở rương không được...', 'error');
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    async getSpecialBoxInfo(token, proxy) {
        try {
            const url = 'https://api.yescoin.gold/game/getSpecialBoxInfo';
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getuser(token, proxy) {
        try {
            const url = 'https://api.yescoin.gold/account/getRankingList?index=1&pageSize=1&rankType=1&userLevel=1';
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.data.myUserNick) {
                return response.data.myUserNick;
            }
            return "no nickname";
        } catch (error) {
            return "no nickname";
        }
    }

    async collectFromSpecialBox(token, boxType, coinCount, proxy) {
        const url = 'https://api.yescoin.gold/game/collectSpecialBoxCoin';
        const data = { boxType, coinCount };
        try {
            const response = await this.makeRequest('post', url, data, token, proxy);
            if (response.code === 0) {
                if (response.data.collectStatus) {
                    await this.log(`Mở rương nhận được ${response.data.collectAmount} Coins`, 'success');
                    return { success: true, collectedAmount: response.data.collectAmount };
                } else {
                    return { success: true, collectedAmount: 0 };
                }
            } else {
                return { success: false, collectedAmount: 0 };
            }
        } catch (error) {
            return { success: false, collectedAmount: 0 };
        }
    }

    async attemptCollectSpecialBox(token, boxType, initialCoinCount, proxy) {
        let coinCount = initialCoinCount;
        while (coinCount > 0) {
            const result = await this.collectFromSpecialBox(token, boxType, coinCount, proxy);
            if (result.success) {
                return result.collectedAmount;
            }
            coinCount -= 20;
        }
        await this.log('Không thể thu thập rương!', 'error');
        return 0;
    }

    async getAccountBuildInfo(token, proxy) {
        try {
            const url = 'https://api.yescoin.gold/build/getAccountBuildInfo';
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async getSquadInfo(token, proxy) {
        const url = 'https://api.yescoin.gold/squad/mySquad';
        try {
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async joinSquad(token, squadLink, proxy) {
        const url = 'https://api.yescoin.gold/squad/joinSquad';
        const data = { squadTgLink: squadLink };
        try {
            const response = await this.makeRequest('post', url, data, token, proxy);
            if (response.code === 0) {
                return response;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async recoverCoinPool(token, proxy) {
        const url = 'https://api.yescoin.gold/game/recoverCoinPool';
        try {
            const response = await this.makeRequest('post', url, {}, token, proxy);
            if (response.code === 0) {
                await this.log('Phục hồi thành công...', 'success');
                return true;
            } else {
                await this.log('Phục hồi thất bại...', 'error');
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    async getTaskList(token, proxy) {
        const url = 'https://api.yescoin.gold/task/getCommonTaskList';
        try {
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                return response.data;
            } else {
                await this.log(`Không lấy được danh sách nhiệm vụ ${response.message}`, 'error');
                return null;
            }
        } catch (error) {
            await this.log('Error: ' + error.message, 'error');
            return null;
        }
    }

    async finishTask(token, taskId, proxy) {
        const url = 'https://api.yescoin.gold/task/finishTask';
        try {
            const response = await this.makeRequest('post', url, taskId, token, proxy);
            if (response.code === 0) {
                await this.log(`Làm nhiệm vụ ${YELLOW}${taskId} ${GREEN}thành công ${YELLOW}+ ${response.data.bonusAmount}`, 'success');
                return true;
            } else {
                await this.log(`Làm nhiệm vụ ${YELLOW}${taskId} ${RED}thất bại... ${response.message}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log(`Lỗi khi làm nhiệm vụ: ${error.message}`, 'error');
            return false;
        }
    }

    async processTasks(token, proxy) {
        const tasks = await this.getTaskList(token, proxy);
        if (tasks) {
            for (const task of tasks) {
                if (task.taskStatus === 0) {
                    await this.finishTask(token, task.taskId, proxy);
                }
            }
        }
    }

    async upgradeLevel(token, currentLevel, targetLevel, upgradeType, proxy) {
        const url = 'https://api.yescoin.gold/build/levelUp';
        const upgradeTypeName = upgradeType === '1' ? 'Multi Value' : 'Fill Rate';

        while (currentLevel < targetLevel) {
            try {
                const response = await this.makeRequest('post', url, upgradeType, token, proxy);
                if (response.code === 0) {
                    currentLevel++;
                    await this.log(`Nâng cấp ${YELLOW}${upgradeTypeName} ${GREEN}lên Lever ${YELLOW}${currentLevel} ${GREEN}thành công...`, 'success');
                } else {
                    await this.log(`Nâng cấp lever thất bại ${response.message}`, 'error');
                    break;
                }
            } catch (error) {
                await this.log('Lỗi nâng cấp: ' + error.message, 'error');
                break;
            }
        }

        if (currentLevel === targetLevel) {
            await this.log(`${YELLOW}${upgradeTypeName} ${GREEN}đang ở lever ${YELLOW} ${currentLevel}`, 'info');
        }
    }

    async handleSwipeBot(token, proxy) {
        const url = 'https://api.yescoin.gold/build/getAccountBuildInfo';
        try {
            const accountBuildInfo = await this.makeRequest('get', url, null, token, proxy);
            if (accountBuildInfo.code === 0) {
                const { swipeBotLevel, openSwipeBot } = accountBuildInfo.data;
                if (swipeBotLevel < 1) {
                    const upgradeUrl = 'https://api.yescoin.gold/build/levelUp';
                    const upgradeResponse = await this.makeRequest('post', upgradeUrl, 4, token, proxy);
                    if (upgradeResponse.code === 0) {
                        await this.log('Đã mua Bot thành công...', 'success');
                    } else {
                        await this.log('Mua Bot thất bại...', 'error');
                    }
                }
    
                if (swipeBotLevel >= 1 && !openSwipeBot) {
                    const toggleUrl = 'https://api.yescoin.gold/build/toggleSwipeBotSwitch';
                    const toggleResponse = await this.makeRequest('post', toggleUrl, true, token, proxy);
                    if (toggleResponse.code === 0) {
                        await this.log('Đã bật Bot thành công', 'success');
                    } else {
                        await this.log('Bật bot thất bại', 'error');
                    }
                }
    
                if (swipeBotLevel >= 1 && openSwipeBot) {
                    const offlineBonusUrl = 'https://api.yescoin.gold/game/getOfflineYesPacBonusInfo';
                    const offlineBonusInfo = await this.makeRequest('get', offlineBonusUrl, null, token, proxy);
                    if (offlineBonusInfo.code === 0 && offlineBonusInfo.data.length > 0) {
                        const claimUrl = 'https://api.yescoin.gold/game/claimOfflineBonus';
                        const claimData = {
                            id: offlineBonusInfo.data[0].transactionId,
                            createAt: Math.floor(Date.now() / 1000),
                            claimType: 1,
                            destination: ""
                        };
                        const claimResponse = await this.makeRequest('post', claimUrl, claimData, token, proxy);
                        if (claimResponse.code === 0) {
                            await this.log(`Claim thành công ${YELLOW} + ${claimResponse.data.collectAmount} ${GREEN}point`, 'success');
                        } else {
                            await this.log('Claim thất bại...', 'error');
                        }
                    }
                }
            } else {
                await this.log('Không thể lấy thông tin Bot...', 'error');
            }
        } catch (error) {
            await this.log(`Lỗi xử lý Bot ${error.message}`, 'error');
        }
    }

    async performTaskWithTimeout(task, taskName, timeoutMs = this.timeout) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`${YELLOW}${taskName} ${GREEN}hết thời gian sau ${YELLOW}${timeoutMs}ms`));
            }, timeoutMs);

            try {
                const result = await task();
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
	
    async main() {
        try {
            try {
                this.proxyIP = await this.performTaskWithTimeout(
                    () => this.checkProxyIP(this.proxy),
                    'Checking proxy IP',
                    10000
                );
                await this.log(``, 'info');
            } catch (error) {
                await this.log(`Lỗi kiểm tra IP proxy: ${error.message}`, 'error');
                return;
            }

            try {
                this.token = await this.performTaskWithTimeout(
                    () => this.getOrRefreshToken(this.account, this.proxy),
                    'Getting token',
                    20000
                );
            } catch (error) {
                await this.log(`Không thể lấy token: ${error.message}`, 'error');
                return;
            }

            await this.performTasks();
        } catch (error) {
            await this.log(`Lỗi rồi: ${error.message}`, 'error');
        } finally {
            if (!isMainThread) {
                parentPort.postMessage('taskComplete');
            }
        }
    }

    async checkAndClaimTaskBonus(token, proxy) {
        const url = 'https://api-backend.yescoin.gold/task/getFinishTaskBonusInfo';
        try {
            const response = await this.makeRequest('get', url, null, token, proxy);
            if (response.code === 0) {
                const bonusInfo = response.data;
                if (bonusInfo.commonTaskBonusStatus === 1) {
                    const claimUrl = 'https://api-backend.yescoin.gold/task/claimBonus';
                    const claimResponse = await this.makeRequest('post', claimUrl, 2, token, proxy);
                    if (claimResponse.code === 0) {
                        await this.log(`Làm Task thành công  ${YELLOW}+ ${claimResponse.data.bonusAmount}`, 'success');
                        return true;
                    } else {
                        await this.log(`Claim Task  thất bại ${claimResponse.message}`, 'error');
                        return false;
                    }
                } else {
                    await this.log('Chưa đủ điều kiện nhận Task...', 'info');
                    return false;
                }
            } else {
                await this.log(`Không lấy được thông tin task  ${response.message}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log(`Lỗi khi kiểm tra và claim Task  ${error.message}`, 'error');
            return false;
        }
    }

    async performTasks() {
        try {
            const nickname = await this.performTaskWithTimeout(
                () => this.getuser(this.token, this.proxy),
                'Getting user info',
                15000
            );
            await this.log(`Tài khoản: ${nickname}`, 'info');

            const squadInfo = await this.performTaskWithTimeout(
                () => this.getSquadInfo(this.token, this.proxy),
                'Getting squad info',
                15000
            );
            if (squadInfo && squadInfo.data.isJoinSquad) {
                const squadTitle = squadInfo.data.squadInfo.squadTitle;
                const squadMembers = squadInfo.data.squadInfo.squadMembers;
                await this.log(`Đội ${SILVER}${squadTitle} ${GREEN}đang có ${YELLOW} ${squadMembers} ${GREEN}member`, 'info');
            } else {
                await this.log(`Bạn không có đội tham gia đội đang tham gia đội ${YELLOW} WKOEI`, 'warning');
                const joinResult = await this.performTaskWithTimeout(
                    () => this.joinSquad(this.token, "t.me/airdropwkoei", this.proxy),
                    'Joining squad',
                    20000
                );
                if (joinResult) {
                    await this.log(` ${YELLOW}${nickname} tham gia đội thành công...`, 'success');
                } else {
                    await this.log(` ${YELLOW}${nickname} tham nhập đội thất bại...`, 'error');
                }
            }

            const balance = await this.performTaskWithTimeout(
                () => this.getAccountInfo(this.token, this.proxy),
                'Getting account info',
                15000
            );
            if (balance === null) {
                await this.log(`Số dư ${YELLOW}: ${RED}Không tìm được số dư`, 'error');
            } else {
                const currentAmount = balance.data.currentAmount.toLocaleString().replace(/,/g, '.');
                await this.log(`Số dư đang có ${YELLOW}: ${currentAmount}`, 'info');
            }

            const gameInfo = await this.performTaskWithTimeout(
                () => this.getAccountBuildInfo(this.token, this.proxy),
                'Getting game info',
                15000
            );
            if (gameInfo === null) {
                await this.log('Không lấy được dữ liệu game!', 'error');
            } else {
                const { specialBoxLeftRecoveryCount, coinPoolLeftRecoveryCount, singleCoinLevel, swipeBotLevel } = gameInfo.data;
                await this.log(`Booster Đang có ${YELLOW}: ${specialBoxLeftRecoveryCount}`, 'info');
                await this.log(`Năng lượng phục hồi ${YELLOW}: ${coinPoolLeftRecoveryCount}`, 'info');
                await this.log(`Lever Bot ${YELLOW}: ${swipeBotLevel}`, 'info');
                await this.log(`Coin Limit ${YELLOW}: ${singleCoinLevel}`, 'info');               
            }

            await this.performTaskWithTimeout(
                () => this.handleSwipeBot(this.token, this.proxy),
                'Handling SwipeBot',
                30000
            );

            if (this.config.TaskEnable) {
                await this.performTaskWithTimeout(
                    () => this.processTasks(this.token, this.proxy),
                    'Processing tasks',
                    60000
                );
            }

            await this.performTaskWithTimeout(
                () => this.checkAndClaimTaskBonus(this.token, this.proxy),
                'Checking and claiming task bonus',
                30000
            );

            if (this.config.upgradeMultiEnable && gameInfo) {
                await this.performTaskWithTimeout(
                    () => this.upgradeLevel(this.token, gameInfo.data.singleCoinValue, this.config.maxLevel, '1', this.proxy),
                    'Upgrading Multi',
                    60000
                );
            }

            if (this.config.upgradeFillEnable && gameInfo) {
                await this.performTaskWithTimeout(
                    () => this.upgradeLevel(this.token, gameInfo.data.coinPoolRecoverySpeed, this.config.maxLevel, '2', this.proxy),
                    'Upgrading Fill',
                    60000
                );
            }

            const collectInfo = await this.performTaskWithTimeout(
                () => this.getGameInfo(this.token, this.proxy),
                'Getting collect info',
                15000
            );
            if (collectInfo === null) {
                await this.log(`Không lấy được dữ liệu ${YELLOW}yescoin`, 'error');
            } else {
                const { singleCoinValue, coinPoolLeftCount } = collectInfo.data;
                await this.log(`Năng lượng còn lại : ${YELLOW}${coinPoolLeftCount}`, 'info');

                if (coinPoolLeftCount > 0) {
                    const amount = Math.floor(coinPoolLeftCount / singleCoinValue);
                    const collectResult = await this.performTaskWithTimeout(
                        () => this.collectCoin(this.token, amount, this.proxy),
                        'Collecting coins',
                        30000
                    );
                    if (collectResult && collectResult.code === 0) {
                        const collectedAmount = collectResult.data.collectAmount;
                        await this.log(`Lướt thành công ${YELLOW} + ${collectedAmount} ${GREEN}poins`, 'success');
                    } else {
                        await this.log('Lướt không thành công...', 'error');
                    }
                }
            }

            if (gameInfo && gameInfo.data.specialBoxLeftRecoveryCount > 0) {
                const useSpecialBoxResult = await this.performTaskWithTimeout(
                    () => this.useSpecialBox(this.token, this.proxy),
                    'Using special box',
                    30000
                );
                if (useSpecialBoxResult) {
                    const collectedAmount = await this.performTaskWithTimeout(
                        () => this.attemptCollectSpecialBox(this.token, 2, 240, this.proxy),
                        'Collecting from special box',
                        60000
                    );
                    await this.log(`Collected ${collectedAmount} from special box`, 'success');
                }
            }

            const updatedGameInfo = await this.performTaskWithTimeout(
                () => this.getAccountBuildInfo(this.token, this.proxy),
                'Getting updated game info',
                15000
            );
            if (updatedGameInfo && updatedGameInfo.data.coinPoolLeftRecoveryCount > 0) {
                const recoverResult = await this.performTaskWithTimeout(
                    () => this.recoverCoinPool(this.token, this.proxy),
                    'Recovering coin pool',
                    30000
                );
                if (recoverResult) {
                    const updatedCollectInfo = await this.performTaskWithTimeout(
                        () => this.getGameInfo(this.token, this.proxy),
                        'Getting updated collect info',
                        15000
                    );
                    if (updatedCollectInfo) {
                        const { coinPoolLeftCount, singleCoinValue } = updatedCollectInfo.data;
                        if (coinPoolLeftCount > 0) {
                            const amount = Math.floor(coinPoolLeftCount / singleCoinValue);
                            const collectResult = await this.performTaskWithTimeout(
                                () => this.collectCoin(this.token, amount, this.proxy),
                                'Collecting coins after recovery',
                                30000
                            );
                            if (collectResult && collectResult.code === 0) {
                                const collectedAmount = collectResult.data.collectAmount;
                                await this.log(`Lướt thành công khi phục hồi năng lượng xong ${YELLOW}+  ${collectedAmount} ${GREEN}poins`, 'success');
                            } else {
                                await this.log('Lướt không thành công sau khi phục hồi năng lượng...', 'error');
                            }
                        }
                    }
                }
            }

            const freeChestCollectedAmount = await this.performTaskWithTimeout(
                () => this.attemptCollectSpecialBox(this.token, 1, 200, this.proxy),
                'Collecting from free chest',
                30000
            );
            await this.log(`Số tiền khi làm rương xong ${YELLOW}+ ${freeChestCollectedAmount} ${GREEN}point`, 'success');

        } catch (error) {
            await this.log(`Không thể nhận point rương  ${error.message}`, 'error');
        }
    }
}

if (isMainThread) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = (question) => {
        return new Promise((resolve) => rl.question(question, resolve));
    };

    (async () => {
        const accounts = fs.readFileSync('data.txt', 'utf-8').replace(/\r/g, '').split('\n').filter(Boolean);
        const proxies = fs.readFileSync('proxy.txt', 'utf-8').replace(/\r/g, '').split('\n').filter(Boolean);

        console.log(`${SILVER}YESCOIN ${LIGHT_PINK}code by ${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] ${RESET}`);
        console.log(`${LIGHT_PINK}tele${YELLOW}: ${PINK}tphuc_0 ${RESET}`);
        console.log(`${GREEN}Hiện tại bạn có ${YELLOW}${accounts.length} ${GREEN}tài khoản.`);

        const TaskEnable = (await askQuestion(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Bạn muốn TaskEnable không? ${YELLOW}(${GREEN}y${SILVER}/${GREEN}n${YELLOW}): `)).toLowerCase() === 'y';
        const upgradeMultiEnable = (await askQuestion(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Bạn muốn upgradeMultiEnable không? ${YELLOW}(${GREEN}y${SILVER}/${GREEN}n${YELLOW}): `)).toLowerCase() === 'y';
        const upgradeFillEnable = (await askQuestion(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Bạn muốn upgradeFillEnable không? ${YELLOW}(${GREEN}y${SILVER}/${GREEN}n${YELLOW}): `)).toLowerCase() === 'y';
        const maxLevel = parseInt(await askQuestion(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Bạn muốn chạy Level cho tài khoản bao nhiêu? max ${YELLOW}(10${YELLOW}): `), 10);

        rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lượng tài khoản muốn  chạy ${YELLOW}(${GREEN}hoặc ${YELLOW}'all' ${GREEN}để chạy tất cả${YELLOW}, ${RED}0 ${GREEN}để thoát${YELLOW}): `, async (answer) => {
            let numAccounts;
            if (answer.toLowerCase() === 'all') {
                numAccounts = accounts.length;
            } else if (!isNaN(answer)) {
                numAccounts = parseInt(answer, 10);
                if (numAccounts <= 0) {
                    rl.close();
                    return;
                }
                if (numAccounts > accounts.length) {
                    numAccounts = accounts.length;
                }
            } else {
                console.log(`Nhập không hợp lệ!`);
                rl.close();
                return;
            }

            rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Bạn muốn chạy 1 lần xử lý bao nhiêu tài khoản? ví dụ ${YELLOW}(${GREEN}30${YELLOW}): `, async (batchSizeAnswer) => {
                rl.close();
                let batchSize = parseInt(batchSizeAnswer);
                if (isNaN(batchSize) || batchSize <= 0) {
                    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED} Số lượng tài khoản xử lý cùng lúc không hợp lệ. Chạy mặc định 30 tài khoản.`);
                    batchSize = 30;
                }

                const config = {
                    TaskEnable,
                    upgradeMultiEnable,
                    upgradeFillEnable,
                    maxLevel
                };

                const numThreads = Math.min(batchSize);
                let activeWorkers = 0;

                async function processCycle() {
                    console.log('Đã dùng thì đừng sợ, đã sợ thì đừng dùng...'.magenta);
                    let accountQueue = [...accounts];

                    function startWorker() {
                        if (accountQueue.length === 0) {
                            if (activeWorkers === 0) {
                                console.log(`Hoàn thành tất cả tài khoản tool ${SILVER} YESCOIN`);
                                let remainingTime = 11000;
                                const countdownInterval = setInterval(() => {
                                    process.stdout.clearLine();
                                    process.stdout.cursorTo(0);
                                    process.stdout.write(`${colors.yellow('[ ')}${colors.white('WIT KOEI')}${colors.yellow(' ]')} ${colors.magenta('Vui Lòng chờ')}${colors.yellow(` ${remainingTime} `)}${colors.magenta('giây để tiếp tục')}`);
                                    remainingTime--;
                                    if (remainingTime < 0) {
                                        clearInterval(countdownInterval);
                                        console.log(`\n${LIGHT_BLUE}Bắt đầu chạy lại...`);
                                        processCycle();
                                    }
                                }, 1000);
                            }
                            return;
                        }

                        const accountIndex = accounts.length - accountQueue.length;
                        const account = accountQueue.shift();
                        const proxy = proxies[accountIndex % proxies.length];

                        activeWorkers++;

                        const worker = new Worker(__filename, {
                            workerData: {
                                accountIndex: accountIndex,
                                account: account,
                                proxy: proxy,
                                config: config
                            }
                        });

                        worker.on('message', (message) => {
                            if (message === 'taskComplete') {
                                worker.terminate();
                            }
                        });

                        worker.on('error', (error) => {
                            console.error(`Worker error: ${error}`.red);
                            activeWorkers--;
                            startWorker();
                        });

                        worker.on('exit', (code) => {
                            if (code !== 0) {
                            }
                            activeWorkers--;
                            startWorker();
                        });
                    }

                    for (let i = 0; i < Math.min(numThreads, numAccounts); i++) {
                        startWorker();
                    }
                }
                processCycle();
            });
        });
    })();
} else {
    const bot = new YesCoinBot(workerData.accountIndex, workerData.account, workerData.proxy, workerData.config);
    bot.main().catch(console.error);
}
