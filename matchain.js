const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

// Color constants
const COLORS = {
    PINK: '\x1b[38;5;13m',
    RED: '\x1b[38;5;9m',
    YELLOW: '\x1b[38;5;11m',
    WHITE: '\x1b[38;5;15m',
    GREEN: '\x1b[38;5;10m',
    LIGHT_PINK: '\x1b[38;5;207m',
    RESET: '\x1b[0m',
    FLAME_ORANGE: '\x1b[38;5;208m',
};

// File paths
const PROXIES_FILE_PATH = 'proxies.txt';
const DONE_FILE_PATH = 'donematchain.txt';
const ACCOUNTS_FILE_PATH = 'matchain.txt';

// Utility functions
async function readProxies(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const proxies = [];
    for await (const line of rl) {
        if (line.trim()) {
            const parts = line.split(':');
            if (parts.length === 4) {
                const [ip, port, username, password] = parts;
                proxies.push({ server: `${ip}:${port}`, username, password });
            } else {
                console.error(`Proxy format error: ${line}`);
            }
        }
    }
    return proxies;
}

async function readAccounts(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const links = [];
    for await (const line of rl) {
        if (line.trim()) links.push(line.trim());
    }
    return links;
}

async function writeDoneAccounts(doneAccounts, doneFilePath) {
    return new Promise((resolve, reject) => {
        fs.appendFile(doneFilePath, doneAccounts.join('\n') + '\n', (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

async function removeDoneAccount(filePath, account) {
    return new Promise(async (resolve, reject) => {
        try {
            const lines = (await fs.promises.readFile(filePath, 'utf8')).split('\n');
            const updatedLines = lines.filter(line => line.trim() !== account);
            await fs.promises.writeFile(filePath, updatedLines.join('\n') + '\n');
            resolve();
        } catch (err) {
            reject(err);
        }
    });
}

async function printCustomLogo(blink = false) {
    const logo = [
        "🔥🔥    🔥🔥      🔥🔥   🔥🔥🔥  🔥🔥🔥   🔥  🔥    🔥🔥   🔥  🔥🔥   🔥",
        "🔥 🔥  🔥 🔥     🔥  🔥    🔥   🔥        🔥  🔥   🔥  🔥  🔥  🔥 🔥  🔥",
        "🔥  🔥🔥  🔥    🔥 🔥 🔥   🔥   🔥        🔥🔥🔥   🔥🔥🔥  🔥  🔥  🔥 🔥",
        "🔥   🔥    🔥  🔥      🔥  🔥   🔥        🔥  🔥  🔥    🔥 🔥  🔥   🔥🔥",
        "🔥         🔥 🔥        🔥 🔥    🔥🔥 🔥  🔥  🔥 🔥      🔥🔥  🔥     🔥",
        "",
        "chờ một lát..."
    ];

    console.clear();
    for (let i = 0; i < 5; i++) {
        console.log(`${blink ? '\x1b[5m' : ''}${COLORS.PINK}${logo.join('\n')}${COLORS.RESET}`);
        await new Promise(r => setTimeout(r, 500));
        console.clear();
        await new Promise(r => setTimeout(r, 300));
    }
}

async function processAccount(context, accountUrl, accountNumber, proxy) {
    const page = await context.newPage();
    let success = false;

    try {
        console.log(`${COLORS.GREEN}🐮 Đang chạy tài khoản \x1b[38;5;11m${accountNumber} \x1b[38;5;207mIP \x1b[38;5;11m:\x1b[38;5;13m${proxy.server}`);
        await page.goto(accountUrl);

        // Handle optional skip button
        const skipButtonSelector = "body > div:nth-child(6) > div > div.ant-modal-wrap.ant-modal-centered > div > div:nth-child(2) > div > button";
        let skipButtonFound = false;

        try {
            await Promise.race([
                page.waitForSelector(skipButtonSelector, { timeout: 8000 }).then(() => skipButtonFound = true),
                new Promise(resolve => setTimeout(resolve, 8000)) // Timeout of 8 seconds
            ]);

            if (skipButtonFound) {
                const skipButton = await page.waitForSelector(skipButtonSelector);
                await skipButton.click();
            } else {
                console.log(`${COLORS.RED}Không tìm thấy nút bỏ qua trong vòng 8 giây ở acc ${accountNumber}`);
            }
        } catch (err) {
            console.log(`${COLORS.RED}Lỗi khi kiểm tra nút bỏ qua ở acc ${accountNumber}`);
        }

        // Check for page load
        const pageLoadedSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_balance___ClINX";
        await page.waitForSelector(pageLoadedSelector, { timeout: 30000 });
        console.log(`${COLORS.GREEN}Đã vào giao diện ${await page.title()} Acc ${accountNumber}`);

        // Wait for random number to be different from 0.0000
        const randomNumberSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_rewards_mining___u39zf > div > span:nth-child(1)";
        let randomNumber;
        do {
            try {
                randomNumber = await page.textContent(randomNumberSelector);
            } catch (err) {
                console.log(`${COLORS.RED}Không thể tìm thấy số điểm đã đào`);
            }
            if (randomNumber === '0.0000') {
                console.log(`${COLORS.CYAN}Chờ để số điểm cập nhật ở acc ${accountNumber}...`);
                await page.waitForTimeout(4000); // Thêm thời gian chờ để cập nhật số điểm
            }
        } while (randomNumber === '0.0000');

        const currentBalanceSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_mining___mBJYP > p";
        const currentBalance = await page.textContent(currentBalanceSelector);
        console.log(`${COLORS.GREEN}Số điểm đã đào của acc ${accountNumber}\x1b[38;5;11m: ${randomNumber}`);
        console.log(`${COLORS.GREEN}Số dư hiện tại của acc ${accountNumber}\x1b[38;5;11m: ${currentBalance}`);
        await page.waitForTimeout(1500);
        
        // Check if claim button exists
        const claimButtonSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka";
        let claimButtonExists = false;

        try {
            claimButtonExists = await page.waitForSelector(claimButtonSelector, { visible: true, timeout: 8000 });
        } catch (err) {
            // Even if claim button does not exist, proceed to remove the account and add to done
            console.log(`${COLORS.RED}Acc ${accountNumber} claim rồi hoặc không tồn tại.`);
            await writeDoneAccounts([accountUrl], DONE_FILE_PATH);
            await removeDoneAccount(ACCOUNTS_FILE_PATH, accountUrl); // Xóa tài khoản từ accounts.txt
            return false; // Mark as failure
        }

        // Click claim button
        if (claimButtonExists) {
            await page.click(claimButtonSelector);
            console.log(`${COLORS.GREEN}Đang claim acc ${accountNumber}`);            

            // Confirm claim process
            const claimProcessedSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka.farming____9oEZ";
            await page.waitForSelector(claimProcessedSelector);
            console.log(`${COLORS.GREEN}Claim thành công ${randomNumber} acc ${accountNumber}`);
            await page.click(claimProcessedSelector);
            console.log(`${COLORS.GREEN}Đang cho acc đào tiếp ${accountNumber}`);
            await page.waitForTimeout(800);

            // Wait for countdown text
            const countdownHoursSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka > span";
            const countdownText = await page.textContent(countdownHoursSelector);
            console.log(`${COLORS.GREEN}Thời gian còn lại của acc ${accountNumber} là: ${countdownText}`);

            success = true;
        } else {
            console.log(`${COLORS.RED}Không tìm thấy nút claim cho acc ${accountNumber}`);
        }
    } catch (error) {
        console.log(`${COLORS.RED}Lỗi khi xử lý tài khoản ${accountNumber}: ${error.message}`);
    } finally {
        await page.close();
    }

    return success;
}

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const proxies = await readProxies(PROXIES_FILE_PATH);
    const accounts = await readAccounts(ACCOUNTS_FILE_PATH);

    rl.question('Nhập số lượng tài khoản muốn chạy: ', async (numAccounts) => {
        const num = parseInt(numAccounts, 10);
        if (isNaN(num) || num <= 0 || num > accounts.length) {
            console.log('Số lượng tài khoản không hợp lệ.');
            rl.close();
            return;
        }

        rl.question('Nhập thời gian nghỉ ngơi giữa các lần chạy (giây): ', async (restTime) => {
            const rest = parseInt(restTime, 10);
            if (isNaN(rest) || rest < 0) {
                console.log('Thời gian nghỉ ngơi không hợp lệ.');
                rl.close();
                return;
            }

            rl.question('Nhập số lần tự động chạy lại: ', async (retryTimes) => {
                const retries = parseInt(retryTimes, 10);
                if (isNaN(retries) || retries < 0) {
                    console.log('Số lần tự động chạy lại không hợp lệ.');
                    rl.close();
                    return;
                }

                console.log(`${COLORS.GREEN}Sẽ chạy ${num} tài khoản với thời gian nghỉ ngơi ${rest} giây giữa các lần chạy và số lần tự động chạy lại ${retries}`);
                rl.close();

                for (let attempt = 0; attempt <= retries; attempt++) {
                    console.log(`${COLORS.YELLOW}Lần chạy số ${attempt + 1} bắt đầu...`);

                    let successfulCount = 0;
                    let failedCount = 0;

                    for (let i = 0; i < num; i++) {
                        const proxy = proxies[i % proxies.length];
                        const accountUrl = accounts[i];

                        const browser = await chromium.launch({ headless: false });
                        const context = await browser.newContext({
                            proxy: proxy ? {
                                server: `http://${proxy.server}`,
                                username: proxy.username,
                                password: proxy.password
                            } : undefined
                        });

                        const success = await processAccount(context, accountUrl, i + 1, proxy);
                        if (success) {
                            successfulCount++;
                        } else {
                            failedCount++;
                        }

                        await context.close();
                        await browser.close();
                    }

                    console.log(`${COLORS.GREEN}Tổng số tài khoản thành công: ${successfulCount}`);
                    console.log(`${COLORS.RED}Tổng số tài khoản thất bại: ${failedCount}`);

                    console.log(`${COLORS.YELLOW}Đang nghỉ ngơi ${rest} giây trước khi tiếp tục...`);
                    await new Promise(resolve => setTimeout(resolve, rest * 1000));

                    // Di chuyển các tài khoản đã xử lý từ matchain.txt sang donematchain.txt
                    const doneAccounts = accounts.slice(0, num);
                    await writeDoneAccounts(doneAccounts, DONE_FILE_PATH);
                    await fs.promises.writeFile(ACCOUNTS_FILE_PATH, accounts.slice(num).join('\n') + '\n');
                    console.log(`${COLORS.GREEN}Đã di chuyển các tài khoản đã xử lý sang donematchain.txt và làm sạch matchain.txt`);
                }

                console.log(`${COLORS.GREEN}Hoàn tất tất cả các lần chạy.`);
            });
        });
    });
}

main();
