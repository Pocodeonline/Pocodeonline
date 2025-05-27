import time
import threading
import random
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

profile_counter = 1
profile_counter_lock = threading.Lock()
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

def log_to_file(file_path, email, password, code_2fa):
    with open(file_path, 'a') as file:
        file.write(f'{email}|{password}|{code_2fa}\n')

def login_amz(page, profile_number, credentials):
    page.goto('https://na.account.amazon.com/ap/signin?_encoding=UTF8&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.pape.max_auth_age=0&ie=UTF8&openid.ns.pape=http%3A%2F%2Fspecs.openid.net%2Fextensions%2Fpape%2F1.0&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&pageId=lwa&openid.assoc_handle=amzn_lwa_na&marketPlaceId=ATVPDKIKX0DER&arb=e2bc4dbc-2218-4697-8323-886562f341f1&language=en_US&openid.return_to=https%3A%2F%2Fna.account.amazon.com%2Fap%2Foa%3FmarketPlaceId%3DATVPDKIKX0DER%26arb%3De2bc4dbc-2218-4697-8323-886562f341f1%26language%3Den_US&enableGlobalAccountCreation=1&metricIdentifier=amzn1.application.eb539eb1b9fb4de2953354ec9ed2e379&signedMetricIdentifier=fLsotU64%2FnKAtrbZ2LjdFmdwR3SEUemHOZ5T2deI500%3D')
    
    email = credentials[profile_number - 1]['email']
    password = credentials[profile_number - 1]['password']
    code_2fa = credentials[profile_number - 1]['2fa']

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

def add_card(page, start_line, end_line, credentials, profile_number):
    retry_limit = 3
    added_cards = []

    email = credentials[profile_number - 1]['email']
    password = credentials[profile_number - 1]['password']
    code_2fa = credentials[profile_number - 1]['2fa']

    try:
        with open(card_file_path, 'r') as f:
            cards = f.readlines()
    except Exception:
        print("Error reading card file")
        return False

    switched_url = False

    for index, card_line in enumerate(cards[start_line:end_line], start=start_line):
        # Check if we've already added 5 cards
        if len(added_cards) >= 5:
            print('Đã thêm đủ 5 thẻ.')
            return True

        parts = card_line.strip().split('|')
        if len(parts) < 3:
            print(f"Card line format error: {card_line.strip()}")
            continue
        card_number, expiration_month, expiration_year = parts[:3]

        retry_count = 0
        while retry_count < retry_limit:
            try:
                if not switched_url:
                    page.goto('https://www.amazon.com/hp/shopwithpoints/account/?programId=MERCURYFINANCIAL-POINTS-US&productId=MERCURYFINANCIAL-POINTS-US&')
                else:
                    page.goto('https://www.amazon.com/hp/shopwithpoints/account/?programId=FISERV-CASH-US&productId=FISERV-CASH-US&')

                # Check for captcha
                try:
                    img_element = page.query_selector('//img[@id="d"]')
                    if img_element:
                        page.reload()
                        retry_count += 1
                        continue
                except:
                    pass

                link_add_card = page.wait_for_selector('//a[@href="/hp/shopwithpoints/addCard/"]', timeout=10000)
                page.evaluate('(element) => element.click()', link_add_card)
                time.sleep(2)

                # Get card name first
                card_name = page.evaluate('''() => {
                    const spanElement = document.evaluate("//span[@id='nav-link-accountList-nav-line-1']", 
                        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if(spanElement){
                        return spanElement.textContent.replace('Hello, ', '').trim();
                    }
                    return null;
                }''')
                if not card_name:
                    card_name = "User"

                # Click add card and wait for iframe
                add_card_credit = page.wait_for_selector('//a[contains(text(), "Add a credit or debit card")]', timeout=10000)
                if add_card_credit:
                    page.evaluate('(element) => element.click()', add_card_credit)
                    time.sleep(2)
                    
                    # Wait for iframe and fill name immediately
                    iframe = page.wait_for_selector("iframe[name*='ApxSecureIframe']", timeout=10000)
                    frame = iframe.content_frame()
                    
                    frame.fill("input[name='ppw-accountHolderName']", card_name)
                    time.sleep(2)
                    frame.fill("input[name='addCreditCardNumber']", card_number)
                    time.sleep(2)

                    # Select month
                    frame.evaluate('''() => {
                        const selectElement = document.evaluate("//span[@class='a-button-text a-declarative']//span[text()='01']", 
                            document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        if(selectElement) selectElement.click();
                    }''')
                    time.sleep(2)
                    frame.evaluate(f'''(month) => {{
                        const selectElement = document.evaluate(`//a[contains(text(), '${{month}}')]`, 
                            document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        if(selectElement) selectElement.click();
                    }}''', expiration_month)
                    time.sleep(2)

                    # Select year
                    frame.evaluate('''() => {
                        const selectElement = document.evaluate("//span[@class='a-button-text a-declarative']//span[text()='2025']", 
                            document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        if(selectElement) selectElement.click();
                    }''')
                    time.sleep(2)
                    frame.evaluate(f'''(year) => {{
                        const selectElement = document.evaluate(`//a[contains(text(), '${{year}}')]`, 
                            document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        if(selectElement) selectElement.click();
                    }}''', expiration_year)
                    time.sleep(2)

                    # Submit
                    frame.evaluate('''() => {
                        const submitButton = document.querySelector('input[name="ppw-widgetEvent:AddCreditCardEvent"]');
                        if (submitButton) submitButton.click();
                    }''')

                    try:
                        frame.evaluate('''() => {
                            const useAddressBtn = document.querySelector("#pp-ABfiCO-20 > span > input");
                            if (useAddressBtn) useAddressBtn.click();
                        }''')
                        time.sleep(2)
                        
                        
                    except Exception as e:
                        print(f"Error clicking use address button: {str(e)}")
                        pass

                    try:
                        enroll_button = page.wait_for_selector("input[aria-labelledby='enroll_Button-announce'], input[aria-labelledby='enroll-button-desktop-announce']", timeout=10000)
                        if enroll_button:
                            print(f'Card {index + 1} added successfully.')
                            added_cards.append({'number': card_number, 'month': expiration_month, 'year': expiration_year})
                            log_complete_info('mailaddcomplete.txt', email, password, code_2fa, added_cards)
                            page.goto('https://www.amazon.com/hp/shopwithpoints/account/?programId=FISERV-CASH-US&productId=FISERV-CASH-US&')
                            
                            # Check if we've reached 5 cards after successful addition
                            if len(added_cards) >= 5:
                                print('Đã thêm đủ 5 thẻ.')
                                return True
                    except:
                        print('Enroll Button not found.')

                else:
                    print('Không tìm thấy phần tử Add a credit or debit card!')
                    retry_count += 1
                    continue

            except Exception as e:
                print('Phần tử không còn tồn tại, dừng click!')
                print('Có lỗi xảy ra:', str(e))
                if not switched_url:
                    print('Navigating to a new page to add card')
                    switched_url = True
                    retry_count = 0
                else:
                    print('Acc limit 2h')
                    return False

            retry_count += 1
        else:
            print('Error adding card')
            return False

    return added_cards

