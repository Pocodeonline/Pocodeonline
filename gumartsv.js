const { chromium } = require('playwright');
const fs = require('fs').promises;
const readline = require('readline');
const os = require('os');

const SILVER = '\x1b[38;5;231m';
const LIGHT_PINK = '\x1b[38;5;207m';
const PINK = '\x1b[38;5;13m';
const YELLOW = '\x1b[38;5;11m';
const GREEN = '\x1b[38;5;10m';
const RED = '\x1b[38;5;9m';
const LIGHT_BLUE = '\x1b[38;5;12m';
const DARK_BLUE = '\x1b[38;5;19m';
const RESET = '\x1b[0m';

const ERROR_LOG_PATH = 'failed_accounts.txt';
const PROXIES_FILE_PATH = 'proxies.txt';

async function readProxies(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return content.split('\n')
        .filter(line => line.trim())
        .map(line => {
            const [ip, port, username, password] = line.split(':');
            return { server: `${ip}:${port}`, username, password };
        });
}

async function countNonEmptyLines(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return content.split('\n').filter(line => line.trim()).length;
}

async function readAccounts(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    return content.split('\n').filter(line => line.trim());
}

async function printCustomLogo(blink = false) {
    const logo = ["ĐANG VÀO TOOL GUMART..."];
    console.clear();
    for (let i = 0; i < 5; i++) {
        console.log(blink ? '\x1b[5m\x1b[32m' + logo.join('\n') + '\x1b[0m' : '\x1b[32m' + logo.join('\n'));
        await new Promise(resolve => setTimeout(resolve, 300));
        console.clear();
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

async function processAccount(page, accountUrl, accountNumber, proxy) {
    const maxRetries = 3;
    const retryDelay = 3000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}🐮 Đang chạy tài khoản \x1b[38;5;11m${accountNumber} \x1b[38;5;207mIP \x1b[38;5;11m:\x1b[38;5;13m${proxy.server}${RESET}`);
            await page.goto(accountUrl, { waitUntil: 'networkidle' });

            const skipButtonSelector = "#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > div > div > div > div.transition-all > button";
            const pointTextSelector = "#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > div > div > div > div.flex.gap-2.items-center > div > div.w-full.flex.justify-between > div:nth-child(2) > p";
            const balanceTextSelector = "#__nuxt > div > div > section > div.w-full.flex.flex-col.gap-4.px-4.py-2.relative.z-\\[3\\] > div.flex.flex-col.gap-2.items-center > div > p";

            const [pointTextElement, balanceTextElement, skipButton] = await Promise.all([
                page.waitForSelector(pointTextSelector, { timeout: 8000 }).catch(() => null),
                page.waitForSelector(balanceTextSelector, { timeout: 8000 }).catch(() => null),
                page.waitForSelector(skipButtonSelector, { timeout: 8000 }).catch(() => null)
            ]);

            const pointText = pointTextElement ? await pointTextElement.innerText() : "N/A";
            const balanceText = balanceTextElement ? await balanceTextElement.innerText() : "N/A";

            if (skipButton) {
                console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Số Dư acc \x1b[38;5;11m${accountNumber}: \x1b[38;5;12m${balanceText} ${GREEN}Claim \x1b[38;5;11m+${pointText} ${GREEN}point thành công...${RESET}`);
                await skipButton.click();
            } else {
                console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Acc \x1b[38;5;11m${accountNumber}${RED} không claim được...${RESET}`);
            }

            const imgSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > button > div';
            const imgElement = await page.$(imgSelector);

            if (imgElement) {
                await imgElement.click();
                await page.waitForTimeout(2000);
            } else {
                const timeSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > button > div > div';
                const timeElement = await page.$(timeSelector);
                if (timeElement) {
                    const time = await timeElement.innerText();
                    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}X2 của tài khoản ${YELLOW}${accountNumber} còn ${time} mới mua lại tiếp được...`);
                }
            }

            return true;
        } catch (error) {
            if (attempt < maxRetries) {
                console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Đang thử lại acc ${YELLOW}${accountNumber} ${RED}lần${YELLOW} ${attempt + 1}`);
                await page.waitForTimeout(retryDelay);
            } else {
                console.error(`${RED}Tài khoản số ${accountNumber} gặp lỗi`);
                await logFailedAccount(accountNumber, error.message);
                return false;
            }
        }
    }
}

async function runPlaywrightInstances(links, proxies, maxBrowsers) {
    let totalSuccessCount = 0;
    let totalFailureCount = 0;
    let proxyIndex = 0;

    const browser = await chromium.launch({
        headless: true,
        proxy: {
            server: 'http://per-context'
        },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--metrics-recording-only',
            '--mute-audio',
            '--no-first-run',
            '--safebrowsing-disable-auto-update'
        ]
    });

    const processAccountWithContext = async (accountUrl, accountNumber, proxy) => {
        const context = await browser.newContext({
            proxy: {
                server: proxy.server,
                username: proxy.username,
                password: proxy.password
            },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.54'
        });
        const page = await context.newPage();

        try {
            const success = await processAccount(page, accountUrl, accountNumber, proxy);
            if (success) totalSuccessCount++;
            else totalFailureCount++;
        } catch (error) {
            totalFailureCount++;
        } finally {
            await context.close();
        }
    };

    const runningTasks = new Set();

    for (let i = 0; i < links.length; i++) {
        const accountUrl = links[i];
        const accountNumber = i + 1;
        const proxy = proxies[proxyIndex % proxies.length];
        proxyIndex++;

        const task = processAccountWithContext(accountUrl, accountNumber, proxy);
        runningTasks.add(task);
        task.then(() => runningTasks.delete(task));

        if (runningTasks.size >= maxBrowsers) {
            await Promise.race(runningTasks);
        }
    }

    await Promise.all(runningTasks);
    await browser.close();

    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Hoàn tất xử lý tất cả tài khoản \x1b[38;5;231mTool \x1b[38;5;11m[ \x1b[38;5;231mGUMART CLAIM X2 \x1b[38;5;11m].`);
    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${SILVER}Tổng tài khoản thành công: ${YELLOW}${totalSuccessCount}`);
    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${SILVER}Tổng tài khoản lỗi: ${YELLOW}${totalFailureCount}`);

    return { totalSuccessCount, totalFailureCount };
}

async function logFailedAccount(accountNumber, errorMessage) {
    await fs.appendFile(ERROR_LOG_PATH, `Tài khoản số ${accountNumber} gặp lỗi\n`);
}

async function countdownTimer(seconds) {
    for (let i = seconds; i >= 0; i--) {
        process.stdout.write(`\r${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Đang nghỉ ngơi còn lại ${YELLOW}${i} ${RED}giây`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log();
}

(async () => {
    await printCustomLogo(true);
    const filePath = 'gumart.txt';

    try {
        const proxies = await readProxies(PROXIES_FILE_PATH);
        if (proxies.length === 0) {
            console.log(`${RED}Không tìm thấy proxy nào.`);
            return;
        }

        while (true) {
            const nonEmptyLines = await countNonEmptyLines(filePath);
            if (nonEmptyLines === 0) {
                console.log(`${RED}File không chứa tài khoản nào.`);
                break;
            }

            const links = await readAccounts(filePath);
            console.log(`${SILVER}GURMART CLAIM X2 ${LIGHT_PINK}code by ${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] ${RESET}`);
            console.log(`${LIGHT_PINK}tele${YELLOW}: ${PINK}tphuc_0 ${RESET}`);
            console.log(`${GREEN}Hiện tại bạn có ${YELLOW}${nonEmptyLines}${GREEN} tài khoản`);

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const userInput = await new Promise(resolve => {
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${YELLOW}(${GREEN}hoặc ${YELLOW}'all' ${GREEN}để chạy tất cả${YELLOW}, ${RED}0 ${GREEN}để thoát${YELLOW}): `, resolve);
            });

            let numAccounts;
            if (userInput.toLowerCase() === 'all') {
                numAccounts = links.length;
            } else {
                numAccounts = parseInt(userInput, 10);
                if (numAccounts <= 0) break;
                if (numAccounts > links.length) numAccounts = links.length;
            }

            const restTime = parseInt(await new Promise(resolve => {
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản ${YELLOW}( ${GREEN}Khuyên ${YELLOW}9000 ${GREEN}nha${YELLOW}): `, resolve);
            }), 10);

            const repeatCount = parseInt(await new Promise(resolve => {
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lần lặp lại sau thời gian nghỉ ngơi ${YELLOW}( ${GREEN}hoặc ${YELLOW}0 ${GREEN}để chạy một lần): `, resolve);
            }), 10);

            const instancesCount = parseInt(await new Promise(resolve => {
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lượng luồng máy bạn có thể xử lý tài khoản để chạy ${YELLOW}( ${GREEN}Ai máy yếu khuyên  ${YELLOW}6 ${GREEN}nha${YELLOW}): `, resolve);
            }), 10);

            rl.close();

            if (isNaN(repeatCount) || repeatCount < 0 || isNaN(instancesCount) || instancesCount <= 0) {
                console.log(`${RED}Nhập không hợp lệ!${RESET}`);
                continue;
            }

            let totalSuccessCount = 0;
            let totalFailureCount = 0;

            for (let i = 0; i <= repeatCount; i++) {
                console.log(`${SILVER}Chạy lần ${GREEN}${i + 1}${RESET}`);
                const { totalSuccessCount: successCount, totalFailureCount: failureCount } = await runPlaywrightInstances(links.slice(0, numAccounts), proxies, instancesCount);
                totalSuccessCount += successCount;
                totalFailureCount += failureCount;

                if (i < repeatCount) {
                    await countdownTimer(restTime);
                }
            }

            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Đã hoàn tất tất cả các số lần muốn chạy lại.${RESET}`);
            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${SILVER}Tổng tài khoản thành công: ${YELLOW}${totalSuccessCount}`);
            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${SILVER}Tổng tài khoản lỗi: ${YELLOW}${totalFailureCount}`);
        }
    } catch (e) {
        console.log(`${RED}Lỗi: ${e.message}${RESET}`);
    }
})();
