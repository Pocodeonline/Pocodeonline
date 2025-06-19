import time
import threading
import re
import math
from screeninfo import get_monitors
from colorama import init
from amazoncaptcha import AmazonCaptcha
import pyotp
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup

COLORS = {
    'RED': '\x1b[31m',
    'GREEN': '\x1b[32m',
    'YELLOW': '\x1b[33m',
    'CYAN': '\x1b[36m',
    'MAGENTA': '\x1b[35m',
    'BLUE': '\x1b[94m',
    'BRIGHT_YELLOW': '\x1b[93m',
    'BRIGHT_CYAN': '\x1b[96m',
    'RESET': '\x1b[0m'
}

init()

print(f"{COLORS['YELLOW']}{COLORS['BRIGHT_CYAN']}Tool \x1b[32mCheck Live JaPan \x1b[96mBy SoHan JVS {COLORS['RESET']}")
number_of_profiles = int(input(f"{COLORS['GREEN']}Vui lòng nhập số luồng chạy\x1b[93m: {COLORS['RESET']}"))
headless_choice = input(f"{COLORS['GREEN']}Bạn có muốn chạy dưới dạng ẩn không? \x1b[93m(\x1b[32my\x1b[93m/\x1b[31m\x1b[93m): {COLORS['RESET']}").strip().lower()
# Xác định chế độ headless dựa trên câu trả lời
headless_mode = True if headless_choice == 'y' else False
retries = int(input(f"{COLORS['GREEN']}Vui lòng nhập số lần thử lại \x1b[93m( 2 lần ): {COLORS['RESET']}"))
card_file_path = 'card.txt'

card_file_lock = threading.Lock()

def log_to_file(filename, *args):
    with open(filename, 'a', encoding='utf-8') as f:
        f.write("|".join(args) + '\n')

def remove_account_from_mailadd(email, password, code_2fa):
    target_line = f"{email}|{password}|{code_2fa}"
    with threading.Lock():
        with open('mailadd.txt', 'r', encoding='utf-8') as f:
            lines = f.readlines()
        with open('mailadd.txt', 'w', encoding='utf-8') as f:
            for line in lines:
                if line.strip() != target_line:
                    f.write(line)

def read_credentials(file_path='mailadd.txt'):
    creds = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split('|')
            if len(parts) == 2:  # Tài khoản không có 2FA
                email, password = parts
                creds.append({'email': email, 'password': password, '2fa': None})
            elif len(parts) == 3:  # Tài khoản có 2FA
                email, password, code_2fa = parts
                creds.append({'email': email, 'password': password, '2fa': code_2fa})
    return creds
