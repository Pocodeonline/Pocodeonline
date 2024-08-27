const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Color constants
const COLORS = {
    PINK: '\x1b[38;5;13m',
    RED: '\x1b[38;5;9m',
    YELLOW: '\x1b[38;5;11m',
    GREEN: '\x1b[38;5;10m',
    LIGHT_PINK: '\x1b[38;5;207m',
    RESET: '\x1b[0m',
    FLAME_ORANGE: '\x1b[38;5;208m'
};

// File paths
const PROXIES_FILE_PATH = 'proxies.txt';
const ERROR_LOG_PATH = 'failed_accounts.txt';

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
            const [server, username, password] = line.split('|');
            proxies.push({ server, username, password });
        }
    }
    return proxies;
}

async function countNonEmptyLines(filePath) {
    if (!fs.existsSync(filePath)) return 0;
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    return lines.filter(line => line.trim()).length;
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

async function logFailedAccount(accountNumber) {
    const logStream = fs.createWriteStream(ERROR_LOG_PATH, { flags: 'a' });
    logStream.write(`Account ${accountNumber} failed\n`);
    logStream.end();
}

async function processAccount(context, accountUrl, accountNumber) {
    const page = await context.newPage();
    let success = false;
    try {
        console.log(`${COLORS.YELLOW}🐮 Đang chạy tài khoản ${accountNumber}`);
        await page.goto(accountUrl);

        // Handle optional skip button
        const skipButtonSelector = "body > div:nth-child(6) > div > div.ant-modal-wrap > div > div:nth-child(2) > div > div > div.btn_box___Az8hH > div.btn_style___CgrXw.btn_style_cancel___ZHjYK";
        let skipButtonFound = false;
        try {
            await Promise.race([
                page.waitForSelector(skipButtonSelector, { timeout: 5000 }).then(() => skipButtonFound = true),
                new Promise(resolve => setTimeout(resolve, 5000)) // Timeout of 5 seconds
            ]);

            if (skipButtonFound) {
                const skipButton = await page.waitForSelector(skipButtonSelector);
                await skipButton.click();
                console.log(`${COLORS.GREEN}Đã bỏ qua câu hỏi acc ${accountNumber}`);
            } else {
                console.log(`${COLORS.RED}Không tìm thấy nút bỏ qua trong vòng 5 giây ở acc ${accountNumber}`);
            }
        } catch (err) {
            console.log(`${COLORS.RED}Lỗi khi kiểm tra nút bỏ qua ở acc ${accountNumber}: ${err}`);
        }

        // Check for page load
        const pageLoadedSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_balance___ClINX";
        await page.waitForSelector(pageLoadedSelector, { timeout: 30000 });
        console.log(`${COLORS.GREEN}Đã Vào Giao diện ${await page.title()} Acc ${accountNumber}`);
        
        // Wait for random number to be different from 0.0000
        const randomNumberSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_rewards_mining___u39zf > div > span:nth-child(1)";
        let randomNumber;
        do {
            try {
                randomNumber = await page.textContent(randomNumberSelector);
            } catch (err) {
                console.log(`${COLORS.RED}Không thể tìm thấy số điểm đã đào: ${err}`);
            }
            if (randomNumber === '0.0000') {
                console.log(`${COLORS.CYAN}Chờ để số điểm cập nhật ở acc ${accountNumber}...`);
            }
        } while (randomNumber === '0.0000');

        const currentBalanceSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_mining___mBJYP > p";
        const currentBalance = await page.textContent(currentBalanceSelector);

        console.log(`${COLORS.GREEN}Số điểm đã đào của acc ${accountNumber}: ${randomNumber}`);
        console.log(`${COLORS.GREEN}Số dư hiện tại của acc ${accountNumber}: ${currentBalance}`);

        // Click claim button
        const claimButtonSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka";
        let claimButton;
        do {
            try {
                claimButton = await page.locator(claimButtonSelector);
                await claimButton.click();
                console.log(`${COLORS.GREEN}Đang claim acc ${accountNumber}`);
            } catch (err) {
                console.log(`${COLORS.RED}Chưa thấy claim acc, chờ thêm một chút : ${err}`);
                await page.waitForTimeout(5000);
            }
        } while (!claimButton);

        // Confirm claim process
        const claimProcessedSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka.farming____9oEZ";
        await page.waitForSelector(claimProcessedSelector, { timeout: 30000 });
        console.log(`${COLORS.GREEN}Claim thành công ${randomNumber} acc ${accountNumber}`);
        await page.locator(claimProcessedSelector).click();
        console.log(`${COLORS.GREEN}Đang cho acc đào tiếp ${accountNumber}`);
        await page.waitForTimeout(400);

        // Print remaining time
        const countdownHoursSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_rewards_mining___u39zf > div > span:nth-child(2)";
        const countdownHours = await page.textContent(countdownHoursSelector);
        console.log(`${COLORS.GREEN}Thời gian còn lại của acc ${accountNumber}: ${countdownHours}`);

        success = true;
    } catch (error) {
        console.error(`${COLORS.RED}Xảy ra lỗi khi xử lý tài khoản ${accountNumber}: ${error}`);
        await logFailedAccount(accountNumber);
    } finally {
        await page.close();
    }

    return success;
}

async function promptUser() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question("Nhập số lượng tài khoản muốn 🐮 chạy (hoặc 'all' để chạy tất cả, hoặc 0 để thoát): ", (input) => {
            rl.close();
            resolve(input);
        });
    });
}

