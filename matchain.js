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

// Global counters
let successCount = 0;
let errorCount = 0;

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
        console.log(`${COLORS.GREEN}🐮 Đang chạy tài khoản \x1b[38;5;11m${accountNumber} \x1b[38;5;13mIP \x1b[38;5;11m:\x1b[38;5;13m${proxy.server}`);
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
            // Even if claim button does not exist, proceed to log as done
            console.log(`${COLORS.RED}Acc ${accountNumber} claim rồi hoặc không tồn tại.`);
            // Here we just log the account number without removing it from the file
            await writeDoneAccounts([accountUrl], 'donematchain.txt');
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
            console.log(`${COLORS.GREEN}Thời gian còn lại của acc ${accountNumber} là: ${countdownHours}`);
        }

        success = true;
        successCount++;
    } catch (error) {
        console.error(`${COLORS.RED}Lỗi với tài khoản ${accountNumber}: ${error.message}`);
        errorCount++;
    } finally {
        await page.close();
    }

    return success;
}

async function run() {
    const proxies = await readProxies(PROXIES_FILE_PATH);
    const accounts = await readAccounts('matchain.txt');
    const retryCount = 5; // Số lần chạy lại

    if (accounts.length === 0) {
        console.log(`${COLORS.YELLOW}Không có tài khoản nào để xử lý.`);
        return;
    }

    let proxyIndex = 0;
    let proxy = proxies[proxyIndex];
    const browser = await chromium.launch({ headless: false });
    let context = await browser.newContext({
        proxy: proxy ? {
            server: proxy.server,
            username: proxy.username,
            password: proxy.password
        } : undefined
    });

    await printCustomLogo();

    for (let runIndex = 0; runIndex < retryCount; runIndex++) {
        console.log(`${COLORS.GREEN}Chạy lần ${runIndex + 1}...`);

        for (let i = 0; i < accounts.length; i++) {
            const accountUrl = accounts[i];
            const accountNumber = i + 1;
            const success = await processAccount(context, accountUrl, accountNumber, proxy);

            // Move to next proxy if all accounts are processed
            if (!success && proxyIndex < proxies.length - 1) {
                proxyIndex++;
                proxy = proxies[proxyIndex];
                console.log(`${COLORS.YELLOW}Đổi proxy sang ${proxy.server}`);
                await context.close();
                context = await browser.newContext({
                    proxy: proxy ? {
                        server: proxy.server,
                        username: proxy.username,
                        password: proxy.password
                    } : undefined
                });
            }
        }

        console.log(`${COLORS.GREEN}Tổng số tài khoản thành công lần ${runIndex + 1}: ${successCount}`);
        console.log(`${COLORS.RED}Tổng số lỗi lần ${runIndex + 1}: ${errorCount}`);

        if (runIndex < retryCount - 1) {
            console.log(`${COLORS.YELLOW}Đang nghỉ giữa các lần chạy...`);
            await new Promise(resolve => setTimeout(resolve, 60000)); // Nghỉ 1 phút (60000 ms)
        }
    }

    await browser.close();
    console.log(`${COLORS.GREEN}Hoàn tất tất cả các lần chạy.`);
}

// Run the script
run().catch(err => console.error(`Có lỗi xảy ra: ${err.message}`));
