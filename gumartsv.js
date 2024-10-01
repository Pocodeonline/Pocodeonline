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
        "ĐANG VÀO TOOL GUMART..."
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

async function processAccount(browserContext, accountUrl, accountNumber, proxy) {
    const page = await browserContext.newPage();
    const maxRetries = 3; // Số lần tối đa để thử lại
    const retryDelay = 3000; // Thời gian chờ giữa các lần thử lại (2000ms = 2 giây)
    let success = false;

    // Thực hiện các thử lại
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}🐮 Đang chạy tài khoản \x1b[38;5;11m${accountNumber} \x1b[38;5;207mIP \x1b[38;5;11m:\x1b[38;5;13m${proxy.server}${RESET}`);
            await page.goto(accountUrl, { waitUntil: 'networkidle' });

            const pageLoadedSelector = "#__nuxt > div > div > div.fixed.bottom-0.w-full.left-0.z-\\[12\\] > div > div.grid.grid-cols-5.w-full.gap-2 > button:nth-child(3) > div > div.w-\\[4rem\\].h-\\[4rem\\].absolute.-translate-y-\\[50\\%\\].shadow_filter > img";
            await page.waitForSelector(pageLoadedSelector, { timeout: 6000 });
            console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Đã vào giao diện ${await page.title()} Acc \x1b[38;5;11m${accountNumber}${RESET}`);

            // Handle optional skip button
            const skipButtonSelector = "#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > div > div > div > div.transition-all > button";
            const pointTextSelector = "#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > div > div > div > div.flex.gap-2.items-center > div > div.w-full.flex.justify-between > div:nth-child(2) > p";
            const balanceTextSelector = "#__nuxt > div > div > section > div.w-full.flex.flex-col.gap-4.px-4.py-2.relative.z-\\[3\\] > div.flex.flex-col.gap-2.items-center > div > p";
            try {
                const pointTextElement = await page.waitForSelector(pointTextSelector, { timeout: 2500 });
                const balanceTextElement = await page.waitForSelector(balanceTextSelector, { timeout: 2500 });
                let pointText = "N/A";  // Giả định giá trị mặc định nếu không lấy được
                if (pointTextElement) {
                    pointText = await page.evaluate(el => el.innerText, pointTextElement);
                }
                let balanceText = "N/A";  // Giả định giá trị mặc định nếu không lấy được
                if (balanceTextElement) {
                    balanceText = await page.evaluate(el => el.innerText, balanceTextElement);
                }
            
                const skipButton = await page.waitForSelector(skipButtonSelector, { timeout: 2000 });
                if (skipButton) {
                    // Hiển thị pointText trong console trước khi bấm
                    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Số Dư acc \x1b[38;5;11m${accountNumber}: \x1b[38;5;12m${balanceText} ${GREEN}Claim \x1b[38;5;11m+${pointText} ${GREEN}point thành công...${RESET}`);
                    // Click vào nút skip
                    await skipButton.click();
                }
            } catch (err) {
                console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Acc \x1b[38;5;11m${accountNumber}${RED} không claim được...${RESET}`);
            }
            
            const imgSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > button > div';
            let imgElementFound = true;
    
            try {
                await page.waitForSelector(imgSelector, { visible: true, timeout: 2000 });
                await page.click(imgSelector);
                await page.waitForTimeout(2000);
                imgElementFound = false;
            } catch (error) {
                imgElementFound = true;
            }
    
            // Nếu phần tử img không được tìm thấy, in ra thời gian còn lại
            if (!imgElementFound) {
                const timeSelector = '#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > button > div > div';
                const timeElement = await page.waitForSelector(timeSelector, { timeout: 3000 });
                const time = await timeElement.evaluate(el => el.innerText);
                console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}X2 của tài khoản ${YELLOW}${accountNumber} còn ${time} mới mua lại tiếp được...`);
            }
                success = true;

            break;
        } catch (error) {
            if (attempt < maxRetries) {
                console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Đang thử lại acc ${YELLOW}${accountNumber} ${RED}lần${YELLOW} ${attempt + 1}`);
                await page.reload({ waitUntil: 'networkidle' });
            } else {
                // Lưu thông tin lỗi nếu tất cả các lần thử đều không thành công
                console.error(`${RED}Tài khoản số ${accountNumber} gặp lỗi`);
                await logFailedAccount(accountNumber, error.message);
            }
        }
    }

    try {
        // Đảm bảo đóng trang sau khi hoàn thành
        await page.close();
    } catch (closeError) {
        console.error(`${RED}Không thể đóng trang: ${closeError.message}`);
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
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-cpu',
                `--proxy-server=${proxy.server}`
            ]
        });

        const browserContext = await browser.newContext({
            httpCredentials: {
                storageState: null,
                username: proxy.username,
                password: proxy.password
            },
            bypassCSP: true,
        });

        let accountSuccess = false;
        try {
            accountSuccess = await processAccount(browserContext, accountUrl, accountNumber, proxy);
            if (accountSuccess) totalSuccessCount++;
            else totalFailureCount++;
        } catch (error) {
            console.error('Error processing account:', error);
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

        // Thêm đoạn code để giảm tải CPU
        await new Promise(resolve => setTimeout(resolve, 1000)); // Nghỉ 1 giây sau mỗi vòng lặp
        if (os.loadavg()[0] > 0.7) { // Nếu tải CPU trung bình trong 1 phút vượt quá 70%
            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}CPU đang cao, tạm dừng 5 giây...`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Nghỉ thêm 5 giây
        }
    }

    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Hoàn tất xử lý tất cả tài khoản \x1b[38;5;231mTool \x1b[38;5;11m[ \x1b[38;5;231mGUMART CLAIM X2 \x1b[38;5;11m].`);
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
                rl.question(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản ${YELLOW}( ${GREEN}Khuyên ${YELLOW}9000 ${GREEN}nha${YELLOW}): `, (answer) => {
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

            // Thêm đoạn mã yêu cầu số lượng trong hàm runPlaywrightInstances
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
