const https = require('https');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const os = require('os');
const axios = require('axios');
const chalk = require('chalk');

// URL chứa mã nguồn Node.js và danh sách Key
const codeUrl = 'https://raw.githubusercontent.com/Pocodeonline/Pocodeonline/main/matchain.js';
const keyUrl = 'https://raw.githubusercontent.com/Pocodeonline/Pocodeonline/main/keymatchain.txt';
const keyFilePath = path.join(__dirname, 'keymatchain.txt'); // Đường dẫn tới tệp tin lưu key

// Thông tin GitHub
const repoOwner = 'Pocodeonline';
const repoName = 'Pocodeonline';
const filePath = 'keymatchainused.txt'; // Tên tệp tin trong repository
const githubToken = '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'; // Thay thế bằng token GitHub cá nhân của bạn

// Tạo readline interface để nhập key từ người dùng
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Hàm tải nội dung từ URL
function getContentFromUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', (err) => reject(new Error('Lỗi kết nối mạng')));
    });
}

// Hàm kiểm tra và cập nhật Key
async function checkAndUpdateKey(inputKey) {
    try {
        // Lấy danh sách Key
        const keysContent = await getContentFromUrl(keyUrl);
        const keys = keysContent.split('\n').map(line => line.trim());

        // Kiểm tra Key
        if (!keys.includes(inputKey)) {
            console.log(chalk.red('Key sai hoặc đã được sử dụng ib tele tphuc_0 để xử lý..'));
            return false;
        }

        // Lấy địa chỉ IP và tên thiết bị
        const ip = await getIpAddress();
        const deviceName = getDeviceName();

        // Cập nhật Key với thông tin IP và thiết bị
        const updatedKeysContent = keys.map(line => {
            const [key, ...rest] = line.split(' - ');
            if (key === inputKey) {
                return `${key} - IP: ${ip}, Device: ${deviceName}`;
            }
            return line;
        }).join('\n');

        // Lưu Key vào tệp tin
        fs.writeFileSync(keyFilePath, inputKey);
        console.log(chalk.green('Nhập key thành công...'));

        // Cập nhật thông tin vào tệp tin trên GitHub
        await updateUsedKeysFile(updatedKeysContent);

        return true;
    } catch (error) {
        console.error(chalk.red(`Lỗi khi xử lý Key: ${error.message}`));
        return false;
    }
}

// Hàm lấy địa chỉ IP công cộng
function getIpAddress() {
    return new Promise((resolve, reject) => {
        https.get('https://api.ipify.org?format=text', (res) => {
            if (res.statusCode !== 200) {
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data.trim()));
        }).on('error', (err) => reject(new Error('Lỗi kết nối mạng...')));
    });
}

// Hàm lấy tên thiết bị
function getDeviceName() {
    return os.hostname();
}

// Hàm cập nhật tệp tin trên GitHub
async function updateUsedKeysFile(newContent) {
    try {
        // Lấy nội dung tệp tin hiện tại
        const response = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
            headers: {
                'Authorization': `token ${githubToken}`
            }
        });

        const fileContent = Buffer.from(response.data.content, 'base64').toString();

        // Cập nhật nội dung tệp tin
        await axios.put(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
            message: 'Update used keys',
            content: Buffer.from(newContent).toString('base64'),
            sha: response.data.sha
        }, {
            headers: {
                'Authorization': `token ${githubToken}`
            }
        });
        
    } catch (error) {
    }
}

// Hàm kiểm tra xem Key đã được lưu chưa
async function checkKeySaved() {
    try {
        const key = fs.readFileSync(keyFilePath, 'utf8').trim();
        if (!key) return false;

        const response = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
            headers: {
                'Authorization': `token ${githubToken}`
            }
        });
        const fileContent = Buffer.from(response.data.content, 'base64').toString();

        // Lấy địa chỉ IP và tên thiết bị hiện tại
        const ip = await getIpAddress();
        const deviceName = getDeviceName();

        // Kiểm tra xem key có hợp lệ với IP và thiết bị hiện tại không
        const regex = new RegExp(`^${key} - IP: ${ip}, Device: ${deviceName}`, 'm');
        return regex.test(fileContent);
    } catch (error) {
        console.error(chalk.red(`Lỗi Key...`));
        return false;
    }
}

// Hàm thực thi mã nguồn từ URL
function runCodeFromUrl(url) {
    https.get(url, (res) => {
        if (res.statusCode !== 200) {
            return;
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                console.log(chalk.blue('Đang vào tool...'));
                eval(data);
            } catch (err) {
                console.error(chalk.red(`Đang bảo trì...`));
            }
        });
    }).on('error', (err) => {
        console.error(chalk.red('Lỗi kết nối mạng'));
    });
}

// Hàm chính để chạy chương trình
async function main() {
    const isKeySaved = await checkKeySaved();

    if (isKeySaved) {
        console.log(chalk.green('Key thành công..đang chạy'));
        runCodeFromUrl(codeUrl);
    } else {
        rl.question('Nhập Key: ', async (key) => {
            const isValidKey = await checkAndUpdateKey(key);
            if (isValidKey) {
                runCodeFromUrl(codeUrl);
            }
            rl.close();
        });
    }
}

main();
