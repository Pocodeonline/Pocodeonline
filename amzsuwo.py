import time
import threading
import random
import re
from screeninfo import get_monitors
from colorama import init, Fore, Style
from amazoncaptcha import AmazonCaptcha
import pyotp
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from bs4 import BeautifulSoup

# Định nghĩa màu sắc (ANSI escape codes)
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

print(f"{COLORS['YELLOW']} {COLORS['BRIGHT_CYAN']}Tool by SuWo {COLORS['RESET']}")
number_of_profiles = int(input(f"{COLORS['GREEN']} Vui Lòng nhập số luồng bạn muốn chạy chứ nhỉ \x1b[93m: \x1b[0m{COLORS['RESET']}"))
retries = int(input(f"{COLORS['GREEN']} Số lần sẽ chạy lại nhầm khuyến khích bị lỗi mạng \x1b[93m( \x1b[32mkhuyên \x1b[93m2 \x1b[32mnhé \x1b[93m): {COLORS['RESET']}"))
card_file_path = 'card.txt'
with open('proxy.txt', 'r') as proxy_file:
    proxy = proxy_file.readline().strip()

def log_to_file(filename, email, password, code_2fa):
    with open(filename, 'a') as file:
        file.write(f"{email}|{password}|{code_2fa}\n")

def remove_lines_from_card_txt(lines_to_remove):
    """Xóa các dòng trong card.txt tương ứng với lines_to_remove (list các string nguyên dòng)"""
    with open(card_file_path, 'r') as file:
        lines = file.readlines()
    with open(card_file_path, 'w') as file:
        for line in lines:
            if line.strip() not in lines_to_remove:
                file.write(line)

def save_live_cards_to_file(live_card_lines, email):
    """Ghi nguyên dòng thẻ live vào file cardlive.txt"""
    with open('cardlive.txt', 'a') as f:
        for line in live_card_lines:
            f.write(line if line.endswith('\n') else line + '\n')

def read_credentials(file_path='mailadd.txt'):
    credentials = []
    with open(file_path, 'r') as file:
        for line in file:
            email, password, code_2fa = line.strip().split('|')
            credentials.append({'email': email, 'password': password, '2fa': code_2fa})
    return credentials

credentials = read_credentials()
monitor = get_monitors()[0]
screen_width = monitor.width
screen_height = monitor.height

def calc_grid(n):
    import math
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

active_positions = []
active_positions_lock = threading.Lock()

def get_next_position():
    with active_positions_lock:
        if len(active_positions) >= columns * rows:
            active_positions.clear()
        for row in range(rows):
            for col in range(columns):
                pos = (col * window_width, row * window_height)
                if pos not in active_positions:
                    active_positions.append(pos)
                    return pos
        return (0, 0)

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
        print(f"{COLORS['RED']}[ SU WO ][ERROR] > Captcha solve error: {e}{COLORS['RESET']}")

def login_amz(page, profile_number, credentials_list):
    page.goto('https://na.account.amazon.com/ap/signin?_encoding=UTF8&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.pape.max_auth_age=0&ie=UTF8&openid.ns.pape=http%3A%2F%2Fspecs.openid.net%2Fextensions%2Fpape%2F1.0&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&pageId=lwa&openid.assoc_handle=amzn_lwa_na&marketPlaceId=ATVPDKIKX0DER&arb=e2bc4dbc-2218-4697-8323-886562f341f1&language=en_US&openid.return_to=https%3A%2F%2Fna.account.amazon.com%2Fap%2Foa%3FmarketPlaceId%3DATVPDKIKX0DER%26arb%3De2bc4dbc-2218-4697-8323-886562f341f1%26language%3Den_US&enableGlobalAccountCreation=1&metricIdentifier=amzn1.application.eb539eb1b9fb4de2953354ec9ed2e379&signedMetricIdentifier=fLsotU64%2FnKAtrbZ2LjdFmdwR3SEUemHOZ5T2deI500%3D')

    cred = credentials_list[profile_number - 1]
    email = cred['email']
    password = cred['password']
    code_2fa = cred['2fa']

    page.fill('input#ap_email', email)
    page.click('input#continue')

    try:
        if page.query_selector('//div[@class="a-row a-text-center"]//img'):
            solve_captcha(page)
    except Exception:
        pass

    page.fill('input#ap_password', password)
    page.click('input#signInSubmit')

    try:
        otp_input = page.wait_for_selector('input#auth-mfa-otpcode', timeout=8000)
        otp_code = pyotp.TOTP(code_2fa).now()
        otp_input.fill(otp_code)

        remember_device_checkbox = page.query_selector('input#auth-mfa-remember-device')
        if remember_device_checkbox:
            remember_device_checkbox.click()

        page.click('input#auth-signin-button')
    except PlaywrightTimeoutError:
        pass

    try:
        if page.query_selector('//h4[text()="Account on hold temporarily"]'):
            script = '''
                const elscreen = document.createElement('div');
                elscreen.style.cssText = 'position: fixed;inset: 0px;background: rgb(206 236 206 / 89%);z-index: 20000;display: flex;justify-content: center;align-items: center;font-size: 80pt;color: #FF4500;';
                elscreen.innerHTML = 'ACC DIE';
                document.body.appendChild(elscreen);
            '''
            page.evaluate(script)
            log_to_file('AccDie.txt', email, password, code_2fa)
            return False
    except Exception:
        pass

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

    return True

