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

print(f"{COLORS['YELLOW']} {COLORS['BRIGHT_CYAN']}Tool AMZV1 By SoHan JVS {COLORS['RESET']}")
number_of_profiles = int(input(f"{COLORS['GREEN']} Vui Lòng nhập số luồng bạn muốn chạy chứ nhỉ \x1b[93m: \x1b[0m{COLORS['RESET']}"))
retries = int(input(f"{COLORS['GREEN']} Số lần sẽ chạy lại nhầm khuyến khích bị lỗi mạng \x1b[93m( \x1b[32mkhuyên \x1b[93m2 \x1b[32mnhé \x1b[93m): {COLORS['RESET']}"))
card_file_path = 'card.txt'
with open('proxy.txt', 'r') as proxy_file:
    proxy = proxy_file.readline().strip()

def log_to_file(filename, *args):
    with open(filename, 'a', encoding='utf-8') as file:
        file.write("|".join(args) + '\n')

def remove_lines_from_file(filepath, lines_to_remove):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    with open(filepath, 'w', encoding='utf-8') as f:
        for line in lines:
            if line.strip() not in lines_to_remove:
                f.write(line)

def remove_account_from_mailadd(email, password, code_2fa):
    target_line = f"{email}|{password}|{code_2fa}"
    remove_lines_from_file('mailadd.txt', [target_line])

def save_live_cards_to_file(live_card_lines, email):
    """Ghi nguyên dòng thẻ live vào file cardlive.txt"""
    with open('cardlive.txt', 'a', encoding='utf-8') as f:
        for line in live_card_lines:
            f.write(line if line.endswith('\n') else line + '\n')

