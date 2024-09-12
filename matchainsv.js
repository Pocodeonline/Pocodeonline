const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

const COLORS = {
    SILVER: '\x1b[38;5;231m',
    LIGHT_PINK: '\x1b[38;5;207m',
    PINK: '\x1b[38;5;13m',
    YELLOW: '\x1b[38;5;11m',
    GREEN: '\x1b[38;5;10m',
    RED: '\x1b[38;5;9m',
    LIGHT_BLUE: '\x1b[38;5;12m',
    DARK_BLUE: '\x1b[38;5;19m',
    RESET: '\x1b[0m'
};

const ERROR_LOG_PATH = 'failed_accounts.txt';
const PROXIES_FILE_PATH = 'proxies.txt';

async function readProxies(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const proxies = [];
    for await (const line of rl) {
        if (line.trim()) {
            const [ip, port, username, password] = line.split(':');
            if (ip && port && username && password) {
                proxies.push({ server: `${ip}:${port}`, username, password });
            } else {
                console.error(`Proxy format error: ${line}`);
            }
        }
    }
    return proxies;
}

async function countNonEmptyLines(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (line.trim()) count++;
    }
    return count;
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


async function printCustomLogo(LIGHT_BLUE = true) {
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
    try {
        for (let i = 0; i < 5; i++) {
            if (LIGHT_BLUE) {
                console.log('\x1b[5m\x1b[32m' + logo.join('\n') + '\x1b[0m');
            } else {
                console.log('\x1b[32m' + logo.join('\n'));
            }
            await new Promise(resolve => setTimeout(resolve, 300));
            console.clear();
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    } catch (error) {
        console.error(`${COLORS.RED}Error displaying logo: ${error.message}`);
    }
}

async function processAccount(browserContext, accountUrl, accountNumber, proxy) {
    const page = await browserContext.newPage();
    const maxRetries = 3; // Số lần tối đa để thử lại
    const retryDelay = 3000; // Thời gian chờ giữa các lần thử lại (3000ms = 3 giây)
    let success = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}🐮 Đang chạy tài khoản \x1b[38;5;11m${accountNumber} \x1b[38;5;207mIP \x1b[38;5;11m:\x1b[38;5;13m${proxy.server}${COLORS.RESET}`);

            await page.goto(accountUrl, { waitUntil: 'networkidle0' });

            // Handle optional skip button
            const skipButtonSelector = "body > div:nth-child(6) > div > div.ant-modal-wrap > div > div:nth-child(2) > div > div > div.btn_box___Az8hH > div.btn_style___CgrXw.btn_style_cancel___ZHjYK";
            try {
                const skipButton = await page.waitForSelector(skipButtonSelector, { timeout: 10000 });
                if (skipButton) {
                    await skipButton.click();
                    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Skip bỏ qua mainet matchain acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                }
            } catch (err) {
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}Không thấy skip acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
            }

            // Check for page load
            const pageLoadedSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > img";
            await page.waitForSelector(pageLoadedSelector, { timeout: 15000 });
            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đã vào giao diện ${await page.title()} Acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

            const claimButtonSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka";
            try {
                const claimButton = await page.waitForSelector(claimButtonSelector, { timeout: 10000 });
                if (claimButton) {
                    await claimButton.click();
                    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Claim acc \x1b[38;5;11m${accountNumber} ${COLORS.GREEN}thành công...${COLORS.RESET}`);
                }
            } catch (err) {
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}Acc \x1b[38;5;11m${accountNumber} ${COLORS.RED}claim rồi...${COLORS.RESET}`);
            }

            await page.waitForTimeout(2000);

            const startButtonSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka.farming____9oEZ";
            const timeSelector = '#root > div > div > div.content___jvMX0.home___efXf1 > div.container_countdown___G04z1 > ul';
            try {
                const startButton = await page.waitForSelector(startButtonSelector, { timeout: 10000 });
                if (startButton) {
                    await startButton.click();
                    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đào lại acc \x1b[38;5;11m${accountNumber} ${COLORS.GREEN}thành công...${COLORS.RESET}`);
                    await page.waitForTimeout(1500);
                    const timeElement = await page.waitForSelector(timeSelector, { timeout: 8000 });
                    const timeText = await timeElement.evaluate(el => el.innerText);
                    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Giờ còn lại acc \x1b[38;5;11m${accountNumber} ${COLORS.GREEN}để đào tiếp  ${COLORS.GREEN}là \x1b[38;5;11m:${timeText}`);
                }
            } catch (err) {
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}Acc \x1b[38;5;11m${accountNumber} ${COLORS.RED}đào rồi...${COLORS.RESET}`);
            }

            await page.waitForTimeout(2000);

            // Print remaining time
            const countdownHoursSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_countdown___G04z1 > ul";
            const countdownHours = await page.textContent(countdownHoursSelector, { timeout: 30000 });
            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Thời gian còn lại của acc \x1b[38;5;11m${accountNumber}: ${countdownHours}${COLORS.RESET}`);

            const currentBalanceSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_mining___mBJYP > p";
            const currentBalance = await page.textContent(currentBalanceSelector, { timeout: 8000 });
            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Số dư hiện tại của acc \x1b[38;5;11m${accountNumber} \x1b[38;5;11m: ${currentBalance}${COLORS.RESET}`);

            // Click on specific element
            const clickItemSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container___Joeqw > div.item___aAzf7.left_item___po1MT > div > div.content_top___biYaq > div:nth-child(1) > img";
            await page.waitForSelector(clickItemSelector, { timeout: 4500 });
            await page.click(clickItemSelector);
            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đang mua x2 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

            // Click on specific element
            const clickx2Selector = "#root > div > div.container___tYOO7 > div.content___xItdF > div.btn___FttFE";
            await page.waitForSelector(clickx2Selector, { timeout: 4500 });
            await page.click(clickx2Selector);
            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đã mua x2 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
            await page.waitForTimeout(3600);

            // Wait for final element and get its text
            const finalPointsSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container___Joeqw > div.item___aAzf7.left_item___po1MT > div > div.content_bottom___dCWi7 > div > div.points___ya4CK";
            await page.waitForSelector(finalPointsSelector);
            const finalPoints = await page.textContent(finalPointsSelector);
            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}-50 point mua x2 acc \x1b[38;5;11m${accountNumber} \x1b[38;5;11m: ${finalPoints}${COLORS.RESET}`);

            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Mua x2 thành công cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);

            const taskStartSelector = "#root > div > div > ul > li:nth-child(2) > img";
            await page.waitForSelector(taskStartSelector, { timeout: 3000 });
            await page.click(taskStartSelector);
            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Bắt đầu làm nhiệm vụ cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                            
            // Wait for the task 1 button to be clickable
            const task1ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(1) > div.btn___xz27R";
            const claimtask1ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(1) > div.btn___xz27R.claim___VQBtK";
            try {
                await page.waitForSelector(task1ButtonSelector, { timeout: 6000 });
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 1 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                await page.click(task1ButtonSelector);
                await page.waitForTimeout(2000);
                await page.waitForSelector(claimtask1ButtonSelector, { timeout: 6000 });
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 1 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                await page.click(claimtask1ButtonSelector);
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 1 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
            
            } catch (error) {
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 1 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
            }
            
            const task2ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(2) > div.btn___xz27R";
            const claimtask2ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(2) > div.btn___xz27R.claim___VQBtK";
            try {
                await page.waitForSelector(task2ButtonSelector, { timeout: 6000 });
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 2 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                await page.click(task2ButtonSelector);
                await page.waitForTimeout(2000);
                await page.waitForSelector(claimtask2ButtonSelector, { timeout: 6000 });
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 2 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                await page.click(claimtask2ButtonSelector);
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 2 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
            
            } catch (error) {
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 2 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
            }
            
            // Wait for the task 3 button to be clickable
            const task3ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(3) > div.btn___xz27R";
            const claimtask3ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(3) > div.btn___xz27R.claim___VQBtK";
            try {
                await page.waitForSelector(task3ButtonSelector, { timeout: 6000 });
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 3 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                await page.click(task3ButtonSelector);
                await page.waitForTimeout(2000);
                await page.waitForSelector(claimtask3ButtonSelector, { timeout: 6000 });
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 3 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                await page.click(claimtask3ButtonSelector);
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 3 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
            } catch (error) {
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 3 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
            }
            
            // Wait for the task 4 button to be clickable
            const task4ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(4) > div.btn___xz27R";
            const claimtask4ButtonSelector = "#root > div > div > div.content___jvMX0.task___yvZDU > div.task_content___bkkzu > ul > li:nth-child(4) > div.btn___xz27R.claim___VQBtK";
            try {
                await page.waitForSelector(task4ButtonSelector, { timeout: 5000 });
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}làm task 4 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                await page.click(task4ButtonSelector);
                await page.waitForTimeout(2000);
                await page.waitForSelector(claimtask4ButtonSelector, { timeout: 5000 });
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}claim task 4 cho acc \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
                await page.click(claimtask4ButtonSelector);
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}đã làm task 4 \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
            
            } catch (error) {
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}task 4 làm rồi \x1b[38;5;11m${accountNumber}${COLORS.RESET}`);
            }

            // Mark as successful
            success = true;
            break; // Exit retry loop if successful
        } catch (error) {
            if (attempt < maxRetries) {
                console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}Lỗi khi xử lý tài khoản ${accountNumber}. Thử lại sau ${retryDelay / 1000} giây...${COLORS.RESET}`);
                await page.waitForTimeout(retryDelay);
            } else {
                console.error(`${COLORS.RED}Xảy ra lỗi khi xử lý tài khoản ${accountNumber} ${COLORS.RESET}`);
                await logFailedAccount(accountNumber, error.message);
            }
        }
    }

    try {
    
    } finally {
        await page.close();
    }

    return success;
}

async function runPlaywrightInstances(links, proxies, maxBrowsers) {
    let totalSuccessCount = 0;
    let totalFailureCount = 0;
    let proxyIndex = 0;
    let activeCount = 0;

    async function processAccountWithBrowser(accountUrl, accountNumber, proxy) {
        const browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-cpu',
                `--proxy-server=${proxy.server}`
            ]
        });

        const browserContext = await browser.newContext({
            httpCredentials: {
                storageState: null,
                username: proxy.username,
                password: proxy.password,
            }
        });

        let accountSuccess = false;
        try {
            accountSuccess = await processAccount(browserContext, accountUrl, accountNumber, proxy);
            if (accountSuccess) totalSuccessCount++;
            else totalFailureCount++;
        } catch (error) {
            totalFailureCount++;
        } finally {
            await browserContext.close();
            await browser.close();
        }
    }

    const accountQueue = [...links];
    while (accountQueue.length > 0 || activeCount > 0) {
        while (activeCount < maxBrowsers && accountQueue.length > 0) {
            const accountUrl = accountQueue.shift();
            const accountNumber = links.indexOf(accountUrl) + 1;
            const proxy = proxies[proxyIndex % proxies.length];
            proxyIndex++;

            activeCount++;
            processAccountWithBrowser(accountUrl, accountNumber, proxy)
                .then(() => {
                    activeCount--;
                    console.log(`${COLORS.GREEN}Hoàn tất tài khoản ${accountNumber}${COLORS.RESET}`);
                })
                .catch(() => {
                    activeCount--;
                    console.log(`${COLORS.RED}Tài khoản ${accountNumber} gặp lỗi${COLORS.RESET}`);
                });
        }

        if (activeCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 8000));
        }
    }

    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Hoàn tất xử lý tất cả tài khoản \x1b[38;5;231mTool \x1b[38;5;11m[ \x1b[38;5;231mMatchain \x1b[38;5;11m] ${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.SILVER}Tổng tài khoản thành công: ${COLORS.YELLOW}${totalSuccessCount}${COLORS.RESET}`);
    console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.SILVER}Tổng tài khoản lỗi: ${COLORS.YELLOW}${totalFailureCount}${COLORS.RESET}`);
}

async function logFailedAccount(accountNumber, errorMessage) {
    fs.appendFileSync(ERROR_LOG_PATH, `Tài khoản số ${accountNumber} gặp lỗi\n`);
}

async function countdownTimer(seconds) {
    for (let i = seconds; i >= 0; i--) {
        process.stdout.write(`\r${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.RED}Đang nghỉ ngơi còn lại ${COLORS.YELLOW}${i} ${COLORS.RED}giây${COLORS.RESET}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log();
}

