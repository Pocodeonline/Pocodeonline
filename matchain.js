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

// Utility functions
async function countNonEmptyLines(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return reject(err);
            const lines = data.split('\n').filter(line => line.trim() !== '');
            resolve(lines.length);
        });
    });
}

async function readAccounts(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) return reject(err);
            const lines = data.split('\n').filter(line => line.trim() !== '');
            resolve(lines);
        });
    });
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

// Playwright setup
async function runChromeInstances(links, numAccounts) {
    const doneFilePath = path.join(__dirname, 'done_acc.txt');
    
    const browser = await chromium.launch({
        headless: false, // Change to true if you want to run in headless mode
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-popup-blocking',
            '--disable-infobars',
            '--remote-debugging-port=0',
            '--load-extension=' + path.join(__dirname, 'Bypass')
        ]
    });

    for (let i = 0; i < numAccounts; i++) {
        const accountUrl = links[i];
        console.log(`${COLORS.YELLOW}🐮 Đang chạy tài khoản ${i+1}/${numAccounts}: ${accountUrl}`);

        const page = await browser.newPage();

        // Navigate to the account URL
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
                console.log(`${COLORS.GREEN}Đã bỏ qua câu hỏi acc ${i+1}`);
            } else {
                console.log(`${COLORS.RED}Không tìm thấy nút bỏ qua trong vòng 5 giây ở acc ${i+1}`);
            }
        } catch (err) {
            console.log(`${COLORS.RED}Lỗi khi kiểm tra nút bỏ qua ở acc ${i+1}: ${err}`);
        }

        // Check for page load
        const pageLoadedSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_balance___ClINX";
        await page.waitForSelector(pageLoadedSelector, { timeout: 30000 });
        console.log(`${COLORS.GREEN}Đã Vào Giao diện ${await page.title()} Acc ${i+1}`);

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
                console.log(`${COLORS.CYAN}Chờ để số điểm cập nhật ở acc ${i+1}...`);
            }
        } while (randomNumber === '0.0000');

        const currentBalanceSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_mining___mBJYP > p";
        const currentBalance = await page.textContent(currentBalanceSelector);

        console.log(`${COLORS.GREEN}Số điểm đã đào của acc ${i+1}: ${randomNumber}`);
        console.log(`${COLORS.GREEN}Số dư hiện tại của acc ${i+1}: ${currentBalance}`);

        // Click claim button
        const claimButtonSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka";
        let claimButton;
        do {
            try {
                claimButton = await page.locator(claimButtonSelector);
                await claimButton.click();
                console.log(`${COLORS.GREEN}Đang claim acc ${i+1}`);
            } catch (err) {
                console.log(`${COLORS.RED}Chưa thấy claim acc, chờ thêm một chút : ${err}`);
                await page.waitForTimeout(5000);
            }
        } while (!claimButton);

        // Confirm claim process
        const claimProcessedSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.btn_claim___AC3ka.farming____9oEZ";
        await page.waitForSelector(claimProcessedSelector, { timeout: 30000 });
        console.log(`${COLORS.GREEN}Claim thành công ${randomNumber} acc ${i+1}`);
        await page.locator(claimProcessedSelector).click();
        console.log(`${COLORS.GREEN}Đang cho acc đào tiếp ${i+1}`);
        await page.waitForTimeout(400);

        // Print remaining time
        const countdownHoursSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_countdown___G04z1 > ul > li:nth-child(1) > p";
        const countdownMinutesSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_countdown___G04z1 > ul > li:nth-child(2) > p";
        const countdownSecondsSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_countdown___G04z1 > ul > li:nth-child(3) > p";

        const hours = await page.textContent(countdownHoursSelector);
        const minutes = await page.textContent(countdownMinutesSelector);
        const seconds = await page.textContent(countdownSecondsSelector);

        console.log(`${COLORS.YELLOW}Thời gian còn lại cho acc ${i+1}: ${hours.padStart(2, '0')}h ${minutes.padStart(2, '0')}m ${seconds.padStart(2, '0')}s`);
        await page.waitForTimeout(300);

        // New steps for x2 points
        const x2IndicatorSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container___Joeqw > div.item___aAzf7.left_item___po1MT > div > div.content_top___biYaq";
        const x2Indicator = await page.waitForSelector(x2IndicatorSelector, { timeout: 30000 });
        await x2Indicator.click();
        console.log(`${COLORS.GREEN}Bắt đầu mua x2`);
        console.log(`${COLORS.GREEN}Đang mua....`);
        await page.waitForTimeout(600);

        // Confirm purchase
        const buyButtonSelector = "#root > div > div.container___tYOO7 > div.content___xItdF > div.btn___FttFE";
        const buyButton = await page.waitForSelector(buyButtonSelector, { timeout: 30000 });
        await buyButton.click();
        console.log(`${COLORS.GREEN}Xác nhận thành công`);
        await page.waitForTimeout(500);

        // Check points
        const pointsSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container___Joeqw > div.item___aAzf7.left_item___po1MT > div > div.content_bottom___dCWi7 > div > div.points___ya4CK";
        const points = await page.textContent(pointsSelector);

        const balancenewsSelector = "#root > div > div > div.content___jvMX0.home___efXf1 > div.container_mining___mBJYP > p";
        const balancenews = await page.textContent(balancenewsSelector);

        console.log(` - ${points}`);
        console.log(`Số dư hiện tại: ${balancenews}`);

        // Remove account from the file and move to done file
        await removeDoneAccount('acc.txt', doneFilePath, accountUrl);

        console.log(`${COLORS.GREEN}Đã xử lý thành công tài khoản ${i+1}`);
        await page.close();
    }

    await browser.close();
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

