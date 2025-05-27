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

init()
print(Fore.GREEN + 'ADD CARD AMZ V1' + Style.RESET_ALL)
number_of_profiles = int(input(Fore.MAGENTA + 'Nhập số luồng chạy profile: ' + Style.RESET_ALL))
retries = int(input(Fore.MAGENTA + 'Nhập số lần thử lại khi gặp lỗi (Nếu chọn số 1 sẽ không thử lại): ' + Style.RESET_ALL))
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
        print("Captcha solve error:", e)

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
            print(f"Đã đạt giới hạn {max_cards_per_account} thẻ cho tài khoản {email}")
            break

        parts = card_line.strip().split('|')
        if len(parts) < 3:
            print(f"Card line format error: {card_line.strip()}")
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
                    print(f"Không tìm thấy link Add a credit or debit card sau khi cập nhật HTML cho tài khoản {email}")
                    
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
                    print(f"Đã thêm thành công thẻ {card_number} cho tài khoản {email}. Tổng số thẻ đã thêm: {len(added_cards)}/{max_cards_per_account}")
                    break
                else:
                    print(f"Tài khoản {email} bị giới hạn 2 tiếng. Vui lòng chuyển sang tài khoản khác để thêm thẻ.")
                    return added_cards

            except Exception as e:
                print(f"Error adding card {card_number} cho tài khoản {email}: {e}")
                retry_count += 1
                if retry_count >= retry_limit:
                    print(f"Failed to add card {card_number} after {retry_limit} attempts cho tài khoản {email}")
                else:
                    print(f"Retry {retry_count} for card {card_number} cho tài khoản {email}")

    print(f"Hoàn thành thêm thẻ cho tài khoản {email}. Tổng số thẻ đã thêm: {len(added_cards)}")
    return added_cards

def check_and_save_cards(page, email, cred, start_line, end_line):
    page.goto('https://www.amazon.com/cpe/yourpayments/wallet')
    # Wait for network to be idle to ensure page loads completely
    page.wait_for_load_state('networkidle')
    # Wait additional time to ensure all elements are loaded
    time.sleep(15)
    # Refresh page to ensure fresh content
    page.reload()
    # Wait again for network to be idle after refresh
    page.wait_for_load_state('networkidle')
    # Final wait to ensure everything is loaded
    time.sleep(10)

    page.reload()

    page.wait_for_load_state('networkidle')


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
    print(f"{Fore.BLUE}Account {email} - Tổng thẻ: {total_cards}, Bị loại: {skip_count}, Thẻ live thực sự: {live_card_count}{Fore.RESET}")

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
        print(f'{Fore.RED}No valid cards found on account {email}. Marking as DIE.{Fore.RESET}')
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

    print(f"{Fore.GREEN}Finished processing account {email} - Live cards: {len(live_lines)}, Deleted cards: {len(die_lines)}{Fore.RESET}")

def delete_card(page, num_cards_to_delete=5):
    try:
        retry_count = 0
        max_retries = 2
        
        while True:
            page.goto('https://www.amazon.com/cpe/yourpayments/wallet')
            page.wait_for_load_state('networkidle')

            for _ in range(3):
                page.reload()
                page.wait_for_load_state('networkidle')
                time.sleep(10)

            page.reload()
            page.wait_for_load_state('networkidle')

            card_count = page.evaluate('''() => {
                const sidebar = document.querySelector('.a-scroller.apx-wallet-desktop-payment-method-selectable-tab-css.a-scroller-vertical');
                if (!sidebar) return 0;
                const Cards = sidebar.querySelectorAll('.a-section.apx-wallet-selectable-payment-method-tab');
                return Cards.length;
            }''')

            if card_count == 0:
                print('All cards have been deleted')
                return True

            try:
                edit_card = page.wait_for_selector('//a[text()="Edit"]', timeout=5000)
            except Exception:
                print('No more cards to delete (Edit button not found)')
                break

            edit_card.click()
            time.sleep(2)

            try:
                remove_card = page.wait_for_selector('//input[@class="apx-remove-link-button"]', timeout=5000)
                remove_card.click()
            except PlaywrightTimeoutError:
                retry_count += 1
                if retry_count >= max_retries:
                    print("Tài khoản đã bị giới hạn lượt xóa thẻ hoặc dư thẻ để xóa")
                    return False
                    
                print(f"Đã bị quá tải xóa thẻ - Lần thử {retry_count}/{max_retries}")
                time.sleep(2)

                confirm_button = page.wait_for_selector('//span[@class="a-button a-button-primary pmts-delete-instrument apx-remove-button-desktop pmts-button-input"]', timeout=5000)
                confirm_button.click()
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
                    page.reload()
                    
                    time.sleep(2)

                    start_button_delete = page.wait_for_selector('//*[@id="pp-i41mW6-25"]', timeout=5000)
                    start_button_delete.click()
                    time.sleep(2)
                    continue
                except Exception as e:
                    print('Error clicking remove button:', e)
                    break

        return True
    except Exception as e:
        print('Error removing card:', e)
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
        print(f'START PROFILE addcard{profile_number}------------------')
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
                    print(f'Không thêm được thẻ nào cho profile {profile_number}')
                    context.close()
                    browser.close()
                    break

                check_and_save_cards(page, credentials[profile_number - 1]['email'], credentials[profile_number - 1], start_line, end_line)

                delete_card(page, num_cards_to_delete=len(added_cards))

                print('Check Acc Complete')
                time.sleep(5)
                context.close()
                browser.close()
                break
        except Exception as e:
            print(f'Error in thread addcard{profile_number}:', e)
            if attempt < retries - 1:
                print(f'Retry {attempt + 1} for profile addcard{profile_number}')
            else:
                print(f'Failed after {retries} attempts for profile addcard{profile_number}')
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

        print(Fore.CYAN + "\nDONE! Đã chạy hết tất cả tài khoản trong mailadd.txt.\n" + Fore.RESET)
        # Hỏi người dùng muốn thoát hay chạy lại
        user_input = input("Bạn đã chạy xong hết tài khoản, vui lòng tắt hoặc nhập 'y' để thoát: ").strip().lower()
        if user_input == 'y':
            print("Thoát chương trình...")
            break
        else:
            print("Chạy lại tất cả tài khoản từ đầu...\n\n")

if __name__ == '__main__':
    try:
        run_profiles_dynamically()
    except KeyboardInterrupt:
        print('Process interrupted by user. Exiting...')
    except Exception as e:
        print('Unexpected error:', e)