async function runChromeInstances() {
    const proxyList = await readProxies(PROXIES_FILE_PATH);
    const accounts = await readAccounts('accounts.txt');
    

    if (accounts.length === 0) {
        console.log(`${COLORS.RED}Không tìm thấy tài khoản nào trong accounts.txt`);
        return;
    }

    if (proxyList.length === 0) {
        console.log(`${COLORS.RED}Không tìm thấy proxy nào trong proxies.txt`);
        return;
    }

    const maxConcurrency = 2; // Maximum number of concurrent browser instances
    const doneFilePath = 'done.txt';

    // Ensure the done file exists and is read as a string
    let doneAccounts = [];
    if (fs.existsSync(doneFilePath)) {
        const doneFileContent = await fs.promises.readFile(doneFilePath);
        doneAccounts = doneFileContent.toString().split('\n').filter(line => line.trim());
    }

    const pendingAccounts = accounts.filter(account => !doneAccounts.includes(account.trim()));

    if (pendingAccounts.length === 0) {
        console.log(`${COLORS.YELLOW}Tất cả các tài khoản đã được xử lý.`);
        return;
    }

    console.log(`${COLORS.FLAME_ORANGE}MATCHAIN🔥 code by 🐮`);
    console.log(`${COLORS.FLAME_ORANGE}tele : tphuc_0`);
    console.log(`${COLORS.YELLOW}Số tài khoản chưa xử lý: ${pendingAccounts.length}`);
    console.log(`${COLORS.YELLOW}Số tài khoản đã xử lý: ${doneAccounts.length}`);

    const input = await promptUser();

    if (input === '0') {
        console.log("Thoát chương trình.");
        return;
    }

    let numToProcess;
    if (input.toLowerCase() === 'all') {
        numToProcess = pendingAccounts.length;
    } else {
        numToProcess = parseInt(input, 10);
        if (isNaN(numToProcess) || numToProcess <= 0) {
            console.log(`${COLORS.RED}Số lượng không hợp lệ. Vui lòng nhập một số hợp lệ hoặc 'all'.`);
            return;
        }
        numToProcess = Math.min(numToProcess, pendingAccounts.length);
    }

    let index = 0;

    async function processNext() {
        if (index >= numToProcess) return;

        const proxy = proxyList[index % proxyList.length];
        const accountUrl = pendingAccounts[index];
        const accountNumber = index + 1;
        index += 1;

        const proxyServer = proxy.server;
        const proxyUsername = proxy.username;
        const proxyPassword = proxy.password;

        try {
            const browser = await chromium.launch({
                headless: true,
                proxy: {
                    server: proxyServer,
                    username: proxyUsername,
                    password: proxyPassword
                }
            });

            const context = await browser.newContext();
            const success = await processAccount(context, accountUrl, accountNumber);
            if (success) {
                await writeDoneAccounts([accountUrl], doneFilePath);
            }

            await browser.close();
        } catch (error) {
            console.error(`${COLORS.RED}Lỗi khi khởi động trình duyệt với proxy ${proxyServer}: ${error}`);
        }

        // Schedule the next instance
        setTimeout(processNext, 1000); // Adjust delay if needed
    }

    // Start processing accounts
    for (let i = 0; i < Math.min(maxConcurrency, numToProcess); i++) {
        processNext();
    }
}

// Run the script
(async () => {
    await printCustomLogo(true);
    await runChromeInstances();
})();