async function main() {
    await printCustomLogo(true);
    console.log(`${COLORS.FLAME_ORANGE}MATCHAIN🔥 ${COLORS.LIGHT_PINK}code by 🐮`);
    console.log(`${COLORS.LIGHT_PINK}tele ${COLORS.YELLOW}:${COLORS.GREEN} tphuc_0`);

    const filePath = 'acc.txt';
    const doneFilePath = 'done_acc.txt';

    if (!fs.existsSync(filePath)) {
        while (true) {
            const response = await new Promise(resolve => readline.createInterface({
                input: process.stdin,
                output: process.stdout
            }).question(`${COLORS.RED}Bạn chưa có file acc.txt, hãy tạo và thêm vào. Bạn đã tạo và thêm chưa? (y/n): `, resolve));
            if (response.trim().toLowerCase() === 'y') break;
            if (response.trim().toLowerCase() === 'n') {
                const exitResponse = await new Promise(resolve => readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                }).question(`${COLORS.RED}Bạn vẫn chưa tạo? Có muốn thoát không? (y/n): `, resolve));
                if (exitResponse.trim().toLowerCase() === 'y') {
                    console.log(`${COLORS.YELLOW}Quá trình đã bị hủy.`);
                    return;
                }
            }
        }
    }

    try {
        const totalAccounts = await countNonEmptyLines(filePath);
        const doneAccountsCount = await countNonEmptyLines(doneFilePath);

        console.log(`${COLORS.PINK}Số tài khoản chưa xử lý: ${totalAccounts}`);
        console.log(`${COLORS.GREEN}Số tài khoản đã xử lý: ${doneAccountsCount}`);

        const userInput = await new Promise(resolve => readline.createInterface({
            input: process.stdin,
            output: process.stdout
        }).question(`${COLORS.GREEN}Nhập số lượng tài khoản muốn 🐮 chạy ${COLORS.YELLOW}(${COLORS.GREEN}hoặc '${COLORS.YELLOW}all${COLORS.GREEN}' để chạy tất cả, hoặc${COLORS.RED} 0 để thoát${COLORS.YELLOW}): `, resolve));

        if (userInput.trim() === '0') {
            console.log(`${COLORS.YELLOW}Quá trình đã bị hủy.`);
            return;
        }

        let numAccounts;
        if (userInput.trim().toLowerCase() === 'all') {
            numAccounts = totalAccounts;
        } else {
            numAccounts = parseInt(userInput.trim(), 10);
            if (isNaN(numAccounts) || numAccounts > totalAccounts || numAccounts < 1) {
                console.log(`${COLORS.RED}Số lượng tài khoản không hợp lệ. Sẽ chạy tất cả ${totalAccounts} tài khoản.`);
                numAccounts = totalAccounts;
            }
        }

        const links = await readAccounts(filePath);
        await runChromeInstances(links, numAccounts);

    } catch (err) {
        console.log(`${COLORS.RED}Lỗi: ${err}`);
    }
}

main();