def check_and_save_cards(page, email, added_cards):
    page.goto('https://www.amazon.com/cpe/yourpayments/wallet')
    time.sleep(3)

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

    # Lưu thẻ live vào file
    if live_card_count > 0:
        # Bạn có thể lưu thẻ live vào file hoặc database ở đây
        pass
    else:
        print(f'{Fore.RED}No valid cards found on account {email}. Marking as DIE.{Fore.RESET}')
        # Bạn có thể lưu tài khoản die vào file hoặc database

def delete_card(page, num_cards_to_delete=9999):  # để mặc định xóa hết có thể
    retry_limit = 2
    deleted_cards = 0

    try:
        while True:  # lặp liên tục đến khi break
            page.goto('https://www.amazon.com/cpe/yourpayments/wallet')
            time.sleep(1.2)

            # Kiểm tra có thẻ hay không
            card_count = page.evaluate('''() => {
                const sidebar = document.querySelector('.a-scroller.apx-wallet-desktop-payment-method-selectable-tab-css.a-scroller-vertical');
                if (!sidebar) return 0;
                const Cards = sidebar.querySelectorAll('.a-section.apx-wallet-selectable-payment-method-tab');
                return Cards.length;
            }''')

            if card_count == 0:
                print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Tất cả thẻ đã xóa khỏi tài khoản{COLORS['RESET']}")
                break  # không còn thẻ nào, thoát vòng lặp

            # Thử lấy nút Edit, nếu không tìm được nghĩa là hết thẻ hoặc giới hạn
            try:
                edit_card = page.wait_for_selector('//a[text()="Edit"]', timeout=5000)
            except Exception:
                print(f"{COLORS['CYAN']}[ SU WO ] > Không tìm thấy nút Edit nữa, đã xóa hết thẻ hoặc bị giới hạn.{COLORS['RESET']}")
                break

            # Click nút Edit
            edit_card.click()
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
                # Không xóa được thẻ này, tiếp tục vòng lặp
                continue

            # Nếu đã xóa đủ số thẻ yêu cầu thì dừng
            if deleted_cards >= num_cards_to_delete:
                print(f"{COLORS['CYAN']}[ SU WO ] > Đã xóa đủ số thẻ yêu cầu: {deleted_cards}{COLORS['RESET']}")
                break

        return True

    except Exception as e:
        print(f"{COLORS['RED']}Error removing card: {e}{COLORS['RESET']}")
        return False


def run_profile(profile_number):
    start_line = (profile_number - 1) * 5
    end_line = start_line + 5

    for attempt in range(retries):
        print(f'START PROFILE addcard{profile_number}------------------')
        try:
            with sync_playwright() as playwright:
                x, y = get_next_position()
                browser = playwright.chromium.launch(
                    headless=False,
                    args=[
                        f'--window-size={window_width},{window_height}',
                        f'--window-position={x},{y}'
                    ]
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

                if added_cards is False:
                    print(f"Tài khoản {credentials[profile_number - 1]['email']} bị giới hạn thêm thẻ, đổi tài khoản khác ngay.")
                    context.close()
                    browser.close()
                    return  # thoát luồng, sang tài khoản khác

                if not added_cards:
                    print(f'Không thêm được thẻ nào cho profile {profile_number}')
                    context.close()
                    browser.close()
                    break

                check_and_save_cards(page, credentials[profile_number - 1]['email'], added_cards)

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

def run_profiles_dynamically():
    global profile_counter
    threads = []
    max_threads = min(number_of_profiles, len(credentials))
    for i in range(max_threads):
        with profile_counter_lock:
            profile_number = profile_counter
            profile_counter += 1
        t = threading.Thread(target=run_profile, args=(profile_number,))
        t.start()
        threads.append(t)
    for i in range(max_threads, number_of_profiles):
        with profile_counter_lock:
            profile_number = profile_counter
            profile_counter += 1
        t = threading.Thread(target=run_profile, args=(profile_number,))
        t.start()
        threads.append(t)
    for t in threads:
        t.join()

if __name__ == '__main__':
    try:
        run_profiles_dynamically()
    except KeyboardInterrupt:
        print('Process interrupted by user. Exiting...')
    except Exception as e:
        print('Unexpected error:', e)
