const { chromium } = require('playwright');
const fs = require('fs');
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
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (line.trim()) {
            count++;
        }
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

async function printCustomLogo(blink = false) {
    const logo = [
        "ĐANG VÀO TOOL TEMCO..."
    ];
    console.clear();
    for (let i = 0; i < 5; i++) {
        if (blink) {
            console.log('\x1b[5m\x1b[32m' + logo.join('\n') + '\x1b[0m');
        } else {
            console.log('\x1b[32m' + logo.join('\n'));
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        console.clear();
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

async function processAccount(page, accountUrl, accountNumber, proxy) {
    const maxRetries = 3;
    const retryDelay = 3000;
    let success = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}🐮 Đang chạy tài khoản \x1b[38;5;11m${accountNumber} \x1b[38;5;207mIP \x1b[38;5;11m:\x1b[38;5;13m${proxy.server}${RESET}`);
            await page.goto(accountUrl, { waitUntil: 'networkidle' });

            // Xử lý các nhiệm vụ
            await handleTasks(page, accountNumber);

            // Lấy số dư hiện tại
            const currentBalance = await getCurrentBalance(page);
            console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Số dư hiện tại của acc \x1b[38;5;11m${accountNumber} \x1b[38;5;11m: ${currentBalance} ${GREEN}khi làm xong..${RESET}`);
            
            success = true;
            break;
        } catch (error) {
            if (attempt < maxRetries) {
                console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Đang thử lại acc ${YELLOW}${accountNumber} ${RED}lần${YELLOW} ${attempt + 1}`);
                await page.reload({ waitUntil: 'networkidle' });
            } else {
                console.error(`${RED}Tài khoản số ${accountNumber} gặp lỗi`);
                await logFailedAccount(accountNumber, error.message);
            }
        }
    }

    return success;
}

async function handleTasks(page, accountNumber) {
    // Xử lý nút Skip
    await handleSkipButton(page, accountNumber);

    // Xử lý nút Start Mining
    await handleStartMiningButton(page, accountNumber);

    // Xử lý nhiệm vụ điểm danh
    await handleAttendanceTask(page, accountNumber);

    // Xử lý nhiệm vụ theo dõi nhóm
    await handleFollowGroupTask(page, accountNumber);
}

async function handleSkipButton(page, accountNumber) {
    const skippButtonSelector = "//div[contains(@class, 'i-carbon:close-outline') and contains(@class, 'close-btn')]";
    try {
        await page.waitForXPath(skippButtonSelector, { timeout: 4000 });
        await page.click(skippButtonSelector);
        console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Skip bỏ qua thông báo acc \x1b[38;5;11m${accountNumber}${RESET}`);
    } catch (err) {
        console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Không thấy skip acc \x1b[38;5;11m${accountNumber}${RESET}`);
    }
}

async function handleStartMiningButton(page, accountNumber) {
    const startminingButtonSelector = "//div[contains(@class, 'mt-20px')]//a//div";
    try {
        await page.waitForXPath(startminingButtonSelector, { timeout: 4000 });
        await page.click(startminingButtonSelector);
        console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Đào cho acc \x1b[38;5;11m${accountNumber} thành công...${RESET}`);
    } catch (err) {
        console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Không đào lại được acc\x1b[38;5;11m${accountNumber}${RED}...${RESET}`);
    }
}

async function handleAttendanceTask(page, accountNumber) {
    const attendanceSelector = "//div[contains(@class, 'container-card')]//div[contains(@class, 'flex-col')]//div[5]";
    try {
        await page.waitForXPath(attendanceSelector, { timeout: 2000 });
        await page.click(attendanceSelector);
        await page.waitForTimeout(3000);
        console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Đã điểm danh cho acc ${YELLOW}${accountNumber}`);
    } catch (error) {
        const timeSelector = "//div[contains(@class, 'container-card')]//div[contains(@class, 'flex-col')]//div[5]";
        const timeElement = await page.waitForXPath(timeSelector, { timeout: 3000 });
        const time = await page.evaluate(el => el.textContent, timeElement);
        console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${LIGHT_BLUE}Điểm danh của tài khoản ${YELLOW}${accountNumber} ${GREEN}${time} mai mới điểm danh tiếp`);
    }
}

async function handleFollowGroupTask(page, accountNumber) {
    const followGroupSelector = "//div[contains(@class, 'container-card')]//div[contains(@class, 'flex-col')]//div[4]";
    try {
        await page.waitForXPath(followGroupSelector, { timeout: 2000 });
        await page.click(followGroupSelector);
        await page.waitForTimeout(3000);
        console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Đã làm task theo dõi nhóm acc ${YELLOW}${accountNumber} ${GREEN}+ ${YELLOW}50 ${GREEN}TEMCO`);
    } catch (error) {
        const timeSelector = "//div[contains(@class, 'container-card')]//div[contains(@class, 'flex-col')]//div[4]";
        const timeElement = await page.waitForXPath(timeSelector, { timeout: 3000 });
        const time = await page.evaluate(el => el.textContent, timeElement);
        console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${LIGHT_BLUE}Task theo dõi nhóm của tài khoản ${YELLOW}${accountNumber} ${GREEN}${time} mới làm tiếp được`);
    }
}

async function getCurrentBalance(page) {
    const balanceSelector = "//div[contains(@class, 'account-wrap')]//div[contains(@class, 'font-bold')]";
    const balanceElement = await page.waitForXPath(balanceSelector, { timeout: 3000 });
    return await page.evaluate(el => el.textContent, balanceElement);
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
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                `--proxy-server=${proxy.server}`
            ]
        });

        const context = await browser.newContext({
            httpCredentials: {
                username: proxy.username,
                password: proxy.password
            },
            bypassCSP: true,
        });

        const page = await context.newPage();

        let accountSuccess = false;
        try {
            accountSuccess = await processAccount(page, accountUrl, accountNumber, proxy);
            if (accountSuccess) totalSuccessCount++;
            else totalFailureCount++;
        } catch (error) {
            console.error('Error processing account:', error);
            totalFailureCount++;
        } finally {
            await context.close();
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
                    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Hoàn tất tài khoản ${accountNumber}`);
                })
                .catch(() => {
                    activeCount--;
                    console.log(`${RED}Tài khoản ${accountNumber} gặp lỗi`);
                });
        }

        if (activeCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 14000));
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        if (os.loadavg()[0] > 0.7) {
            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}CPU đang cao, tạm dừng 5 giây...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Hoàn tất xử lý tất cả tài khoản \x1b[38;5;231mTool \x1b[38;5;11m[ \x1b[38;5;231mTEMCO \x1b[38;5;11m].`);
    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${SILVER}Tổng tài khoản thành công: ${YELLOW}${totalSuccessCount}`);
    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${SILVER}Tổng tài khoản lỗi: ${YELLOW}${totalFailureCount}`);
}

async function logFailedAccount(accountNumber, errorMessage) {
    fs.appendFileSync(ERROR_LOG_PATH, `Tài khoản số ${accountNumber} gặp lỗi\n`);
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
    const filePath = 'temco.txt';

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
            console.log(`${SILVER}TEMCO Luồng ${LIGHT_PINK}code by ${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] ${RESET}`);
            console.log(`${LIGHT_PINK}tele${YELLOW}: ${PINK}tphuc_0 ${RESET}`);
            console.log(`${GREEN}Hiện tại bạn có ${YELLOW}${nonEmptyLines}${GREEN} tài khoản`);

            const userInput = await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${YELLOW}(${GREEN}hoặc ${YELLOW}'all' ${GREEN}để chạy tất cả${YELLOW}, ${RED}0 ${GREEN}để thoát${YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            });

            let numAccounts;
            if (userInput.toLowerCase() === 'all') {
                numAccounts = links.length;
            } else if (!isNaN(userInput)) {
                numAccounts = parseInt(userInput, 10);
                if (numAccounts <= 0) {
                    break;
                }
                if (numAccounts > links.length) {
                    numAccounts = links.length;
                }
            } else {
                console.log(`${RED}Nhập không hợp lệ!`);
                continue;
            }

            const restTime = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản ${YELLOW}( ${GREEN}Khuyên ${YELLOW}86420 ${GREEN}nha${YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            const repeatCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lần lặp lại sau thời gian nghỉ ngơi ${YELLOW}( ${GREEN}hoặc ${YELLOW}0 ${GREEN}để chạy một lần): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(repeatCount) || repeatCount < 0) {
                console.log(`${RED}Nhập không hợp lệ!${RESET}`);
                continue;
            }

            const instancesCount = parseInt(await new Promise(resolve => {
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập số lượng luồng máy bạn có thể xử lý tài khoản để chạy ${YELLOW}( ${GREEN}Ai máy yếu khuyên  ${YELLOW}6 ${GREEN}nha${YELLOW}): `, (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            }), 10);

            if (isNaN(instancesCount) || instancesCount <= 0) {
                console.log(`${RED}Nhập không hợp lệ!${RESET}`);
                continue;
            }

            for (let i = 0; i <= repeatCount; i++) {
                console.log(`${SILVER}Chạy lần ${GREEN}${i + 1}${RESET}`);
                await runPlaywrightInstances(links.slice(0, numAccounts), proxies, instancesCount);

                if (i < repeatCount) {
                    await countdownTimer(restTime);
                }
            }

            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Đã hoàn tất tất cả các số lần muốn chạy lại.${RESET}`);
        }
    } catch (e) {
        console.log(`${RED}Lỗi${RESET}`);
    }
})();