def read_proxies(proxy_file_path='proxy.txt'):
    proxies = []
    with open(proxy_file_path, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split(':')
            if len(parts) == 4:
                ip, port, username, password = parts
                proxies.append({'ip': ip, 'port': port, 'username': username, 'password': password})
    return proxies

def get_next_proxy(profile_number):
    # Lấy proxy cho mỗi profile, sau khi hết proxy thì lấy lại từ đầu
    return proxies[(profile_number - 1) % total_proxies]


# Read credentials and proxies before anything else
credentials = read_credentials()
proxies = read_proxies()

# Now you can safely use 'proxies' for the rest of your code
total_accounts = len(credentials)
total_proxies = len(proxies)

# Lấy thông số màn hình
monitor = get_monitors()[0]
screen_width = monitor.width
screen_height = monitor.height

# Hàm tính grid chia cửa sổ gọn cho số luồng
def calc_grid(n):
    if n <= 4:
        rows = 1
    elif n <= 10:
        rows = 2
    elif n <= 15:
        rows = 3
    else:
        rows = math.ceil(n / math.ceil(math.sqrt(n)))
    cols = math.ceil(n / rows)
    return cols, rows

columns, rows = calc_grid(number_of_profiles)

MIN_WIDTH = 320
MIN_HEIGHT = 480

window_width = max(screen_width // columns, MIN_WIDTH)
window_height = max(screen_height // rows, MIN_HEIGHT)

if window_width * columns > screen_width:
    window_width = screen_width // columns
if window_height * rows > screen_height:
    window_height = screen_height // rows

# Lấy vị trí mở cửa sổ theo index tài khoản (profile_number)
def get_position_for_profile(profile_number):
    idx = profile_number - 1
    row = idx // columns
    col = idx % columns
    x = col * window_width
    y = row * window_height
    return x, y
def get_proxy_for_profile(profile_number):
    return proxies[(profile_number - 1) % total_proxies]
# Lấy 5 dòng thẻ liên tiếp của tài khoản thứ account_index (1-based)
def get_5_cards_for_account(account_index):
    with card_file_lock:
        with open(card_file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        start = (account_index - 1) * 5
        end = start + 5
        if end > len(lines):
            return None, []
        block_lines = lines[start:end]
        if all(line.strip().lower() == 'done' for line in block_lines):
            return None, []
        return start, [line.strip() for line in block_lines]
    
def remove_card_line(line_to_remove):
    with card_file_lock:
        with open(card_file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        with open(card_file_path, 'w', encoding='utf-8') as f:
            for line in lines:
                if line.strip() != line_to_remove.strip():
                    f.write(line)

def mark_5_cards_done(block_start):
    with card_file_lock:
        with open(card_file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        block_end = block_start + 5
        for i in range(block_start, block_end):
            lines[i] = "done\n"
        with open(card_file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)

def clean_done_lines():
    with card_file_lock:
        with open(card_file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        new_lines = [line for line in lines if line.strip().lower() != "done"]
        with open(card_file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
    print(f"{COLORS['GREEN']}Đã xóa hết dòng 'done' trong {card_file_path}.{COLORS['RESET']}")

def solve_captcha(page):
    try:
        img = page.query_selector('//div[@class="a-row a-text-center"]//img')
        if img:
            link = img.get_attribute('src')
            captcha = AmazonCaptcha.fromlink(link)
            captcha_value = AmazonCaptcha.solve(captcha)
            input_field = page.query_selector('#captchacharacters')
            if input_field:
                input_field.fill(captcha_value)
                time.sleep(2)
                button = page.query_selector('.a-button-text')
                if button:
                    button.click()
                    time.sleep(2)
    except Exception as e:
        print(f"{COLORS['RED']}\x1b[93m[ \x1b[96mSoHan \x1b[93m][ERROR] > Captcha solve error: {e}{COLORS['RESET']}")

def login_amz(page, profile_number, credentials_list):
    page.goto('https://www.amazon.co.jp/ap/signin?openid.pape.max_auth_age=900&openid.return_to=https%3A%2F%2Fwww.amazon.co.jp%2Fgp%2Fyourstore%2Fhome%3Flanguage%3Dzh%26path%3D%252Fgp%252Fyourstore%252Fhome%26signIn%3D1%26useRedirectOnSuccess%3D1%26action%3Dsign-out%26ref_%3Dnav_AccountFlyout_signout&language=zh&openid.assoc_handle=jpflex&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0')

    cred = credentials_list[profile_number - 1]
    email = cred['email']
    password = cred['password']
    code_2fa = cred['2fa']  # Nếu có 2FA, giá trị sẽ là mã 2FA, nếu không có sẽ là None

    page.fill('input#ap_email', email)
    page.click('input#continue')

    try:
        if page.query_selector('//div[@class="a-row a-text-center"]//img'):
            solve_captcha(page)
    except Exception:
        pass

    page.fill('input#ap_password', password)
    page.click('input#signInSubmit')

    # Nếu tài khoản có 2fa thì điền OTP, nếu không có 2FA thì bỏ qua
    if code_2fa:
        try:
            otp_input = page.wait_for_selector('input#auth-mfa-otpcode', timeout=8000)
            otp_code = pyotp.TOTP(code_2fa).now()
            otp_input.fill(otp_code)

            remember_device_checkbox = page.query_selector('input#auth-mfa-remember-device')
            if remember_device_checkbox:
                remember_device_checkbox.click()

            page.click('input#auth-signin-button')
            time.sleep(100000000)
        except TimeoutError:
            pass
    else:
        print(f"{COLORS['GREEN']}Không có 2FA cho tài khoản {email}, bỏ qua bước nhập OTP.{COLORS['RESET']}")

    try:
        if page.query_selector('//h4[text()="Account on hold temporarily"]'):
            script = '''
                const elscreen = document.createElement('div');
                elscreen.style.cssText = 'position: fixed;inset: 0px;background: rgba(206,236,206,0.89);z-index: 20000;display: flex;justify-content: center;align-items: center;font-size: 80pt;color: #FF4500;';
                elscreen.innerHTML = 'ACC DIE';
                document.body.appendChild(elscreen);
            '''
            page.evaluate(script)
            log_to_file('AccDie.txt', email, password, code_2fa)
            remove_account_from_mailadd(email, password, code_2fa)
            log_to_file('die.txt', email, password, code_2fa)
            print(f"{COLORS['RED']}Tài khoản {email} bị khóa ghi vào die.txt.{COLORS['RESET']}")
            return False
    except Exception:
        pass

    # Kiểm tra xem có vào được trang "Add Card" không
    try:
        page.goto('https://www.amazon.co.jp/cpe/yourpayments/settings/manageoneclick')
        time.sleep(2)  # Chờ một chút để trang tải

        # Kiểm tra xem có thể thấy nút thêm thẻ không
        if page.query_selector('input.pmts-link-button[type="submit"][name^="ppw-widgetEvent:ChangeAddressPreferredPaymentMethodEvent:"]'):
            print(f"{COLORS['GREEN']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Tài khoản \x1b[93m{email} \x1b[32mvào được trang Add Card{COLORS['RESET']}")
        else:
            # Nếu không thấy nút thêm thẻ, có thể tài khoản bị captcha hoặc die
            print(f"{COLORS['RED']}Tài khoản {email} không vào được trang Add Card, có thể bị captcha hoặc die.{COLORS['RESET']}")
            log_to_file('die.txt', email, password, code_2fa)  # Ghi vào die.txt
            remove_account_from_mailadd(email, password, code_2fa)
            return False

    except Exception as e:
        print(f"{COLORS['RED']}Lỗi khi kiểm tra trang Add Card cho tài khoản {email}: {e}{COLORS['RESET']}")
        log_to_file('die.txt', email, password, code_2fa)  # Ghi vào die.txt
        remove_account_from_mailadd(email, password, code_2fa)
        return False

    try:
        skip_link = page.query_selector('a#ap-account-fixup-phone-skip-link')
        if skip_link:
            skip_link.click()
    except Exception:
        pass

    try:
        agree = page.query_selector('span#agree-button-announce')
        if agree:
            agree.click()
    except Exception:
        pass

    print(f"{COLORS['GREEN']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Login thành công cho tài khoản \x1b[93m{email}{COLORS['RESET']}")
    time.sleep(2)
    return True


def add_card(page, credentials_list, profile_number, cards_to_add):
    retry_limit = 3
    added_cards = []
    max_cards_per_account = 5

    cred = credentials_list[profile_number - 1]
    email = cred['email']

    for card_line in cards_to_add:
        parts = card_line.strip().split('|')
        if len(parts) < 3:
            print(f"{COLORS['RED']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Card line format error: {card_line.strip()}{COLORS['RESET']}")
            continue
        card_number, expiration_month, expiration_year = parts[:3]

        retry_count = 0
        while retry_count < retry_limit:
            try:
                url = 'https://www.amazon.co.jp/cpe/yourpayments/settings/manageoneclick'
                page.goto(url)
                time.sleep(3)

                link_add_card = page.wait_for_selector('input.pmts-link-button[type="submit"][name^="ppw-widgetEvent:ChangeAddressPreferredPaymentMethodEvent:"]', timeout=10000)
                link_add_card.click()
                time.sleep(2.5)

                add_card_button = page.query_selector('//span[@class="a-button a-button-base apx-secure-registration-content-trigger-js"]')
                if add_card_button:
                    add_card_button.click()
                else:
                    print(f"{COLORS['RED']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không tìm thấy button 'Add a credit or debit card' cho tài khoản \x1b[93m{email}{COLORS['RESET']}")
                    break

                time.sleep(1)
                card_name = page.evaluate('''() => {
                    const spanElement = document.evaluate("//span[@id='nav-link-accountList-nav-line-1']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if(spanElement){
                        return spanElement.textContent.replace('Hello, ', '').trim();
                    }
                    return null;
                }''')
                if not card_name:
                    card_name = "User"
                time.sleep(2.5)
                iframe = page.wait_for_selector("iframe[name*='ApxSecureIframe']", timeout=5000)
                frame = iframe.content_frame()
                frame.fill("input[data-testid='input-text-input']", card_name)
                time.sleep(0.5)
                frame.fill("input[data-testid='card-text-input']", card_number)
                time.sleep(0.5)

                # Đảm bảo chỉ lấy 2 số cuối của năm
                expiration_year = expiration_year[-2:]

                # Điền tháng và năm vào ô input theo định dạng MMYY (tháng tự động có 2 chữ số)
                expiration_value = f"{expiration_month}{expiration_year}"

                frame.fill("input[data-testid='date-expiration-text-input']", expiration_value)
                time.sleep(0.5)

                next_button = frame.query_selector('//div[@class="css-18t94o4 css-1dbjc4n r-1loqt21 r-1ny4l3l r-1otgn73 r-13qz1uu"]')
                if next_button:
                    next_button.click()
                    time.sleep(4)
                    added_cards.append({'number': card_number, 'line': card_line.strip()})

                    # Lưu dòng thẻ vào carddone.txt trước khi đánh dấu "done"
                    log_to_file('carddone.txt', card_line.strip())
                    
                    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã thêm thành công thẻ \x1b[93m{card_number} \x1b[32mcho tài khoản \x1b[93m{email} {len(added_cards)}{COLORS['RESET']}")

                    remove_card_line(card_line)  # Xóa thẻ đã thêm khỏi file
                    break
                else:
                    print(f"{COLORS['YELLOW']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Tài khoản \x1b[93m{email} \x1b[32mbị giới hạn \x1b[93m2 \x1b[32mtiếng\x1b[93m, \x1b[32mchuyển sang tài khoản khác.{COLORS['RESET']}")
                    return added_cards

            except Exception as e:
                retry_count += 1
                if retry_count >= retry_limit:
                    print(f"{COLORS['RED']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Lỗi thêm thẻ \x1b[93m{card_number} \x1b[31msau \x1b[93m{retry_limit} \x1b[31mlần thử cho tài khoản \x1b[93m{email}.{COLORS['RESET']}")
                    return added_cards
                else:
                    print(f"{COLORS['RED']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Lỗi thêm thẻ \x1b[93m{card_number} \x1b[31mcho tài khoản \x1b[93m{email} \x1b31mđang thử lại lần \x1b[93m{retry_count}{COLORS['RESET']}")
                time.sleep(2)

    return added_cards


profile_index_lock = threading.Lock()
profile_index = 0

def run_profile(profile_number):
    proxy = get_next_proxy(profile_number)
    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[32mSử dụng proxy \x1b[93m{proxy['ip']} \x1b[32mcho profile \x1b[93m{profile_number}{COLORS['RESET']}")
    for attempt in range(retries):
        print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Mở profile \x1b[93m{profile_number} \x1b[32mđể chạy tài khoản thứ \x1b[93m{profile_number}{COLORS['RESET']}")

        try:
            x, y = get_position_for_profile(profile_number)
            with sync_playwright() as playwright:
                # Sử dụng chế độ headless tùy thuộc vào lựa chọn của người dùng
                browser = playwright.chromium.launch(
                    headless=headless_mode,  # Dùng biến headless_mode đã thiết lập
                    args=[f'--window-size={window_width},{window_height}', f'--window-position={x},{y}', '--disable-infobars', '--start-maximized'],
                )

                context = browser.new_context(
                    viewport={'width': window_width, 'height': window_height},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    proxy={
                        'server': f'http://{proxy["ip"]}:{proxy["port"]}',
                        'username': proxy["username"],
                        'password': proxy["password"]
                    }
                )
                page = context.new_page()

                try:
                    # Đảm bảo các cửa sổ được hiển thị đúng vị trí
                    page.evaluate(f"window.moveTo({x}, {y}); window.resizeTo({window_width}, {window_height});")
                except Exception:
                    pass

                if not login_amz(page, profile_number, credentials):
                    cred = credentials[profile_number - 1]
                    log_to_file('die.txt', cred['email'], cred['password'], cred['2fa'])
                    remove_account_from_mailadd(cred['email'], cred['password'], cred['2fa'])
                    context.close()
                    browser.close()
                    break

                block_start, cards_to_add = get_5_cards_for_account(profile_number)
                if not cards_to_add:
                    print(f"{COLORS['RED']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không có thẻ hoặc đã done cho tài khoản thứ \x1b[93m{profile_number}{COLORS['RESET']}")
                    context.close()
                    browser.close()
                    break

                added_cards = add_card(page, credentials, profile_number, cards_to_add)
                if len(added_cards) == 5:
                    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Hoàn thành tài khoản thứ \x1b[93m{profile_number}{COLORS['RESET']}")
                    # Mark all 5 cards as done
                    mark_5_cards_done(block_start)
                    cred = credentials[profile_number - 1]
                    remove_account_from_mailadd(cred['email'], cred['password'], cred['2fa'])
                    log_to_file('maildone.txt', cred['email'], cred['password'], cred['2fa'])
                    context.close()
                    browser.close()
                    break
                else:
                    print(f"{COLORS['RED']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không thêm đủ thẻ cho tài khoản \x1b[93m{profile_number}{COLORS['RESET']}")
                    context.close()
                    browser.close()
                    break

        except Exception as e:
            print(f"{COLORS['RED']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Lỗi tài khoản \x1b[93m{profile_number}: {e}{COLORS['RESET']}")
            if attempt < retries - 1:
                print(f"{COLORS['GREEN']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Thử lại lần \x1b[93m{attempt + 1} \x1b[31mcho tài khoản \x1b[93m{profile_number}{COLORS['RESET']}")
            else:
                print(f"{COLORS['RED']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR] Không thành công sau \x1b[93m{retries} \x1b[31mlần thử cho tài khoản \x1b[93m{profile_number}{COLORS['RESET']}")
            continue

def worker_thread():
    global profile_index
    while True:
        with profile_index_lock:
            if profile_index >= total_accounts:
                break
            current_profile = profile_index + 1
            profile_index += 1
        run_profile(current_profile)

def run_profiles_dynamically():
    global profile_index, credentials, total_accounts
    while True:
        profile_index = 0
        threads = []
        max_threads = min(number_of_profiles, total_accounts)
        for _ in range(max_threads):
            t = threading.Thread(target=worker_thread)
            t.start()
            threads.append(t)
        for t in threads:
            t.join()
        print(f"{COLORS['BRIGHT_CYAN']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> Đã chạy hết tất cả tài khoản trong \x1b[93mmailadd.txt.\n{COLORS['RESET']}")
        user_input = input(f"{COLORS['GREEN']}\x1b[32m> Bạn đã chạy xong hết tài khoản\x1b[93m, \x1b[32mnhập \x1b[93m'\x1b[32m>y\x1b[93m' \x1b[32mđể done \x1b[93m:\x1b[0m{COLORS['RESET']}").strip().lower()
        if user_input == 'y':
            clean_done_lines()
            print(f"{COLORS['RED']}Thoát chương trình...{COLORS['RESET']}")
            break
        else:
            credentials = read_credentials()
            total_accounts = len(credentials)
            print(f"{COLORS['BRIGHT_CYAN']}\x1b[32m>Chạy lại tất cả tài khoản từ đầu\x1b[96m>...\n\n{COLORS['RESET']}")

if __name__ == '__main__':
    profile_index_lock = threading.Lock()
    profile_index = 0
    try:
        run_profiles_dynamically()
    except KeyboardInterrupt:
        print(f"{COLORS['GREEN']}Quá trình bị dừng bởi người dùng, thoát...{COLORS['RESET']}")
    except Exception as e:
        print(f"{COLORS['RED']}\x1b[93m[ \x1b[96mSoHan \x1b[93m] \x1b[32m> \x1b[31m[ERROR]Lỗi không mong muốn\x1b[93m:\x1b[0m {e}{COLORS['RESET']}")
