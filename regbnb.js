const ethers = require('ethers');
const fs = require('fs').promises;
const readline = require('readline');

const SILVER = '\x1b[38;5;231m';
const LIGHT_PINK = '\x1b[38;5;207m';
const PINK = '\x1b[38;5;13m';
const YELLOW = '\x1b[38;5;11m';
const GREEN = '\x1b[38;5;10m';
const RED = '\x1b[38;5;9m';
const LIGHT_BLUE = '\x1b[38;5;12m';
const DARK_BLUE = '\x1b[38;5;19m';
const RESET = '\x1b[0m';

// Tạo giao diện để hỏi người dùng số lượng ví muốn tạo
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Hàm tạo ví và lưu địa chỉ, private key vào file
async function createWallets(numberOfWallets) {
  let addresses = '';
  let privateKeys = '';

  // Tạo ví mới và lưu địa chỉ, private key vào chuỗi
  for (let i = 0; i < numberOfWallets; i++) {
    const wallet = ethers.Wallet.createRandom();
    addresses += wallet.address + '\n';
    privateKeys += wallet.privateKey + '\n';
  }

  // Ghi địa chỉ ví vào file addresses.txt
  await fs.writeFile('addresses.txt', addresses);
  console.log(`${GREEN}Đã lưu địa chỉ ví vào file addresses.txt`);

  // Ghi private keys vào file privateKeys.txt
  await fs.writeFile('privateKeys.txt', privateKeys);
  console.log(`${GREEN}Đã lưu private keys vào file privateKeys.txt`);
}

// Hỏi người dùng muốn tạo bao nhiêu ví
rl.question(`${YELLOW}[ \x1b[38;5;231mWKOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Bạn muốn tạo bao nhiêu ví${YELLOW}: `, (answer) => {
  const numberOfWallets = parseInt(answer);

  if (isNaN(numberOfWallets) || numberOfWallets <= 0) {
    console.log('Vui lòng nhập một số hợp lệ.');
  } else {
    createWallets(numberOfWallets);
  }

  rl.close();
});
