const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { expect } = require('@playwright/test');

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
            await writeDoneAccounts([accountUrl], doneFilePath);
            await removeDoneAccount('matchain.txt', accountUrl); // Xóa tài khoản từ accounts.txt
            return;
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

            // Print remaining time
            const countdownHoursSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_countdown___G04z1 > ul";
            const countdownHours = await page.textContent(countdownHoursSelector, { timeout: 30000 });
            console.log(`${COLORS.GREEN}Thời gian còn lại của acc ${accountNumber}: ${countdownHours}`);
            await page.waitForTimeout(800);

            // Click on specific element
            const clickItemSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container___Joeqw > div.item___aAzf7.left_item___po1MT > div";
            await page.waitForSelector(clickItemSelector);
            await page.click(clickItemSelector);
            console.log(`${COLORS.GREEN}Đang mua x2...${accountNumber}`);
            await page.waitForTimeout(1000);

            // Click on specific element
            const clickx2Selector = "#root > div > div.container___tYOO7 > div.content___xItdF > div.btn___FttFE";
            await page.waitForSelector(clickx2Selector);
            await page.click(clickx2Selector);
            console.log(`${COLORS.GREEN}Đã mua x2${accountNumber}`);
            await page.waitForTimeout(2000);

            // Wait for final element and get its text
            const finalPointsSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container___Joeqw > div.item___aAzf7.left_item___po1MT > div > div.content_bottom___dCWi7 > div > div.points___ya4CK";
            await page.waitForSelector(finalPointsSelector);
            const finalPoints = await page.textContent(finalPointsSelector);
            console.log(`${COLORS.GREEN}-50 ${accountNumber}\x1b[38;5;11m: ${finalPoints}`);

            console.log(`${COLORS.GREEN}Mua x2 thành công cho acc ${accountNumber}`);
            success = true;
        }
    } catch (error) {
        console.error(`${COLORS.RED}Xảy ra lỗi khi xử lý tài khoản ${accountNumber}`);
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
        rl.question(`${COLORS.GREEN}Nhập số lượng tài khoản muốn 🐮 chạy \x1b[38;5;11m(\x1b[38;5;10mhoặc \x1b[38;5;11m'\x1b[38;5;10mall\x1b[38;5;11m'\x1b[38;5;10m để chạy tất cả\x1b[38;5;11m, \x1b[38;5;10mhoặc \x1b[38;5;9m0 \x1b[38;5;10mđể thoát\x1b[38;5;11m): `, (input) => {
            rl.close();
            resolve(input.trim()); // Ensure no leading or trailing whitespace
        });
    });
}

async function runChromeInstances() {
    const proxyList = await readProxies(PROXIES_FILE_PATH);
    const accounts = await readAccounts('matchain.txt');

    if (accounts.length === 0) {
        console.log(`${COLORS.RED}Không tìm thấy tài khoản nào trong matchain.txt`);
        return;
    }

    if (proxyList.length === 0) {
        console.log(`${COLORS.RED}Không tìm thấy proxy nào trong proxies.txt`);
        return;
    }

    const maxConcurrency = 4; // Maximum number of concurrent browser instances
    const doneFilePath = 'donematchain.txt';

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
    console.log(`${COLORS.PINK}tele \x1b[38;5;11m: \x1b[38;5;15mtphuc_0`);
    console.log(`${COLORS.LIGHT_PINK}Số tài khoản chưa xử lý\x1b[38;5;11m: \x1b[38;5;9m${pendingAccounts.length}`);
    console.log(`${COLORS.LIGHT_PINK}Số tài khoản đã xử lý\x1b[38;5;11m: \x1b[38;5;10m${doneAccounts.length}`);

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

        // Ensure we don't run out of proxies by using modulo to wrap around
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
            const success = await processAccount(context, accountUrl, accountNumber, proxy);
            if (success) {
                await writeDoneAccounts([accountUrl], doneFilePath);
                await removeDoneAccount('matchain.txt', accountUrl); // Xóa tài khoản từ accounts.txt
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