def read_credentials(file_path='mailadd.txt'):
    credentials = []
    with open(file_path, 'r', encoding='utf-8') as file:
        for line in file:
            parts = line.strip().split('|')
            if len(parts) == 3:
                email, password, code_2fa = parts
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
        print(f"{COLORS['RED']}[ SoHan ][ERROR] > Captcha solve error: {e}{COLORS['RESET']}")

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
            # Xóa tài khoản khỏi mailadd.txt và lưu qua file die.txt
            remove_account_from_mailadd(email, password, code_2fa)
            log_to_file('die.txt', email, password, code_2fa)
            print(f"{COLORS['RED']}[ SoHan ] Tài khoản {email} bị khóa. Đã xóa khỏi mailadd.txt và ghi vào die.txt.{COLORS['RESET']}")
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
    password = cred['password']
    code_2fa = cred['2fa']

    # Đọc toàn bộ card.txt lần đầu (đảm bảo không trùng)
    with open(card_file_path, 'r', encoding='utf-8') as f:
        cards = f.readlines()

    # Lấy 5 dòng liên tiếp tương ứng profile: từ start_line đến start_line+5 (ko vượt quá end_line và số thẻ trong file)
    max_end_line = min(end_line, len(cards))
    cards_to_add = cards[start_line:max_end_line]

    for card_line in cards_to_add:
        if len(added_cards) >= max_cards_per_account:
            print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Đã đạt giới hạn \x1b[92m{max_cards_per_account} \x1b[32mthẻ cho tài khoản \x1b[93m{email}{COLORS['RESET']}")
            break

        parts = card_line.strip().split('|')
        if len(parts) < 3:
            print(f"{COLORS['RED']}[ SoHan ][ERROR] > Card line format error: {card_line.strip()}{COLORS['RESET']}")
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

                frame.fill("input[name='ppw-accountHolderName']", card_name)
                time.sleep(0.5)
                frame.fill("input[name='addCreditCardNumber']", card_number)
                time.sleep(1)

                frame.click("span.a-button-inner span.a-button-text span.a-dropdown-prompt")
                frame.click(f"//a[contains(text(), '{expiration_month}')]")

                frame.click("span.pmts-expiry-year span.a-button-inner span.a-button-text span.a-dropdown-prompt")
                frame.click(f"//a[contains(text(), '{expiration_year}')]")

                submit_btn = frame.query_selector("input[name='ppw-widgetEvent:AddCreditCardEvent']")
                if submit_btn:
                    submit_btn.click()
                    time.sleep(2)
                    added_cards.append({'number': card_number, 'line': card_line.strip()})
                    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Đã thêm thành công thẻ \x1b[93m{card_number} \x1b[32mcho tài khoản \x1b[93m{email} \x1b[33m{len(added_cards)}\x1b[94m/\x1b[32m{max_cards_per_account}{COLORS['RESET']}")
                    break
                else:
                    print(f"{COLORS['YELLOW']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Tài khoản \x1b[93m{email} \x1b[32mbị giới hạn \x1b[31m2 tiếng \x1b[32mĐang chuyển sang tài khoản khác để thêm thẻ.{COLORS['RESET']}")
                    return added_cards

            except Exception as e:
                retry_count += 1
                if retry_count >= retry_limit:
                    print(f"{COLORS['RED']} Lỗi thêm thẻ \x1b[93m{card_number} \x1b[31msau \x1b[93m{retry_limit} \x1b[31mthử cho tài khoản \x1b[93m{email}. Dừng thêm thẻ tiếp theo.{COLORS['RESET']}")
                    return added_cards
                else:
                    print(f"{COLORS['RED']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> \x1b[93m[\x1b[31m ERROR \x1b[93m] thêm thẻ \x1b[93m{card_number} \x1b[32mcho tài khoản \x1b[93m{email} \x1b[32mđang thử lại {retry_count}{COLORS['RESET']}")
                time.sleep(2)

    return added_cards

def check_and_save_cards(page, email, cred, start_line, end_line, added_cards):
    skip_img_srcs = [
        "41MGiaNMk5L._SL85_.png",
        "81NBfFByidL._SL85_.png"
    ]

    def click_cards_by_img_src():
        script = f'''
        (() => {{
            const skipImgs = {skip_img_srcs};
            let clickedCount = 0;
            const cardDivs = Array.from(document.querySelectorAll('div.a-section.apx-wallet-selectable-payment-method-tab'));
            for (const cardDiv of cardDivs) {{
                const img = cardDiv.querySelector('img.apx-wallet-selectable-image');
                if (!img) continue;
                for (const skipSrc of skipImgs) {{
                    if (img.src.includes(skipSrc)) {{
                        cardDiv.click();
                        clickedCount++;
                        break;
                    }}
                }}
            }}
            return clickedCount;
        }})();
        '''
        return page.evaluate(script)

    def count_live_cards(soup):
        container_divs = soup.select(
            'div.a-row.apx-wallet-desktop-payment-method-selectable-tab-css > '
            'div.a-scroller.apx-wallet-desktop-payment-method-selectable-tab-css.a-scroller-vertical > '
            'div.a-row.apx-wallet-desktop-payment-method-selectable-tab-inner-css > '
            'div.a-section.apx-wallet-selectable-payment-method-tab'
        )
        live_cards = []
        for card_div in container_divs:
            img_tag = card_div.find('img', class_='apx-wallet-selectable-image')
            img_src = img_tag['src'] if img_tag else ''
            if any(skip_img in img_src for skip_img in skip_img_srcs):
                continue
            live_cards.append(card_div)
        return live_cards

    def extract_last4(cards):
        last4s = []
        for card in cards:
            text = card.get_text(strip=True)
            match = re.search(r'(\d{4})$', text)
            if match:
                last4s.append(match.group(1))
        return set(last4s)

    max_clicks = 7  # tăng lên 7 lần click như yêu cầu
    min_clicks_before_check = 6  # phải click tối thiểu 6 lần trước khi quyết định dừng

    live_cards_prev = []
    live_last4_prev = set()

    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Tải load cho tài khoản \x1b[93m{email} {COLORS['RESET']}")
    page.goto('https://www.amazon.com/cpe/yourpayments/wallet')
    time.sleep(20)

    clicked = click_cards_by_img_src()
    print(f"{COLORS['CYAN']}Đang cập nhật dữ liệu check live {clicked} {COLORS['RESET']}")
    time.sleep(10)

    content = page.content()
    soup = BeautifulSoup(content, 'html.parser')
    live_cards_current = count_live_cards(soup)
    live_last4_current = extract_last4(live_cards_current)
    live_count_current = len(live_cards_current)
    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Tìm thấy \x1b[93m{live_count_current} \x1b[32mthẻ live để check thêm{COLORS['RESET']}")

    live_cards_prev = live_cards_current
    live_last4_prev = live_last4_current
    attempt = 1

    while attempt < max_clicks:
        print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Load lần \x1b[93m{attempt + 1} \x1b[32mcho tài khoản \x1b[93m{email} {COLORS['RESET']}")
        page.goto('https://www.amazon.com/cpe/yourpayments/wallet')
        time.sleep(10)

        clicked = click_cards_by_img_src()
        print(f"\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Đã load các thẻ lần thứ {attempt + 1}.")
        time.sleep(10)

        content = page.content()
        soup = BeautifulSoup(content, 'html.parser')
        live_cards_current = count_live_cards(soup)
        live_last4_current = extract_last4(live_cards_current)
        live_count_current = len(live_cards_current)
        print(f"\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Lần {attempt + 1} load được {live_count_current} thẻ live.")

        new_live_cards = live_last4_current - live_last4_prev

        if attempt < min_clicks_before_check:
            if new_live_cards:
                print(f"\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Phát hiện thêm \x1b[93m{len(new_live_cards)} thẻ live mới, tiếp tục load.")
            else:
                print(f"\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Lần {attempt + 1} chưa có thẻ live mới, vẫn tiếp tục load để đảm bảo đủ dữ liệu.")
        else:
            if not new_live_cards:
                print(f"\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Lần {attempt + 1} không có thẻ live mới, dừng check live và chuyển sang xử lý.")
                break
            else:
                print(f"\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Lần {attempt + 1} phát hiện thêm \x1b[93m{len(new_live_cards)} thẻ live mới, tiếp tục load.")

        live_cards_prev = live_cards_current
        live_last4_prev = live_last4_current
        attempt += 1

    if attempt == max_clicks and len(live_cards_prev) == 0:
        print(f"{COLORS['RED']}Không tìm thấy thẻ live sau {max_clicks} lần thử, tiếp tục xử lý với dữ liệu hiện tại.{COLORS['RESET']}")

    # Lọc live thẻ chỉ trong danh sách added_cards (5 thẻ đã thêm)
    added_last4 = set()
    line_map = {}
    for card in added_cards:
        card_num = card['number']
        last4 = card_num[-4:]
        added_last4.add(last4)
        line_map[last4] = card['line']

    # Chỉ lấy last4 live trong added_last4
    live_last4_filtered = live_last4_prev.intersection(added_last4)

    # Lấy dòng thẻ live chính xác
    live_lines = [line_map[l4] for l4 in live_last4_filtered if l4 in line_map]

    # Lấy dòng thẻ die (5 thẻ - thẻ live) - chỉ để in log, không lưu
    die_lines = [line_map[l4] for l4 in added_last4 if l4 not in live_last4_filtered]

    # Chỉ lưu thẻ live, không lưu thẻ die
    if live_lines:
        save_live_cards_to_file(live_lines, email)

    # Xóa đúng 5 dòng thẻ vừa check khỏi card.txt (đây là dòng thẻ của tài khoản hiện tại)
    lines_to_remove = [card['line'] for card in added_cards]
    remove_lines_from_file(card_file_path, lines_to_remove)

    print(f"{COLORS['BLUE']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Tài Khoản \x1b[93m{email} \x1b[96mCó Tổng thẻ thêm: \x1b[93m{len(added_cards)} \x1b[31mThẻ Die: \x1b[93m{len(die_lines)} \x1b[32mThẻ live: \x1b[93m{len(live_lines)}{COLORS['RESET']}")

    if len(live_lines) > 0:
        log_to_file('live.txt', email, cred['password'], cred['2fa'])
    else:
        print(f"{COLORS['RED']} Không tìm thấy thẻ hợp lệ nào trên tài khoản \x1b[93m{email}. DIE.{COLORS['RESET']}")
        log_to_file('die.txt', email, cred['password'], cred['2fa'])

    print(f"{COLORS['GREEN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Xử lý xong check live cho tài khoản \x1b[93m{email}{COLORS['RESET']}")

# Hàm delete_card giữ nguyên, không thay đổi (copy nguyên bản)
def delete_card(page, num_cards_to_delete=9999):
    retry_limit = 2
    deleted_cards = 0

    try:
        while True:
            page.goto('https://www.amazon.com/cpe/yourpayments/wallet')
            time.sleep(4)

            card_count = page.evaluate('''() => {
                const sidebar = document.querySelector('.a-scroller.apx-wallet-desktop-payment-method-selectable-tab-css.a-scroller-vertical');
                if (!sidebar) return 0;
                const Cards = sidebar.querySelectorAll('.a-section.apx-wallet-selectable-payment-method-tab');
                return Cards.length;
            }''')

            if card_count == 0:
                print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Tất cả thẻ đã xóa khỏi tài khoản{COLORS['RESET']}")
                break

            try:
                card_contents = page.query_selector_all('.a-section.apx-wallet-tab-pm-content')
                if len(card_contents) > 0:
                    card_contents[0].click()
                time.sleep(2)
                edit_card = page.wait_for_selector('//a[text()="Edit"]', timeout=5000)
                edit_card.click()
            except Exception:
                print(f"{COLORS['CYAN']} \x1b[31mKhông tìm thấy nút Edit nữa\x1b[93m, \x1b[31mđã xóa hết thẻ hoặc bị giới hạn.{COLORS['RESET']}")
                break
            
            time.sleep(2)

            retry_count = 0
            success = False
            while retry_count < retry_limit and not success:
                try:
                    remove_card = page.wait_for_selector('//input[@class="apx-remove-link-button"]', timeout=5000)
                    remove_card.click()

                    confirm_button = page.wait_for_selector(
                        '//span[@class="a-button a-button-primary pmts-delete-instrument apx-remove-button-desktop pmts-button-input"]',
                        timeout=5000)
                    confirm_button.click()
                    success = True
                    deleted_cards += 1
                    time.sleep(1.5)
                except Exception as e:
                    retry_count += 1
                    print(f"{COLORS['RED']} Lỗi khi xóa thẻ, thử lại lần \x1b[93m{retry_count}\x1b[31m: {e}{COLORS['RESET']}")
                    time.sleep(2)
                    if retry_count >= retry_limit:
                        print(f"{COLORS['RED']} Bỏ qua thẻ sau \x1b[93m{retry_limit} \x1b[31mlần thử không thành công{COLORS['RESET']}")
                        break

            if not success:
                continue

            if deleted_cards >= num_cards_to_delete:
                print(f"{COLORS['CYAN']}[ SoHan ] > Đã xóa đủ số thẻ yêu cầu: {deleted_cards}{COLORS['RESET']}")
                break

        return True

    except Exception as e:
        print(f"{COLORS['RED']}Error removing card: {e}{COLORS['RESET']}")
        return False

profile_counter_lock = threading.Lock()
profile_index = 0
profile_index_lock = threading.Lock()

def run_profile(profile_number, use_error_files=False):
    global profile_index
    # Nếu dùng file lỗi chạy lại, đọc lại file và set lại credentials tương ứng
    if use_error_files:
        # Đọc lại tài khoản lỗi
        error_credentials = read_credentials('taikhoanloi.txt')
        if profile_number > len(error_credentials):
            return
        cred = error_credentials[profile_number - 1]
        email = cred['email']
        password = cred['password']
        code_2fa = cred['2fa']

        # Đọc 5 thẻ lỗi tương ứng
        with open('theloi.txt', 'r', encoding='utf-8') as f:
            lines = f.readlines()
        # Lấy 5 thẻ tương ứng tài khoản (thứ tự đúng theo file)
        start_line = (profile_number - 1) * 5
        end_line = start_line + 5
        card_lines_for_account = lines[start_line:end_line]

        # Tạo danh sách credentials và cards cho hàm add_card chuẩn
        credentials_list = [cred]

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

                # Login
                if not login_amz(page, 1, credentials_list):
                    context.close()
                    browser.close()
                    return

                # add_card phải được sửa để chấp nhận thẻ từ biến thay vì file card.txt
                added_cards = add_card_from_lines(page, card_lines_for_account, credentials_list, 1)
                if not added_cards:
                    print(f"{COLORS['RED']}Không thêm được thẻ nào cho profile lỗi \x1b[93m{profile_number}{COLORS['RESET']}")
                    context.close()
                    browser.close()
                    return

                check_and_save_cards(page, email, cred, 0, 5, added_cards)

                delete_card(page, num_cards_to_delete=len(added_cards))

                print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Đã hoàn thành quá trình cho tài khoản lỗi \x1b[93m{profile_number} {COLORS['RESET']}")
                time.sleep(5)
                context.close()
                browser.close()
        except Exception as e:
            print(f"{COLORS['RED']}[ SoHan ][ERROR] > Lỗi thêm thẻ trong quá trình của tài khoản lỗi {profile_number}: {e}{COLORS['RESET']}")

        return

    # Chạy profile bình thường
    start_line = (profile_number - 1) * 5
    end_line = start_line + 5
    for attempt in range(retries):
        print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Đang tiến hành mở profile \x1b[93m{profile_number} \x1b[32mđể chạy tài khoản \x1b[93m{profile_number}{COLORS['RESET']}")
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

                check_and_save_cards(page, credentials[profile_number - 1]['email'], credentials[profile_number - 1], start_line, end_line, added_cards)

                delete_card(page, num_cards_to_delete=len(added_cards))

                # Ghi profile thành công vào maildone.txt và xóa khỏi mailadd.txt
                cred = credentials[profile_number - 1]
                remove_account_from_mailadd(cred['email'], cred['password'], cred['2fa'])
                log_to_file('maildone.txt', cred['email'], cred['password'], cred['2fa'])

                print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Đã hoàn thành quá trình cho tài khoản \x1b[93m{profile_number} {COLORS['RESET']}")
                time.sleep(5)
                context.close()
                browser.close()
                break
        except Exception as e:
            print(f"{COLORS['RED']}[ SoHan ][ERROR] > Lỗi thêm thẻ trong quá trình của tài khoản {profile_number}: {e}{COLORS['RESET']}")
            if attempt < retries - 1:
                print(f"{COLORS['GREEN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Đang thử lại \x1b[93m{attempt + 1} \x1b[32mcho tài khoản \x1b[93m{profile_number} \x1b[32mthêm thẻ{COLORS['RESET']}")
            else:
                print(f"{COLORS['RED']} Không thành công sau \x1b[93m{retries} \x1b[32mlần thử cho tải khoản \x1b[93m{profile_number} thêm thẻ{COLORS['RESET']}")
            continue

def add_card_from_lines(page, card_lines, credentials_list, profile_number):
    """
    Phiên bản add_card dùng list thẻ từ file theloi.txt cho chạy lại
    Cách dùng tương tự add_card, nhưng thay vì đọc file card.txt sẽ dùng card_lines truyền vào
    """
    retry_limit = 3
    added_cards = []
    max_cards_per_account = 5

    cred = credentials_list[profile_number - 1]
    email = cred['email']
    password = cred['password']
    code_2fa = cred['2fa']

    cards_to_add = card_lines[:max_cards_per_account]

    for card_line in cards_to_add:
        if len(added_cards) >= max_cards_per_account:
            print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Đã đạt giới hạn \x1b[92m{max_cards_per_account} \x1b[32mthẻ cho tài khoản \x1b[93m{email}{COLORS['RESET']}")
            break

        parts = card_line.strip().split('|')
        if len(parts) < 3:
            print(f"{COLORS['RED']}[ SoHan ][ERROR] > Card line format error: {card_line.strip()}{COLORS['RESET']}")
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

                frame.fill("input[name='ppw-accountHolderName']", card_name)
                time.sleep(0.5)
                frame.fill("input[name='addCreditCardNumber']", card_number)
                time.sleep(1)

                frame.click("span.a-button-inner span.a-button-text span.a-dropdown-prompt")
                frame.click(f"//a[contains(text(), '{expiration_month}')]")

                frame.click("span.pmts-expiry-year span.a-button-inner span.a-button-text span.a-dropdown-prompt")
                frame.click(f"//a[contains(text(), '{expiration_year}')]")

                submit_btn = frame.query_selector("input[name='ppw-widgetEvent:AddCreditCardEvent']")
                if submit_btn:
                    submit_btn.click()
                    time.sleep(2)
                    added_cards.append({'number': card_number, 'line': card_line.strip()})
                    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Đã thêm thành công thẻ \x1b[93m{card_number} \x1b[32mcho tài khoản \x1b[93m{email} \x1b[33m{len(added_cards)}\x1b[94m/\x1b[32m{max_cards_per_account}{COLORS['RESET']}")
                    break
                else:
                    print(f"{COLORS['YELLOW']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Tài khoản \x1b[93m{email} \x1b[32mbị giới hạn \x1b[31m2 tiếng \x1b[32mĐang chuyển sang tài khoản khác để thêm thẻ.{COLORS['RESET']}")
                    return added_cards

            except Exception as e:
                retry_count += 1
                if retry_count >= retry_limit:
                    print(f"{COLORS['RED']} Lỗi thêm thẻ \x1b[93m{card_number} \x31msau \x1b[93m{retry_limit} \x31mthử cho tài khoản \x1b[93m{email}. Dừng thêm thẻ tiếp theo.{COLORS['RESET']}")
                    return added_cards
                else:
                    print(f"{COLORS['RED']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> \x1b[93m[\x1b[31m ERROR \x1b[93m] thêm thẻ \x1b[93m{card_number} \x1b[32mcho tài khoản \x1b[93m{email} \x1b[32mđang thử lại {retry_count}{COLORS['RESET']}")
                time.sleep(2)

    return added_cards

def worker_thread(use_error_files=False):
    global profile_index
    total_profiles = 0
    if use_error_files:
        error_credentials = read_credentials('taikhoanloi.txt')
        total_profiles = len(error_credentials)
    else:
        total_profiles = len(credentials)

    while True:
        with profile_index_lock:
            if profile_index >= total_profiles:
                break
            current_profile = profile_index + 1
            profile_index += 1
        run_profile(current_profile, use_error_files=use_error_files)

def run_profiles_dynamically():
    global profile_index, credentials  # Đưa global credentials lên đây
    while True:
        profile_index = 0
        threads = []
        max_threads = min(number_of_profiles, len(credentials))

        for _ in range(max_threads):
            t = threading.Thread(target=worker_thread)
            t.start()
            threads.append(t)

        for t in threads:
            t.join()

        print(f"{COLORS['BRIGHT_CYAN']}Đã chạy hết tất cả tài khoản trong \x1b[93mmailadd.txt.\n{COLORS['RESET']}")

        # Kiểm tra nếu có tài khoản lỗi cần chạy lại
        error_cred = read_credentials('taikhoanloi.txt')
        if error_cred:
            print(f"{COLORS['YELLOW']}Phát hiện tài khoản lỗi cần chạy lại: {len(error_cred)} tài khoản.{COLORS['RESET']}")
            # Chạy lại tài khoản lỗi
            profile_index = 0
            threads = []
            max_threads = min(number_of_profiles, len(error_cred))

            for _ in range(max_threads):
                t = threading.Thread(target=worker_thread, args=(True,))
                t.start()
                threads.append(t)

            for t in threads:
                t.join()

            # Sau khi chạy lại xong, xóa file lỗi
            open('taikhoanloi.txt', 'w').close()
            open('theloi.txt', 'w').close()

            print(f"{COLORS['BRIGHT_CYAN']}Đã chạy lại xong tất cả tài khoản lỗi.{COLORS['RESET']}")

        user_input = input(f"{COLORS['GREEN']}Bạn đã chạy xong hết tài khoản\x1b[93m, \x1b[32mvui lòng tắt hoặc nhập \x1b[93m'y\x1b[93m' \x1b[32mđể thoát\x1b[93m: {COLORS['RESET']}").strip().lower()
        if user_input == 'y':
            print(f"{COLORS['RED']}Thoát chương trình...{COLORS['RESET']}")
            break
        else:
            # Nạp lại credentials mới từ mailadd.txt nếu người dùng muốn chạy lại
            credentials = read_credentials()
            print(f"{COLORS['BRIGHT_CYAN']}\x1b[93m[ \x1b[35mSoHan \x1b[93m] \x1b[32m> Chạy lại tất cả tài khoản từ đầu\x1b[93m...\n\n{COLORS['RESET']}")

if __name__ == '__main__':
    try:
        run_profiles_dynamically()
    except KeyboardInterrupt:
        print(f"{COLORS['GREEN']}Quá trình đã bị người dùng tắt đang thoát\x1b[93m...{COLORS['RESET']}")
    except Exception as e:
        print(f"{COLORS['RED']}Lỗi không mong muốn: {e}{COLORS['RESET']}")
