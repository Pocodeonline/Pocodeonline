const axios = require('axios');
const fs = require('fs');
const colors = require('colors');
const { HttpsProxyAgent } = require('https-proxy-agent');
const readline = require('readline');


const SILVER = '\x1b[38;5;231m';
const LIGHT_PINK = '\x1b[38;5;207m';
const PINK = '\x1b[38;5;13m';
const YELLOW = '\x1b[38;5;11m';
const GREEN = '\x1b[38;5;10m';
const RED = '\x1b[38;5;9m';
const LIGHT_BLUE = '\x1b[38;5;12m';
const RESET = '\x1b[0m';

const proxies = fs.readFileSync('proxy.txt', 'utf8').split('\n').filter(Boolean);
let queries = [];
try {
  const data = fs.readFileSync('query.txt', 'utf8');
  queries = data.split('\n').map(line => line.trim()).filter(line => line !== '');
  console.log(`${GREEN}Hiện Bạn Có Tổng ${YELLOW}${queries.length} ${GREEN}Tài Khoản `);
} catch (err) {
  console.error(`${RED}Không thể đọc file query.txt:`, err);
  process.exit(1);
}

let currentQueryIndex = 0;
let currentProxyIndex = 0;
let upgradeSpinner = false;
function getCurrentQueryId() {
  return queries[currentQueryIndex];
}

function getNextProxy() {
  const proxy = proxies[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % proxies.length;
  return proxy;
}

async function changeProxy() {
  const proxy = getNextProxy();
  const proxyAgent = new HttpsProxyAgent(proxy);
  await checkProxyIP(proxyAgent);
  return proxyAgent;
}

function nextQueryId() {
  currentQueryIndex += 1;
  if (currentQueryIndex >= queries.length) {
    currentQueryIndex = 0;
    console.log(`${GREEN}Đã spin hết tất cả tài khoản`);
    return false;
  } else {
    const initData = getCurrentQueryId();
    const decoded = decodeURIComponent(initData);
    const userPattern = /user=([^&]+)/;
    const userMatch = decoded.match(userPattern);
    if (userMatch && userMatch[1]) {
      const userInfoStr = userMatch[1];
      try {
        const userInfo = JSON.parse(userInfoStr);
        console.log(`${LIGHT_PINK}➔ ${GREEN}Tài khoản ${SILVER}[ ${LIGHT_BLUE}${userInfo.first_name} ${userInfo.last_name}${SILVER} ]`);
      } catch (error) {
        console.error(`${RED}Lỗi phân tích thông tin người dùng:`, error);
      }
    } else {
      console.log(`${RED}Không thể tìm thông tin người dùng trong initData`);
    }
  }
  return true;
}

function getClick() {
  return Math.floor(Math.random() * 11) + 20;
}

let payloadspin = {
  "initData": getCurrentQueryId(),
  "data": { "clicks": getClick(), "isClose": null }
};

async function callSpinAPI(proxyAgent) {
  payloadspin.initData = getCurrentQueryId();
  try {
    await axios.post('https://back.timboo.pro/api/upd-data', payloadspin, {
      headers: {
        'Content-Type': 'application/json'
      },
      httpsAgent: proxyAgent
    });
  } catch (error) {
    if (error.response && error.response.data.message === 'Data acquisition error1') {
      console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Tài khoản này chưa đến giờ spin${SILVER}| ${GREEN}chuyển tài khoản tiếp theo${YELLOW}...`);
      const hasNextQuery = nextQueryId();
      if (hasNextQuery) {
        proxyAgent = await changeProxy();
      } else {
        console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Đã spin hết tất cả tài khoản.`);
      }
    }
  }
}


async function callRepairAPI(proxyAgent) {
  const payloadRepairAPI = {
    "initData": getCurrentQueryId()
  };

  try {
    await axios.post('https://back.timboo.pro/api/repair-spinner', payloadRepairAPI, {
      headers: {
        'Content-Type': 'application/json'
      },
      httpsAgent: proxyAgent
    });

    console.log(`Sửa spin thành công`);
  } catch (error) {
    handleAPIError(error, 'repair API');
  }
}

