const https = require('https');
const fs = require('fs');
const readline = require('readline');
const os = require('os');
const axios = require('axios');

// URL chứa mã nguồn Node.js và danh sách Key
const codeUrl = 'https://raw.githubusercontent.com/Pocodeonline/Pocodeonline/main/matchainsv.js';
const keyFilePath = 'matchainkeyy.txt'; // Tên tệp tin lưu key

// Thông tin GitHub
const repoOwner = 'Pocodeonline';
const repoName = 'Pocodeonline';
const filePath = 'matchainkeyy.txt'; // Tên tệp tin trong repository
const githubToken = ''; // Thay thế bằng token GitHub cá nhân của bạn

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
                return reject(new Error('Lỗi khi tải nội dung'));
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
        // Lấy danh sách Key từ GitHub
        const response = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
            headers: {
                'Authorization': `token ${githubToken}`
            }
        });

        const keysContent = Buffer.from(response.data.content, 'base64').toString();
        const keys = keysContent.split('\n').map(line => line.trim());

        // Lấy địa chỉ IP và tên thiết bị
        const ip = await getIpAddress();
        const deviceName = getDeviceName();

        // Kiểm tra Key
        const keyEntryIndex = keys.findIndex(line => line.startsWith(inputKey));
        if (keyEntryIndex !== -1) {
            const keyEntry = keys[keyEntryIndex];
            if (keyEntry.includes(`IP: ${ip}`) && keyEntry.includes(`Device: ${deviceName}`)) {
                console.log('\x1b[32mKey đã được sử dụng từ IP và Device này\x1b[0m');
                return true; // Key đã được sử dụng từ IP và Device này
            } else if (keyEntry.includes('IP:') || keyEntry.includes('Device:')) {
                console.log('\x1b[31mKey đã được sử dụng, vui lòng nhập Key khác\x1b[0m');
                return false;
            }
        } else {
            console.log('\x1b[31mKey không tồn tại trong danh sách\x1b[0m');
            return false;
        }

        // Cập nhật Key với thông tin IP và thiết bị
        const updatedKeysContent = keys.map((line, index) => {
            if (index === keyEntryIndex) {
                return `${line} - IP: ${ip}, Device: ${deviceName}`;
            }
            return line;
        }).join('\n');

        // Cập nhật thông tin vào tệp tin trên GitHub
        await updateUsedKeysFile(updatedKeysContent);

        // Lưu Key vào tệp tin
        fs.writeFileSync(keyFilePath, inputKey);
        console.log('\x1b[32mNhập Key thành công...\x1b[0m');

        return true;
    } catch (error) {
        console.error('\x1b[31mLỗi khi xử lý Key...\x1b[0m', error.message);
        return false;
    }
}

// Hàm lấy địa chỉ IP công cộng
function getIpAddress() {
    return new Promise((resolve, reject) => {
        https.get('https://api.ipify.org?format=text', (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error('Lỗi khi lấy địa chỉ IP'));
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data.trim()));
        }).on('error', (err) => reject(new Error('Lỗi kết nối mạng')));
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
        console.error('\x1b[31mLỗi khi cập nhật tệp tin trên GitHub\x1b[0m', error.message);
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
        console.error('\x1b[31mLỗi khi kiểm tra Key...\x1b[0m', error.message);
        return false;
    }
}

// Hàm thực thi mã nguồn từ URL
function runCodeFromUrl(url) {
    https.get(url, (res) => {
        if (res.statusCode !== 200) {
            return console.error('\x1b[31mLỗi khi tải mã nguồn\x1b[0m');
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                console.log('\x1b[34mĐang vào tool...\x1b[0m');
                eval(data);
            } catch (err) {
                console.error('\x1b[31mLỗi khi thực thi mã nguồn\x1b[0m', err.message);
            }
        });
    }).on('error', (err) => {
        console.error('\x1b[31mLỗi kết nối mạng\x1b[0m', err.message);
    });
}

// Hàm chính để chạy chương trình
async function main() {
    const isKeySaved = await checkKeySaved();

    if (isKeySaved) {
        console.log('\x1b[32mKey hợp lệ... Đang chạy\x1b[0m');
        runCodeFromUrl(codeUrl);
    } else {
        rl.question('Nhập Key: ', async (key) => {
            const isValidKey = await checkAndUpdateKey(key);
            if (isValidKey) {
                runCodeFromUrl(codeUrl);
            } else {
                console.log('\x1b[33mVui lòng nhập Key khác.\x1b[0m');
                rl.close();
                main(); // Gọi lại hàm chính để nhập Key mới
            }
        });
    }
}

main();
