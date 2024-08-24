import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from colorama import Fore, Style, init
from selenium.common.exceptions import NoSuchElementException

PINK = '\033[38;5;13m'
RED = '\033[38;5;9m'
YELLOW = '\033[38;5;11m'
GREEN = '\033[38;5;10m'
LIGHT_PINK = '\033[38;5;207m'
BLINK = '\033[5m'
RESET = '\033[0m'
FLAME_ORANGE = '\033[38;5;208m'
SILVER = '\033[38;5;231m'
# Initialize colorama
init(autoreset=True)

def count_non_empty_lines(file_path):
    """Đếm số dòng không trống trong file."""
    if not os.path.exists(file_path):
        return 0
    with open(file_path, 'r') as file:
        lines = file.readlines()
        non_empty_lines = [line.strip() for line in lines if line.strip()]
        return len(non_empty_lines)

def read_accounts(file_path):
    """Đọc các tài khoản từ file và loại bỏ các dòng trống."""
    with open(file_path, 'r') as file:
        links = file.readlines()
    return [link.strip() for link in links if link.strip()]

def print_custom_logo(blink=False):
    logo = [
        " 🛒🛒🛒    🛒       🛒  🛒      🛒      🛒🛒      🛒🛒🛒  🛒🛒🛒🛒🛒 ",
        "🛒    🛒   🛒       🛒  🛒🛒  🛒🛒     🛒  🛒     🛒    🛒    🛒 ",
        "🛒         🛒       🛒  🛒 🛒🛒 🛒    🛒🛒🛒🛒    🛒    🛒    🛒",
        "🛒   🛒🛒  🛒       🛒  🛒  🛒  🛒   🛒      🛒   🛒🛒🛒🛒    🛒 ",
        "🛒    🛒   🛒       🛒  🛒      🛒  🛒        🛒  🛒    🛒    🛒",
        " 🛒🛒🛒     🛒🛒🛒🛒🛒  🛒      🛒 🛒          🛒 🛒     🛒   🛒",
        "                                                                         ",
        "chờ một lát..."
    ]
    os.system('cls' if os.name == 'nt' else 'clear')
    for _ in range(5):
        if blink:
            print(f"{BLINK}{GREEN}" + "\n".join(logo) + RESET)
        else:
            print(f"{BLINK}{GREEN}" + "\n".join(logo))
        time.sleep(0.3)
        os.system('cls' if os.name == 'nt' else 'clear')
        time.sleep(0.3)

def wait_for_element(driver, selector, timeout=30):
    """Chờ cho phần tử có mặt trên trang."""
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
    )

def click_element_js(driver, selector):
    """Nhấp vào phần tử bằng JavaScript."""
    js_script = f"document.querySelector('{selector}').click();"
    driver.execute_script(js_script)

def click_element_xpath(driver, xpath):
    """Nhấp vào phần tử bằng XPath."""
    element = WebDriverWait(driver, 30).until(
        EC.presence_of_element_located((By.XPATH, xpath))
    )
    element.click()

def click_element_if_exists(driver, xpath):
    """Nhấp vào phần tử nếu nó tồn tại."""
    try:
        element = WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.XPATH, xpath))
        )
        element.click()
        return True
    except NoSuchElementException:
        return False