def add_card(page, start_line, end_line, credentials_list, profile_number):
    retry_limit = 3
    added_cards = []
    max_cards_per_account = 5

    cred = credentials_list[profile_number - 1]
    email = cred['email']

    with open(card_file_path, 'r') as f:
        cards = f.readlines()

    max_end_line = min(end_line, len(cards), start_line + max_cards_per_account)

    for index, card_line in enumerate(cards[start_line:max_end_line], start=start_line):
        if len(added_cards) >= max_cards_per_account:
            print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Đã đạt giới hạn \x1b[92m{max_cards_per_account} \x1b[32mthẻ cho tài khoản \x1b[93m{email}{COLORS['RESET']}")
            break

        parts = card_line.strip().split('|')
        if len(parts) < 3:
            print(f"{COLORS['RED']}[ SU WO ][ERROR] > Card line format error: {card_line.strip()}{COLORS['RESET']}")
            continue
        card_number, expiration_month, expiration_year = parts[:3]

        retry_count = 0
        while retry_count < retry_limit:
            try:
                url = 'https://www.amazon.com/cpe/yourpayments/settings/manageoneclick'
                page.goto(url)
                time.sleep(3)

                link_add_card = page.wait_for_selector('input.pmts-link-button[type="submit"][name^="ppw-widgetEvent:ChangeAddressPreferredPaymentMethodEvent:"]', timeout=10000)
                link_add_card.click()
                time.sleep(2.5)

                page.evaluate('''() => {
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.type === 'childList') {
                                const addCardLink = document.querySelector('a.a-link-normal.apx-secure-registration-content-trigger-js');
                                if (addCardLink) {
                                    addCardLink.click();
                                    observer.disconnect();
                                }
                            }
                        });
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }''')

                page.wait_for_timeout(2500)

                add_card_credit = page.query_selector('a.a-link-normal.apx-secure-registration-content-trigger-js')
                if add_card_credit:
                    add_card_credit.click()
                else:
                    print(f"{COLORS['RED']}Không tìm thấy link Add a credit or debit card sau khi cập nhật HTML cho tài khoản {email}{COLORS['RESET']}")
                    
                time.sleep(2.5)
                card_name = page.evaluate('''() => {
                    const spanElement = document.evaluate("//span[@id='nav-link-accountList-nav-line-1']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if(spanElement){
                        return spanElement.textContent.replace('Hello, ', '').trim();
                    }
                    return null;
                }''')
                if not card_name:
                    card_name = "User"

                iframe = page.wait_for_selector("iframe[name*='ApxSecureIframe']", timeout=10000)
                frame = iframe.content_frame()

                frame.fill("input[name='ppw-accountHolderName']", card_name)
                time.sleep(1)
                frame.fill("input[name='addCreditCardNumber']", card_number)
                time.sleep(1)

                frame.click("span.a-button-inner span.a-button-text span.a-dropdown-prompt")
                frame.click(f"//a[contains(text(), '{expiration_month}')]")

                frame.click("span.pmts-expiry-year span.a-button-inner span.a-button-text span.a-dropdown-prompt")
                frame.click(f"//a[contains(text(), '{expiration_year}')]")
                time.sleep(1)

                submit_btn = frame.query_selector("input[name='ppw-widgetEvent:AddCreditCardEvent']")
                if submit_btn:
                    submit_btn.click()
                    time.sleep(1)
                    added_cards.append({'number': card_number})
                    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Đã thêm thành công thẻ \x1b[93m{card_number} \x1b[32mcho tài khoản \x1b[93m{email} \x1b[33m{len(added_cards)}\x1b[94m/\x1b[32m{max_cards_per_account}{COLORS['RESET']}")
                    break
                else:
                    print(f"{COLORS['YELLOW']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Tài khoản \x1b[93m{email} \x1b[32mbị giới hạn \x1b[31m2 tiếng \x1b[32mĐang chuyển sang tài khoản khác để thêm thẻ.{COLORS['RESET']}")
                    return added_cards

            except Exception as e:
                print(f"{COLORS['RED']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> \x1b[93m[\x1b[31m ERROR \x1b[93m] thêm thẻ \x1b[93m{card_number} \x1b[32mcho tài khoản \x1b[93m{email} \x1b[32mđang thử lại{COLORS['RESET']}")
                retry_count += 1
                if retry_count >= retry_limit:
                    print(f"{COLORS['RED']} Lỗi thêm thẻ \x1b[93m{card_number} \x1b[31msau \x1b[93m{retry_limit} \x1b[31mthử cho tài khoản \x1b[93m{email}{COLORS['RESET']}")
                else:
                    print(f"{COLORS['YELLOW']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Retry \x1b[93m{retry_count} \x1b[32mcho thẻ \x1b[93m{card_number} \x1b[32mcho tài khoản \x1b[93m{email}{COLORS['RESET']}")

    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Hoàn thành thêm thẻ cho tài khoản \x1b[93m{email} \x1b[32mTổng số thẻ đã thêm: \x1b[93m{len(added_cards)}{COLORS['RESET']}")
    return added_cards
    
def check_and_save_cards(page, email, cred, start_line, end_line):
    page.goto('https://www.amazon.com/cpe/yourpayments/wallet')
    print(f"{COLORS['YELLOW']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Đang tiếng hành check live cho tài khoản \x1b[93m{email}{COLORS['RESET']}")
    # Wait for network to be idle to ensure page loads completely
    page.wait_for_load_state('networkidle')
    # Wait additional time to ensure all elements are loaded
    time.sleep(25)
    # Refresh page to ensure fresh content
    page.reload()
    # Wait again for network to be idle after refresh
    page.wait_for_load_state('networkidle')
    # Final wait to ensure everything is loaded
    time.sleep(20)

    page.reload()
    
    page.wait_for_load_state('networkidle')
    time.sleep(25)
    page.reload()


    content = page.content()
    soup = BeautifulSoup(content, 'html.parser')

    container_divs = soup.select(
        'div.a-row.apx-wallet-desktop-payment-method-selectable-tab-css > '
        'div.a-scroller.apx-wallet-desktop-payment-method-selectable-tab-css.a-scroller-vertical > '
        'div.a-row.apx-wallet-desktop-payment-method-selectable-tab-inner-css > '
        'div.a-section.apx-wallet-selectable-payment-method-tab'
    )

    skip_img_srcs = [
        "41MGiaNMk5L._SL85_.png",
        "81NBfFByidL._SL85_.png"
    ]

    total_cards = len(container_divs)
    filtered_cards = []
    skip_count = 0

    for card_div in container_divs:
        img_tag = card_div.find('img', class_='apx-wallet-selectable-image')
        img_src = img_tag['src'] if img_tag else ''
        if any(skip_img in img_src for skip_img in skip_img_srcs):
            skip_count += 1
            continue
        filtered_cards.append(card_div)

    live_card_count = len(filtered_cards)
    print(f"{COLORS['BLUE']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Tài Khoản \x1b[93m{email} \x1b[96mCó Tổng thẻ: \x1b[93m{total_cards} \x1b[31mThẻ Die: \x1b[93m{skip_count} \x1b[32mThẻ live: \x1b[93m{live_card_count}{COLORS['RESET']}")

    live_cards_last4 = []
    for card in filtered_cards:
        text_nodes = card.get_text(strip=True)
        match = re.search(r'(\d{4})$', text_nodes)
        if match:
            last4 = match.group(1)
            live_cards_last4.append(last4)

    if live_card_count > 0:
        log_to_file('live.txt', email, cred['password'], cred['2fa'])
    else:
        print(f"{COLORS['RED']} Không tìm thấy thẻ hợp lệ nào trên tài khoản \x1b[93m{email}. DIE.{COLORS['RESET']}")
        log_to_file('die.txt', email, cred['password'], cred['2fa'])

    with open(card_file_path, 'r') as f:
        lines = f.readlines()

    lines_to_check = lines[start_line:end_line]

    live_lines = []
    die_lines = []

    for line in lines_to_check:
        line = line.strip()
        if not line:
            continue
        card_num = line.split('|')[0]
        if len(card_num) < 4:
            continue
        last4_line = card_num[-4:]
        if last4_line in live_cards_last4:
            live_lines.append(line)
        else:
            die_lines.append(line)

    if live_lines:
        save_live_cards_to_file(live_lines, email)

    if die_lines:
        remove_lines_from_card_txt(die_lines)

    print(f"{COLORS['GREEN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Xử lý xong thêm thẻ cho tài khoản \x1b[93m{email}{COLORS['RESET']}")

def delete_card(page, email, num_cards_to_delete=5):
    try:
        retry_count = 0
        max_retries = 2
        
        while True:
            page.goto('https://www.amazon.com/cpe/yourpayments/wallet')
            print(f"{COLORS['YELLOW']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Đang tiếng hành xóa thẻ cho tài khoản \x1b[93m{email}{COLORS['RESET']}")


            card_count = page.evaluate('''() => {
                const sidebar = document.querySelector('.a-scroller.apx-wallet-desktop-payment-method-selectable-tab-css.a-scroller-vertical');
                if (!sidebar) return 0;
                const Cards = sidebar.querySelectorAll('.a-section.apx-wallet-selectable-payment-method-tab');
                return Cards.length;
            }''')

            if card_count == 0:
                print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Tất cả thẻ thêm đã xóa khỏi tài khoản \x1b[93m{email} {COLORS['RESET']}")
                return True

            try:
                edit_card = page.wait_for_selector('//a[text()="Edit"]', timeout=5000)
            except Exception:
                print(f"{COLORS['RED']} lỗi không thấy phần edit đang thử lại...{COLORS['RESET']}")
                break

            edit_card.click()
            time.sleep(2)

            try:
                remove_card = page.wait_for_selector('//input[@class="apx-remove-link-button"]', timeout=5000)
                remove_card.click()
            except PlaywrightTimeoutError:
                retry_count += 1
                if retry_count >= max_retries:
                    print(f"{COLORS['RED']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> \x1b[31mTài khoản đã bị giới hạn lượt xóa thẻ hoặc dư thẻ để xóa{COLORS['RESET']}")
                    return False
            try:
                confirm_button = page.wait_for_selector('//span[@class="a-button a-button-primary pmts-delete-instrument apx-remove-button-desktop pmts-button-input"]', timeout=5000)
                confirm_button.click()
            except Exception:
                print(f"{COLORS['RED']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> \x1b[31mĐã bị quá tải xóa thẻ \x1b[93m- \x1b[31mLần thử \x1b[93m{retry_count}/{max_retries}{COLORS['RESET']}")
                time.sleep(2)
                
                continue
            except Exception:
                try:
                    page.evaluate('''
                        var removeButton = document.evaluate(
                            "//span[@class='a-button-inner']/input[@class='a-button-input' and @type='submit']", 
                            document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        if (removeButton) {
                            removeButton.click();
                        }
                    ''')
                    time.sleep(2)
                    page.reload()                   
                    time.sleep(2)
                    continue
                except Exception as e:
                    print(f"{COLORS['RED']}Lỗi không mong muốn{COLORS['RESET']}")
                    break

        return True
    except Exception as e:
        print(f"{COLORS['RED']}[ SU WO ][ERROR] > {e}{COLORS['RESET']}")
        return False

# ----------- Phần chỉnh sửa chính cho chạy tuần tự tài khoản, đa luồng -------------

profile_counter_lock = threading.Lock()
# Dùng biến global index quản lý tài khoản hiện tại
profile_index = 0
profile_index_lock = threading.Lock()

def run_profile(profile_number):
    global profile_index
    start_line = (profile_number - 1) * 5
    end_line = start_line + 5

    for attempt in range(retries):
        print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Đang tiến hành mở profile \x1b[93m{profile_number} \x1b[32mđể chạy tài khoản \x1b[93m{profile_number}{COLORS['RESET']}")
        try:
            with sync_playwright() as playwright:
                x, y = get_next_position()
                browser = playwright.chromium.launch(
                    headless=False,
                    args=[f'--window-size={window_width},{window_height}',
                          f'--window-position={x},{y}']
                )
                context = browser.new_context(
                    viewport={'width': window_width, 'height': window_height},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                page = context.new_page()
                try:
                    page.evaluate(f"window.moveTo({x}, {y}); window.resizeTo({window_width}, {window_height});")
                except Exception:
                    pass

                if not login_amz(page, profile_number, credentials):
                    context.close()
                    browser.close()
                    break

                added_cards = add_card(page, start_line, end_line, credentials, profile_number)
                if not added_cards:
                    print(f"{COLORS['RED']}Không thêm được thẻ nào cho profile \x1b[93m{profile_number} \x1b[31mvì đã hết thẻ tronng \x1b[93mcard.txt{COLORS['RESET']}")
                    context.close()
                    browser.close()
                    break

                check_and_save_cards(page, credentials[profile_number - 1]['email'], credentials[profile_number - 1], start_line, end_line)

                delete_card(page, num_cards_to_delete=len(added_cards))

                print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Đã hoàn thành quá trình cho tài khoản \x1b[93m{profile_number} {COLORS['RESET']}")
                time.sleep(5)
                context.close()
                browser.close()
                break
        except Exception as e:
            print(f"{COLORS['RED']}[ SU WO ][ERROR] > Lỗi thêm thẻ trong quá trình của tài khoản {profile_number}: {e}{COLORS['RESET']}")
            if attempt < retries - 1:
                print(f"{COLORS['GREEN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Đang thử lại \x1b[93m{attempt + 1} \x1b[32mcho tài khoản \x1b[93m{profile_number} \x1b[32mthêm thẻ{COLORS['RESET']}")
            else:
                print(f"{COLORS['RED']} Không thành công sau \x1b[93m{retries} \x1b[32mlần thử cho tải khoản \x1b[93m{profile_number} thêm thẻ{COLORS['RESET']}")
            continue

def worker_thread():
    global profile_index
    total_profiles = len(credentials)
    while True:
        with profile_index_lock:
            if profile_index >= total_profiles:
                # Nếu hết tài khoản rồi thì thoát vòng lặp worker thread
                break
            current_profile = profile_index + 1
            profile_index += 1
        run_profile(current_profile)

def run_profiles_dynamically():
    global profile_index
    while True:
        profile_index = 0  # reset index để chạy lại từ đầu
        threads = []
        max_threads = min(number_of_profiles, len(credentials))

        for _ in range(max_threads):
            t = threading.Thread(target=worker_thread)
            t.start()
            threads.append(t)

        for t in threads:
            t.join()

        print(f"{COLORS['BRIGHT_CYAN']}Đã chạy hết tất cả tài khoản trong \x1b[93mmailadd.txt.\n{COLORS['RESET']}")
        # Hỏi người dùng muốn thoát hay chạy lại
        user_input = input(f"{COLORS['GREEN']}Bạn đã chạy xong hết tài khoản\x1b[93m, \x1b[32mvui lòng tắt hoặc nhập \x1b[93m'y\x1b[93m' \x1b[32mđể thoát\x1b[93m: {COLORS['RESET']}").strip().lower()
        if user_input == 'y':
            print(f"{COLORS['RED']}Thoát chương trình...{COLORS['RESET']}")
            break
        else:
            print(f"{COLORS['BRIGHT_CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Chạy lại tất cả tài khoản từ đầu\x1b[93m...\n\n{COLORS['RESET']}")

if __name__ == '__main__':
    try:
        run_profiles_dynamically()
    except KeyboardInterrupt:
        print(f"{COLORS['GREEN']}Quá trình đã bị người dùng tắt đang thoát\x1b[93m...{COLORS['RESET']}")
    except Exception as e:
        print(f"{COLORS['RED']}Lỗi không mong muốn{COLORS['RESET']}")
