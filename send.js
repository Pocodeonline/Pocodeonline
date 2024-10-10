const ethers = require('ethers');
const fs = require('fs').promises;
require('dotenv').config();

const SILVER = '\x1b[38;5;231m';
const LIGHT_PINK = '\x1b[38;5;207m';
const PINK = '\x1b[38;5;13m';
const YELLOW = '\x1b[38;5;11m';
const GREEN = '\x1b[38;5;10m';
const RED = '\x1b[38;5;9m';
const LIGHT_BLUE = '\x1b[38;5;12m';
const DARK_BLUE = '\x1b[38;5;19m';
const RESET = '\x1b[0m';

// Đọc private key từ file node viroubnb.txt
const privateKeyFile = 'vichinhsharebnb.txt';
fs.readFile(privateKeyFile, 'utf-8').then(data => {
  const privateKey = data.trim();

  if (!privateKey) {
    console.error('Vui lòng cung cấp PRIVATE_KEY trong file viroubnb.txt');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider('https://rpc.matchain.io');
  const wallet = new ethers.Wallet(privateKey, provider);

  // Số lượng BNB cần gửi cho mỗi địa chỉ
  const amountToSend = ethers.parseEther('0.0000074');

  async function multiSend() {
    console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Đang Bắt Đầu Gửi BNB...`);

    try {
      const fileContent = await fs.readFile('diachividesharebnb.txt', 'utf-8');
      const addresses = fileContent.split('\n').filter(Boolean).map(address => address.trim());

      for (const [index, address] of addresses.entries()) {
        try {
          const tx = await wallet.sendTransaction({
            to: address,
            value: amountToSend
          });

          console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Đã gửi ${ethers.formatEther(amountToSend)} BNB đến ${address}`);
          console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Hash giao dịch: ${tx.hash}`);
          await tx.wait();
          console.log(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Giao dịch đã được xác nhận acc ${index + 1}`);

        } catch (error) {
          console.error(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED} Lỗi khi gửi đến ${address}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Lỗi khi đọc file hoặc xử lý giao dịch:', error);
    }

    console.log(`${GREEN} Hoàn thành gửi BNB`);
  }

  multiSend().catch(console.error);
}).catch(console.error);