async function spinAllSpinners(proxyAgent) {
  const payloadlayData = {
    "initData": getCurrentQueryId()
  };

  try {
    let response = await axios.post('https://back.timboo.pro/api/init-data', payloadlayData, {
      headers: {
        'Content-Type': 'application/json'
      },
      httpsAgent: proxyAgent
    });

    let responseData = response.data;
    let spinners = responseData.initData.spinners;

    while (spinners.some(spinner => !spinner.isBroken)) {
      const spinPromises = spinners.filter(spinner => !spinner.isBroken).map(spinner => callSpinAPI(proxyAgent));
      await Promise.all(spinPromises);

      response = await axios.post('https://back.timboo.pro/api/init-data', payloadlayData, {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: proxyAgent
      });

      responseData = response.data;
      spinners = responseData.initData.spinners;

      const { balance, league } = responseData.initData.user;
      const spinnerHPs = spinners.map(s => s.hp);
      console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Spin thành công${YELLOW}: ${GREEN}Balance${YELLOW}: ${balance} ${SILVER}| ${GREEN}League${YELLOW}: ${league.name} ${SILVER}| ${GREEN}Spinner HP${YELLOW}: ${spinnerHPs.join(', ')}`);
    }

    const brokenSpinners = spinners.filter(spinner => spinner.isBroken && spinner.endRepairTime === null);
    if (brokenSpinners.length > 0) {
      await callRepairAPI(proxyAgent);
    }
  } catch (error) {
    handleAPIError(error, 'spinAllSpinners function');
  }
}

function countdown(duration) {
  let remaining = duration;

  const countdownInterval = setInterval(() => {
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;

    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    process.stdout.write(`\r${GREEN}Thời gian còn lại${YELLOW}:${YELLOW} ${timeString}`);

    remaining -= 1;

    if (remaining < 0) {
      clearInterval(countdownInterval);
      process.stdout.write('\rHoàn tất!                \n');
    }
  }, 1000);
}

async function layData(proxyAgent) {
  await checkAndOpenBox(proxyAgent);
  const spinnerId = await getSpinnerId(proxyAgent);
  if (upgradeSpinner && spinnerId) {
    await callUpgradeAPI(proxyAgent, spinnerId);
  }
  await spinAllSpinners(proxyAgent);
  const hasNextQuery = nextQueryId();
  if (!hasNextQuery) {
    const endRepairTime = await getEndRepairTime(proxyAgent);
    if (endRepairTime) {
      const now = new Date();
      const nowUTC = new Date(now.toISOString()); 
      const waitTime = endRepairTime.getTime() - nowUTC.getTime();  
      if (waitTime > 0) {
        console.log(`Chờ đến thời gian: ${endRepairTime.toISOString()}`);
        countdown(waitTime / 1000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    return;
  }
  proxyAgent = await changeProxy();
}
async function callUpgradeAPI(proxyAgent, spinnerId) {
  const payloadUpgradeAPI = {
    "initData": getCurrentQueryId(),
    "spinnerId": spinnerId
  };

  while (true) {
    try {
      await axios.post('https://back.timboo.pro/api/upgrade-spinner', payloadUpgradeAPI, {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent: proxyAgent
      });

      console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Nâng cấp spinner thành công`);
    } catch (error) {
      if (error.response && error.response.data.message === "Error, the spinner hasn't upgraded.") {
        console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Không thể nâng spin do max hoặc chưa đủ điểm${YELLOW}...`);
        break;
      } else {
        handleAPIError(error, 'upgrade-spinner API');
      }
    }
  }
}
async function getSpinnerId(proxyAgent) {
  const payload = {
    "initData": getCurrentQueryId()
  };

  try {
    const response = await axios.post('https://back.timboo.pro/api/init-data', payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      httpsAgent: proxyAgent
    });

    if (response.status === 200 && response.data && response.data.initData && response.data.initData.spinners) {
      const spinners = response.data.initData.spinners;
      if (spinners.length > 0) {
        return spinners[0].id; 
      }
    } else {
      console.log(`${RED}Không nhận được spinner ID từ API.`);
    }
  } catch (error) {
    handleAPIError(error, 'getSpinnerId API');
  }
  return null;
}
async function askForUpgrade() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(`${GREEN}Bạn có muốn nâng cấp spinner này không? ${YELLOW}(${GREEN}y${SILVER}/${RED}n${YELLOW}):  `, (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'n') {
        upgradeSpinner = answer.toLowerCase() === 'y';
        rl.close();
        resolve();
      } else {
        console.error(`${RED}Trả lời không hợp lệ. Vui lòng nhập ${YELLOW}"${GREEN}y${YELLOW}" ${RED}hoặc ${YELLOW}"${RED}n${YELLOW}".`);
        rl.close();
        process.exit(1);
      }
    });
  });
}
async function getEndRepairTime(proxyAgent) {
  const payload = {
    "initData": getCurrentQueryId()
  };

  try {
    const response = await axios.post('https://back.timboo.pro/api/init-data', payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      httpsAgent: proxyAgent
    });

    if (response.status === 200 && response.data) {
      if (!response.data.initData.spinners || response.data.initData.spinners.length === 0 || !response.data.initData.spinners[0].endRepairTime) {
        console.log(`${RED}Không có thông tin endRepairTime từ API.`);
        return null;
      }

      const endRepairTime = new Date(response.data.initData.spinners[0].endRepairTime);
      endRepairTime.setHours(endRepairTime.getHours()); 
      endRepairTime.setMinutes(endRepairTime.getMinutes() + 30); 
      return endRepairTime;
    } else {
      console.log(`${RED}Không nhận được endRepairTime từ API.`, response.data);
    }
  } catch (error) {
    handleAPIError(error, 'getEndRepairTime API');
  }

  return null;
}

function shouldOpenBox(box) {
  const nowUTC = Date.now();

  const openTimeUTC = box.open_time ? new Date(box.open_time).getTime() : null;

  if (!openTimeUTC) {
    console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN}Đang mở hộp ngay.`);
    return true;
  }

  const fiveHoursInMillis = 5 * 60 * 60 * 1000;
  const fiveHoursAfterOpenTimeUTC = openTimeUTC + fiveHoursInMillis;

  return nowUTC > fiveHoursAfterOpenTimeUTC;
}