def run_chrome_instances(links, num_accounts, rest_time):
    """Chạy các phiên bản Chrome với các liên kết tài khoản và nghỉ ngơi sau khi hoàn tất."""
    chrome_options = Options()
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-popup-blocking")
    chrome_options.add_argument("--disable-infobars")
    chrome_options.add_argument("--remote-debugging-port=0")

    while True:
        # Chạy theo từng khối tài khoản
        for start in range(0, len(links), num_accounts):
            end = min(start + num_accounts, len(links))
            current_links = links[start:end]
            
            for i, account_url in enumerate(current_links):
                print(f"{Fore.GREEN}🐮 Đang chạy tài khoản {FLAME_ORANGE} {start+i+1}{YELLOW}/{LIGHT_PINK}{len(links)}")
                driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
                driver.get(account_url)
                time.sleep(2)
                try:
                    # Check for page load
                    page_loaded_selector = "#__nuxt > div > div > section > div > div > div.flex.gap-1.mb-4 > p"
                    WebDriverWait(driver, 30).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, page_loaded_selector))
                    )
                    print(f"{Fore.GREEN}Đã Vào Giao diện {driver.title} Acc {FLAME_ORANGE} {start+i+1}")
                    time.sleep(4)
                    # Click to start
                    start_button_selector = "#__nuxt > div > div > section > div > button > p"
                    WebDriverWait(driver, 5).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, start_button_selector))
                    )
                    click_element_js(driver, start_button_selector)
                    time.sleep(3)
                    # Wait for Capital Starting
                    for attempt in range(5):
                        try:
                            capital_started_selector = "#__nuxt > div > div > section > div.flex.flex-col.h-full.justify-between.gap-4.pt-4 > div:nth-child(3) > div > p.text-\\[1\\.5rem\\].text-\\[\\#FFF\\].font-bold"
                            WebDriverWait(driver, 5).until(
                                EC.presence_of_element_located((By.CSS_SELECTOR, capital_started_selector))
                            )
                            print(f"{Fore.GREEN} Starting Capital thành công ✅")

                            # Click the Capital button
                            capital_button_selector = "#__nuxt > div > div > section > div.flex.flex-col.h-full.justify-between.gap-4.pt-4 > div:nth-child(3) > button > p"
                            click_element_js(driver, capital_button_selector)

                            break
                        except Exception as e:
                            if attempt == 4:
                                driver.refresh()
                                print(f"{Fore.RED}Không tìm thấy Capital. Tự động tải lại trang.")
                            time.sleep(5)

                    # Continue with the workflow
                    print(f"{Fore.GREEN}Bắt đầu vào kiếm gumart{YELLOW}...")
                    time.sleep(2)

                    points_selector = "#__nuxt > div > div > section > div.w-full.flex.flex-col.gap-4.px-4.py-2.relative.z-\\[3\\] > div.flex.flex-col.gap-2.items-center > div > p"
                    points_element = WebDriverWait(driver, 30).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, points_selector))
                    )
                    points = points_element.text
                    print(f"{Fore.GREEN}Số dư của bạn là : {YELLOW}{points}")

                    # Wait 3 seconds
                    time.sleep(3)

                    # Click the button using XPath
                    claim_button_xpath = "/html/body/div[1]/div/div/section/div[5]/div/div/div/div[3]/button/p"
                    click_element_xpath(driver, claim_button_xpath)
                    print(f"{Fore.GREEN}Đã claim point thành công ✅ ")
                    time.sleep(2)
                    # Wait for balance update
                    balance_selector = "#__nuxt > div > div > section > div.w-full.flex.flex-col.gap-4.px-4.py-2.relative.z-\\[3\\] > div.flex.flex-col.gap-2.items-center > div > p"
                    balance_element = WebDriverWait(driver, 30).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, balance_selector))
                    )
                    balance = balance_element.text
                    print(f"{Fore.GREEN}Số dư của bạn khi claim xong là : {YELLOW}{balance}")

                    # Click the button using XPath
                    double_button_xpath = '/html/body/div[1]/div/div/section/div[5]/button/div/img'
                    if click_element_if_exists(driver, double_button_xpath):
                        print(f"{Fore.GREEN}Mua x2 thành công ✅")
                        time.sleep(2)
                    else:
                        print(f"{Fore.RED}X2 chưa hồi xong")

                    # Wait for double remaining time and get the remaining time
                    double_remaining_selector = "#__nuxt > div > div > section > div.relative.z-\\[2\\].px-2.flex.flex-col.gap-2 > button > div > div > p"
                    double_remaining = WebDriverWait(driver, 30).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, double_remaining_selector))
                    ).text
                    print(f"{Fore.GREEN} Thời gian x2 còn lại{YELLOW} {double_remaining}...")

                    print(f"{Fore.GREEN}Đã làm xong acc {FLAME_ORANGE}{start+i+1} ✅")

                except Exception as e:
                    print(f"{Fore.RED}Đã xảy ra lỗi: {e}")

                finally:
                    driver.quit()

            # Nghỉ ngơi giữa các khối tài khoản
            for remaining in range(rest_time, 0, -1):
                print(f"{Fore.YELLOW}Nghỉ ngơi {remaining} giây trước khi chạy tiếp...", end='\r')
                time.sleep(1)
            print(f"{Fore.YELLOW}Nghỉ ngơi xong!                     ")

if __name__ == "__main__":
    print_custom_logo(blink=True)
    file_path = 'gumart.txt'

    try:
        while True:
            non_empty_lines = count_non_empty_lines(file_path)
            if non_empty_lines == 0:
                print(f"{Fore.RED}File không chứa tài khoản nào.")
                break

            links = read_accounts(file_path)
            print(f"{SILVER}GUMART 🛒 {LIGHT_PINK}code by 🐮{RESET}")
            print(f"{LIGHT_PINK}tele{YELLOW}: {PINK}tphuc_0 {RESET}")
            print(f"{GREEN}Hiện tại bạn có {YELLOW} {non_empty_lines} {GREEN} tài khoản ")
            user_input = input(f"{GREEN}Nhập số lượng tài khoản muốn 🐮 chạy {YELLOW}({GREEN}hoặc {YELLOW}'{LIGHT_PINK}all{YELLOW}' {GREEN}để chạy tất cả{YELLOW}, {RED}0 {GREEN}để thoát{YELLOW}): ").strip()

            if user_input.lower() == 'all':
                num_accounts = len(links)
            elif user_input.isdigit():
                num_accounts = int(user_input)
                if num_accounts <= 0:
                    break
                if num_accounts > len(links):
                    num_accounts = len(links)
            else:
                print(f"{Fore.RED}Nhập không hợp lệ!")
                continue

            rest_time = int(input(f"{GREEN}Nhập thời gian nghỉ ngơi sau khi 🐮 chạy xong tất cả các tài khoản {YELLOW}({GREEN}Khuyên {YELLOW}9000 {GREEN}nha{YELLOW}): ").strip())
            run_chrome_instances(links, num_accounts, rest_time)

    except KeyboardInterrupt:
        print(f"{Fore.RED}\nChương trình chạy đã kết thúc...!")