(async () => {
    await printCustomLogo(true);
    const filePath = 'matchain.txt';

    try {
        const proxies = await readProxies(PROXIES_FILE_PATH);
        if (proxies.length === 0) {
            console.log(`${COLORS.RED}Không tìm thấy proxy nào.${COLORS.RESET}`);
            return;
        }

        while (true) {
            const nonEmptyLines = await countNonEmptyLines(filePath);
            if (nonEmptyLines === 0) {
                console.log(`${COLORS.RED}File không chứa tài khoản nào.${COLORS.RESET}`);
                break;
            }

            const links = await readAccounts(filePath);
            console.log(`${COLORS.SILVER}MATCHAIIN ${COLORS.LIGHT_PINK}code by ${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] ${COLORS.RESET}`);
            console.log(`${COLORS.GREEN}tele${COLORS.YELLOW}: ${COLORS.PINK}tphuc_0 ${COLORS.RESET}`);
            console.log(`${COLORS.GREEN}Hiện tại bạn có ${COLORS.YELLOW}${nonEmptyLines}${COLORS.GREEN} tài khoản${COLORS.RESET}`);

            const userInput = await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${COLORS.YELLOW}(${COLORS.GREEN}hoặc ${COLORS.YELLOW}'all' ${COLORS.GREEN}để chạy tất cả${COLORS.YELLOW}, ${COLORS.RED}0 ${COLORS.GREEN}để thoát${COLORS.YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            });

            let numAccounts;
            if (userInput.toLowerCase() === 'all') {
                numAccounts = links.length;
            } else if (!isNaN(userInput)) {
                numAccounts = parseInt(userInput, 10);
                if (numAccounts <= 0) break;
                if (numAccounts > links.length) numAccounts = links.length;
            } else {
                console.log(`${COLORS.RED}Nhập không hợp lệ!${COLORS.RESET}`);
                continue;
            }

            const restTime = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản ${COLORS.YELLOW}(${COLORS.GREEN}Khuyên ${COLORS.YELLOW}28800 ${COLORS.GREEN}nha${COLORS.YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            const repeatCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Nhập số lần lặp lại sau thời gian nghỉ ngơi ${COLORS.YELLOW}(${COLORS.GREEN}hoặc ${COLORS.YELLOW}0 ${COLORS.GREEN}để chạy một lần): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(repeatCount) || repeatCount < 0) {
                console.log(`${COLORS.RED}Nhập không hợp lệ!${COLORS.RESET}`);
                continue;
            }

            // Thêm đoạn mã yêu cầu số lượng trong hàm runPlaywrightInstances
            const instancesCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Nhập số lượng luồng máy bạn có thể xử lý tài khoản để chạy ${COLORS.YELLOW}( ${COLORS.GREEN}Ai máy yếu khuyên  ${COLORS.YELLOW}6 ${COLORS.GREEN}nha${COLORS.YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(instancesCount) || instancesCount <= 0) {
                console.log(`${COLORS.RED}Nhập không hợp lệ!${COLORS.RESET}`);
                continue;
            }

            for (let i = 0; i <= repeatCount; i++) {
                console.log(`${COLORS.SILVER}Chạy lần ${COLORS.GREEN}${i + 1}${COLORS.RESET}`);
                await runPlaywrightInstances(links.slice(0, numAccounts), proxies, instancesCount);

                if (i < repeatCount) {
                    await countdownTimer(restTime);
                }
            }

            console.log(`${COLORS.YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${COLORS.GREEN}Đã hoàn tất tất cả các số lần muốn chạy lại.${COLORS.RESET}`);
        }
    } catch (e) {
        console.log(`${COLORS.RED}Lỗi${COLORS.RESET}`);
    }
})();