async function checkAndOpenBox(proxyAgent) {
  console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Đang kiểm tra và mở hộp${YELLOW}...`);
  const payload = {
    "initData": getCurrentQueryId()
  };

  try {
    const response = await axios.post('https://api.timboo.pro/get_data', payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      httpsAgent: proxyAgent
    });

    if (response.status === 200 && response.data && response.data.boxes) {
      const boxes = response.data.boxes;

      const boxToOpen = boxes.find(box => shouldOpenBox(box));

      if (boxToOpen) {
        console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Mở hộp ${boxToOpen.name}...`);
        const openBoxPayload = {
          "initData": getCurrentQueryId(),
          "boxId": boxToOpen.id
        };

        try {
          const openBoxResponse = await axios.post('https://api.timboo.pro/open_box', openBoxPayload, {
            headers: {
              'Content-Type': 'application/json'
            },
            httpsAgent: proxyAgent
          });
          if (openBoxResponse.status === 200) {
            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Đã mở hộp ${boxToOpen.name}.`);
          } else {
            console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Mở hộp thất bại với mã trạng thái:`, openBoxResponse.status);
          }
        } catch (error) {
          console.error(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Chưa đến thời gian mở hộp${YELLOW}...`);
        }
      } else {
        console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${RED}Không có hộp nào để mở.`);
      }
    } else {
      console.log(`${RED}Không nhận được dữ liệu hộp hợp lệ từ API.`);
    }
  } catch (error) {
    handleAPIError(error, 'checkAndOpenBox API');
  }
}

async function checkProxyIP(proxyAgent) {
  try {
    const response = await axios.get('https://api.ipify.org?format=json', {
      httpsAgent: proxyAgent
    });
    if (response.status === 200) {
      console.log(`${YELLOW}[ \x1b[38;5;231mWIT KOEI \x1b[38;5;11m] \x1b[38;5;207m• ${GREEN} Địa chỉ IP là${YELLOW}:${LIGHT_BLUE} `, response.data.ip);
    } else {
      console.error('Không thể kiểm tra IP của proxy. Status code:', response.status);
    }
  } catch (error) {
    console.error('Error khi kiểm tra IP của proxy:', error);
  }
}

function handleAPIError(error, apiName) {
  if (error.response) {
    console.error(`Lỗi ${apiName}:`, error.response.data);
    console.error('Trạng thái:', error.response.status);
  } else if (error.request) {
    console.error(`Không nhận được phản hồi từ ${apiName}:`, error.request);
  } else {
    console.error(`${RED}Lỗi rồi ${apiName}:`, error.message);
  }
}

async function startLoop() {
  await askForUpgrade(); 
  let proxyAgent = await changeProxy();

  while (true) {
    await layData(proxyAgent);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

startLoop();
