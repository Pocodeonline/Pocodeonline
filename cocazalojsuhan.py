import os
import subprocess
import cv2
import numpy as np
import time
import threading
import requests
import base64
import re
from colorama import init

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

print(f"{COLORS['YELLOW']} {COLORS['BRIGHT_CYAN']}Tool Voucher CocaZalo By SoHan JVS {COLORS['RESET']}")

def image_path(filename):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "image", filename)

class Auto:
    def __init__(self, device_id):
        self.device_id = device_id

    def screen_capture(self):
        try:
            tmp_path = "/sdcard/temp_screencap.png"
            subprocess.run(
                ["adb", "-s", self.device_id, "shell", "screencap", "-p", tmp_path],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            local_tmp = "temp_screencap.png"
            subprocess.run(
                ["adb", "-s", self.device_id, "pull", tmp_path, local_tmp],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            img = cv2.imread(local_tmp)
            if img is None:
                print(f"{COLORS['BRIGHT_YELLOW']}[ SoHan ] {COLORS['GREEN']}> {COLORS['RED']}[ERROR] Không đọc được file ảnh temp_screencap.png")
            os.remove(local_tmp)
            subprocess.run(
                ["adb", "-s", self.device_id, "shell", "rm", tmp_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            return img
        except subprocess.CalledProcessError as e:
            print(f"{COLORS['BRIGHT_YELLOW']}[ SoHan ] {COLORS['GREEN']}> {COLORS['RED']}[ERROR] Lỗi khi chụp màn hình bằng adb shell screencap:", e)
            return None

    def find_image(self, template_filename, threshold=0.95):
        screen = self.screen_capture()
        if screen is None:
            print(f"{COLORS['BRIGHT_YELLOW']}[ SoHan ] {COLORS['GREEN']}> {COLORS['RED']}[ERROR]Không có ảnh màn hình để xử lý.")
            return None

        template_path = image_path(template_filename)
        template = cv2.imread(template_path)
        if template is None:
            print(f"{COLORS['BRIGHT_YELLOW']}[ SoHan ] {COLORS['GREEN']}> {COLORS['RED']}Không tìm thấy file ảnh mẫu: {template_path}")
            return None

        res = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
        loc = np.where(res >= threshold)
        points = list(zip(*loc[::-1]))
        if points:
            return points[0]
        return None

    def click(self, x, y):
        x_int = round(x)
        y_int = round(y)
        cmd = f"adb -s {self.device_id} shell input tap {x_int} {y_int}"
        os.system(cmd)
        time.sleep(0.1)

    def escape_adb_input_text(self, text):
        escape_chars = ['&','|','<','>','*','^','"',"'",'\\','/']
        safe_text = text.replace(' ', '%s')
        for ch in escape_chars:
            safe_text = safe_text.replace(ch, f"\\{ch}")
        return safe_text

    def input_text_full(self, text):
        safe_text = self.escape_adb_input_text(text)
        os.system(f'adb -s {self.device_id} shell input text "{safe_text}"')
        time.sleep(0.2)

    def click_and_hold(self, x, y, duration_ms=600):
        cmd = f'adb -s {self.device_id} shell input swipe {round(x)} {round(y)} {round(x)} {round(y)} {duration_ms}'
        os.system(cmd)
        time.sleep(duration_ms / 1000 + 0.1)

def wait_for_image(auto, img_path, timeout=30, threshold=0.95):
    start = time.time()
    while time.time() - start < timeout:
        pos = auto.find_image(img_path, threshold)
        if pos:
            return pos
        time.sleep(0.5)
    return None

def process_captcha_image(input_path, output_path):
    try:
        img = cv2.imread(input_path)
        if img is None:
            print(f"{COLORS['RED']}[ERROR] Không đọc được file ảnh {input_path}")
            return False

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        lower_yellow = np.array([20, 100, 100])
        upper_yellow = np.array([40, 255, 255])
        mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)

        kernel_close = cv2.getStructuringElement(cv2.MORPH_RECT, (5,5))
        mask_clean = cv2.morphologyEx(mask_yellow, cv2.MORPH_CLOSE, kernel_close, iterations=2)
        kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (3,3))
        mask_clean = cv2.morphologyEx(mask_clean, cv2.MORPH_OPEN, kernel_open, iterations=2)
        kernel_dilate_erode = cv2.getStructuringElement(cv2.MORPH_RECT, (3,3))
        mask_clean = cv2.dilate(mask_clean, kernel_dilate_erode, iterations=1)
        mask_clean = cv2.erode(mask_clean, kernel_dilate_erode, iterations=1)

        _, mask_clean = cv2.threshold(mask_clean, 127, 255, cv2.THRESH_BINARY)
        black_background = np.zeros_like(img)
        result = cv2.bitwise_and(img, img, mask=mask_clean)
        cv2.imwrite(output_path, result)
        print(f"{COLORS['GREEN']}> Ảnh captcha đã được xử lý nền đen chuẩn, lưu thành {output_path}")
        return True
    except Exception as e:
        print(f"{COLORS['RED']}[ERROR] Lỗi xử lý ảnh captcha: {e}")
        return False

def read_api_key_from_file():
    key_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "key.txt")
    if not os.path.isfile(key_path):
        print(f"{COLORS['RED']}[ERROR] File key.txt chứa API key không tồn tại.")
        return None
    try:
        with open(key_path, "r", encoding="utf-8") as f:
            key = f.read().strip()
            if not key:
                print(f"{COLORS['RED']}[ERROR] File key.txt rỗng.")
                return None
            return key
    except Exception as e:
        print(f"{COLORS['RED']}[ERROR] Lỗi đọc file key.txt: {e}")
        return None

def get_image_base64_from_file(path):
    try:
        with open(path, "rb") as f:
            img_bytes = f.read()
            return base64.b64encode(img_bytes).decode()
    except Exception as e:
        print(f"{COLORS['RED']}Lỗi khi đọc file ảnh: {e}")
        return None

def call_ocr_api(img_base64, endpoint, api_key):
    headers = {
        "apikey": api_key,
    }
    data = {
        "base64Image": "data:image/png;base64," + img_base64,
        "language": "eng",
        "isOverlayRequired": False,
        "OCREngine": 2,
    }
    try:
        response = requests.post(endpoint, data=data, headers=headers, timeout=30)
        if response.status_code == 200:
            result = response.json()
            if result.get("IsErroredOnProcessing"):
                print(f"{COLORS['RED']}Lỗi API: {result.get('ErrorMessage')}")
                return None
            else:
                parsed_results = result.get("ParsedResults")
                if parsed_results and len(parsed_results) > 0:
                    text = parsed_results[0].get("ParsedText").strip()
                    return text
                else:
                    print(f"{COLORS['YELLOW']}Không có kết quả phân tích từ API.")
                    return None
        else:
            print(f"{COLORS['RED']}Lỗi HTTP: {response.status_code}")
            return None
    except Exception as e:
        print(f"{COLORS['RED']}Lỗi gọi API: {e}")
        return None

def fix_ocr_text(text):
    mapping = {
        'a': 'q',
        'O': 'Q',
    }
    corrected_chars = []
    for ch in text:
        if ch in mapping:
            ch = mapping[ch]
        if re.match(r'[a-zA-Z0-9]', ch):
            corrected_chars.append(ch)
    corrected = ''.join(corrected_chars)
    if len(corrected) < 4:
        return None
    return corrected

def solve_captcha_from_api(img_path, endpoint, api_key):
    img_base64 = get_image_base64_from_file(img_path)
    if not img_base64:
        print(f"{COLORS['RED']}Không lấy được ảnh base64 từ file captcha.")
        return None
    print(f"{COLORS['GREEN']}Đang gọi API OCR: {endpoint}")
    raw_text = call_ocr_api(img_base64, endpoint, api_key)
    if raw_text:
        print(f"{COLORS['GREEN']}Kết quả captcha đọc được (gốc): {COLORS['YELLOW']}{raw_text}")
        fixed_text = fix_ocr_text(raw_text)
        if not fixed_text:
            print(f"{COLORS['RED']}[ERROR] Mã captcha sau khi lọc không hợp lệ hoặc quá ngắn.")
            return None
        print(f"{COLORS['GREEN']}Mã captcha sau khi fix và lọc ký tự: {COLORS['YELLOW']}{fixed_text}")
        return fixed_text.strip()
    else:
        print(f"{COLORS['YELLOW']}API {endpoint} không trả về kết quả.")
        return None

def solve_captcha_with_fallback(img_path):
    API_ENDPOINTS = [
        "https://apipro1.ocr.space/parse/image",
        "https://apipro2.ocr.space/parse/image"
    ]
    api_key = read_api_key_from_file()
    if not api_key:
        return None

    ok_img_path = os.path.join(os.path.dirname(img_path), "ok.png")
    success = process_captcha_image(img_path, ok_img_path)
    if not success:
        return None

    api_index = 0
    max_attempts = 4
    attempt = 0

    while attempt < max_attempts:
        endpoint = API_ENDPOINTS[api_index]
        captcha_text = solve_captcha_from_api(ok_img_path, endpoint, api_key)
        if captcha_text:
            return captcha_text
        else:
            print(f"{COLORS['YELLOW']}API {endpoint} lỗi, sẽ load lại captcha và đổi API...")
            attempt += 1
            api_index = 1 - api_index
            return None
    print(f"{COLORS['RED']}Không thể giải captcha qua các API OCR đã cung cấp sau {max_attempts} lần thử.")
    return None

def handle_done_click(auto):
    start = time.time()
    timeout_check = 5
    while time.time() - start < timeout_check:
        if auto.find_image('loicapcha.png', 0.95):
            print(f"{COLORS['RED']}[ERROR] Nhập lỗi captcha, làm captcha mới")
            auto.click(168.2, 1007.0)
            time.sleep(0.2)
            for _ in range(7):
                os.system(f'adb -s {auto.device_id} shell input keyevent 67')
                time.sleep(0.03)
            print(f"{COLORS['GREEN']}> Đã xóa captcha cũ trong ô nhập captcha.")

            # Thay đổi xử lý: thay vì loadlaicapcha.png, dùng loadlai.png + dongyloadlai.png + dienma.png
            pos_loadlai = wait_for_image(auto, 'loadlai.png', timeout=15)
            if pos_loadlai:
                auto.click(*pos_loadlai)
                print(f"{COLORS['YELLOW']}> Đã click load lại mã captcha.")
            else:
                print(f"{COLORS['RED']}[ERROR] Không tìm thấy ảnh load lại mã captcha.")
                return 'repeat_captcha'

            pos_dongy = wait_for_image(auto, 'dongyloadlai.png', timeout=15)
            if pos_dongy:
                auto.click(*pos_dongy)
                print(f"{COLORS['YELLOW']}> Đã xác nhận load lại mã captcha.")
            else:
                print(f"{COLORS['RED']}[ERROR] Không tìm thấy ảnh đồng ý load lại captcha.")
                return 'repeat_captcha'

            pos_dienma = wait_for_image(auto, 'dienma.png', timeout=15)
            if pos_dienma:
                time.sleep(1.5)
                auto.click(*pos_dienma)
                print(f"{COLORS['YELLOW']}> Đã click vào ô nhập mã để nhập lại captcha.")
            else:
                print(f"{COLORS['RED']}[ERROR] Không tìm thấy chỗ nhập mã captcha.")
                return 'repeat_captcha'

            return 'reload_captcha_input'

        if auto.find_image('nhaplaima.png', 0.95):
            print(f"{COLORS['YELLOW']}> Phát hiện mã đã nhập rồi, sẽ click xóa và load lại mã mới.")
            auto.click(450.0, 551.8)
            time.sleep(0.2)
            pos_loadlai = wait_for_image(auto, 'loadlai.png', timeout=15)
            if pos_loadlai:
                auto.click(*pos_loadlai)
                print(f"{COLORS['YELLOW']}> Đang load lại mã...")
            else:
                print(f"{COLORS['RED']}[ERROR] Không tìm thấy ảnh load lại mã.")
            pos_dongy = wait_for_image(auto, 'dongyloadlai.png', timeout=15)
            if pos_dongy:
                auto.click(*pos_dongy)
                print(f"{COLORS['YELLOW']}> Xác nhận load lại mã thành công.")
            else:
                print(f"{COLORS['RED']}[ERROR] Không tìm thấy chỗ xác nhận load lại mã.")
            return 'code_error'

        if auto.find_image('nhapkhongdungma.png', 0.95):
            print(f"{COLORS['YELLOW']}> Phát hiện nhập không đúng mã, sẽ load lại mã mới ngay.")
            pos_loadlai = wait_for_image(auto, 'loadlai.png', timeout=15)
            if pos_loadlai:
                auto.click(*pos_loadlai)
                print(f"{COLORS['YELLOW']}> Đang load lại mã...")
            else:
                print(f"{COLORS['RED']}[ERROR] Không tìm thấy ảnh load lại mã.")
                return 'repeat_captcha'

            pos_dongy = wait_for_image(auto, 'dongyloadlai.png', timeout=15)
            if pos_dongy:
                auto.click(*pos_dongy)
                print(f"{COLORS['YELLOW']}> Xác nhận load lại mã thành công.")
            else:
                print(f"{COLORS['RED']}[ERROR] Không tìm thấy chỗ xác nhận load lại mã.")
                return 'repeat_captcha'

            pos_dienma = wait_for_image(auto, 'dienma.png', timeout=15)
            if pos_dienma:
                time.sleep(1.5)
                auto.click(*pos_dienma)
                print(f"{COLORS['YELLOW']}> Đã click vào ô nhập mã để nhập lại captcha.")
            else:
                print(f"{COLORS['RED']}[ERROR] Không tìm thấy chỗ nhập mã captcha.")
                return 'repeat_captcha'

            return 'reload_captcha_input'

        if auto.find_image('macocasai.png', 0.95):
            print(f"{COLORS['YELLOW']}> Mã coca sai chạy mã mới thôi...")
            if wait_for_image(auto, 'loadlai.png', timeout=15):
                auto.click(859.1, 94.0)
                if wait_for_image(auto, 'dongyloadlai.png', timeout=15):
                    auto.click(683.0, 110.2)
                    time.sleep(0.5)
                    return 'code_retry_same'

        if auto.find_image('chucmung.png', 0.95):
            print(f"{COLORS['GREEN']}> Nhập mã coca thành công ")
            if wait_for_image(auto, 'tieptucnhaptiepmamoi.png', timeout=30):
                pos_continue = auto.find_image('tieptucnhaptiepmamoi.png', 0.95)
                if pos_continue:
                    auto.click(*pos_continue)
                    print(f"{COLORS['GREEN']}> Đã click vào nút tiếp tục nhập mã mới.")
                else:
                    print(f"{COLORS['YELLOW']}> Không thấy nút tiếp tục nhập mã mới, bỏ qua.")
            else:
                print(f"{COLORS['YELLOW']}> Đợi tiếp tục nhập mã mới quá lâu, bỏ qua.")
            return 'success'

        time.sleep(0.1)
    return None

DEVICE_SERIAL = None
WATCH_PATH = "/storage/emulated/0/Download/zalo"
LOCAL_SAVE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_FILENAME = "captcha.png"

def get_connected_device():
    devices_raw = subprocess.check_output("adb devices").decode()
    devices = []
    for line in devices_raw.splitlines():
        if "\tdevice" in line:
            devices.append(line.split("\t")[0])
    if devices:
        return devices[0]
    else:
        return None

def list_all_files_with_time(device, base_path):
    try:
        find_cmd = f'adb -s {device} shell find "{base_path}" -type f'
        output = subprocess.check_output(find_cmd, shell=True).decode(errors='ignore')
        filepaths = output.strip().splitlines()
        files_with_time = []
        for f in filepaths:
            stat_cmd = f'adb -s {device} shell stat -c %Y "{f}"'
            stat_out = subprocess.check_output(stat_cmd, shell=True).decode(errors='ignore').strip()
            try:
                timestamp = int(stat_out)
            except:
                timestamp = 0
            files_with_time.append((f, timestamp))
        return files_with_time
    except subprocess.CalledProcessError:
        return []

def pull_and_rename(device, remote_path, local_path):
    print(f"Đang tải file {remote_path} về {local_path}")
    cmd = f'adb -s {device} pull "{remote_path}" "{local_path}"'
    result = subprocess.run(cmd, shell=True)
    if result.returncode == 0:
        print(f"{COLORS['GREEN']}> Tải thành công captcha")
    else:
        print("Tải thất bại.")

def watch_and_pull_latest(stop_event, device, last_timestamp):
    try:
        files = list_all_files_with_time(device, WATCH_PATH)
        if not files:
            return None, last_timestamp
        files.sort(key=lambda x: x[1], reverse=True)
        latest_file, latest_time = files[0]
        if latest_time > last_timestamp:
            local_path = os.path.join(LOCAL_SAVE_DIR, LOCAL_FILENAME)
            pull_and_rename(device, latest_file, local_path)
            return local_path, latest_time
        else:
            return None, last_timestamp
    except Exception as e:
        print(f"{COLORS['RED']}[ERROR] Lỗi tìm file trong watch_and_pull_latest: {e}")
        return None, last_timestamp

def remove_all_files_in_watchpath(device, watch_path):
    try:
        list_files_cmd = f'adb -s {device} shell find "{watch_path}" -type f'
        output = subprocess.check_output(list_files_cmd, shell=True).decode(errors='ignore').strip()
        if not output:
            print(f"{COLORS['GREEN']}> Không có file nào trong thư mục {watch_path} của thiết bị để xóa.")
            return
        files = output.splitlines()
        for f in files:
            rm_cmd = f'adb -s {device} shell rm "{f}"'
            subprocess.run(rm_cmd, shell=True)
            print(f"{COLORS['GREEN']}> Đã xóa file: {f}")
        print(f"{COLORS['GREEN']}> Đã xóa hết file trong thư mục thiết bị.")
    except subprocess.CalledProcessError as e:
        print(f"{COLORS['RED']}[ERROR] Lỗi khi xóa file trong thư mục: {e}")

def watch_pull_loop(stop_event, device, last_timestamp_container):
    while not stop_event.is_set():
        local_file, new_time = watch_and_pull_latest(stop_event, device, last_timestamp_container[0])
        if local_file:
            last_timestamp_container[0] = new_time
        time.sleep(1)

def main():
    out = subprocess.check_output("adb devices", shell=True).decode()
    devices = []
    for line in out.strip().split('\n')[1:]:
        if 'device' in line:
            devices.append(line.split('\t')[0])
    if not devices:
        print(f"{COLORS['RED']}[ERROR] Không tìm thấy thiết bị adb nào.")
        return
    device = devices[0]
    print(f"{COLORS['GREEN']}> Đang sử dụng thiết bị : {device}")

    macoca_path = 'macoca.txt'
    maloikitu_path = 'maloikitu.txt'

    try:
        with open(macoca_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        valid_codes = []
        invalid_codes = []

        for line in lines:
            code = line.strip()
            if len(code) == 12:
                valid_codes.append(code + '\n')
            else:
                if code:
                    invalid_codes.append(code + '\n')

        with open(macoca_path, 'w', encoding='utf-8') as f:
            f.writelines(valid_codes)

        with open(maloikitu_path, 'w', encoding='utf-8') as f:
            f.writelines(invalid_codes)

        print(f"{COLORS['GREEN']}> Đã lọc file {macoca_path}:")
        print(f"  - Số mã hợp lệ (12 ký tự): {len(valid_codes)}")
        print(f"  - Số mã không đủ hoặc thừa ký tự đã chuyển sang {maloikitu_path}: {len(invalid_codes)}")

        if len(valid_codes) == 0:
            print(f"{COLORS['RED']}[ERROR] Không còn mã hợp lệ nào trong {macoca_path} để chạy.")
            return

    except Exception as e:
        print(f"{COLORS['RED']}[ERROR] Lỗi xử lý file {macoca_path}: {e}")
        return

    auto = Auto(device)

    print(f"{COLORS['GREEN']}> Đang mở app zalo trên thiết bị...")
    pos = auto.find_image('zalo.png', threshold=0.95)
    if not pos:
        print(f"{COLORS['RED']}[ERROR] Không thấy app zalo trên màn hình thiết bị.")
        return
    auto.click(555.7, 251.1)
    print(f"{COLORS['GREEN']}> Vào app zalo thành công")

    logged_in = input(f"{COLORS['GREEN']}> Bạn đã vào zalo và setup cấu hình nhập mã sẵn chưa rồi nhấn {COLORS['YELLOW']}y {COLORS['GREEN']}để chạy nào? (y/n): ").strip().lower()
    if logged_in != 'y':
        print(f"{COLORS['RED']}[ERROR] Vui lòng setup cấu hình nhập mã sẵn khi chạy.")
        return

    print(f"{COLORS['GREEN']}> Xóa tất cả file trong thư mục trên thiết bị trước khi chạy...")
    remove_all_files_in_watchpath(device, WATCH_PATH)

    print(f"{COLORS['GREEN']}> Đang đợi ảnh mục 3 gạch xuất hiện...")
    pos_luot = wait_for_image(auto, '3gach.png', timeout=60)
    if not pos_luot:
        print(f"{COLORS['RED']}[ERROR] Không tìm thấy ảnh mục 3 gạch")
        return
    auto.click(62.6, 207.7)
    print(f"{COLORS['GREEN']}> Đã vào mục 3 gạch.")

    print(f"{COLORS['GREEN']}> Đang đợi vào trang mục nhập mã")
    pos_nhapma = wait_for_image(auto, 'nhapma.png', timeout=60)
    if not pos_nhapma:
        print(f"{COLORS['RED']}[ERROR] Không tìm thấy trang mục nhập mã")
        return
    auto.click(390.4, 779.4)
    print(f"{COLORS['GREEN']}> Đã vào mục nhập mã")

    try:
        with open(macoca_path, 'r', encoding='utf-8') as f:
            raw_lines = f.readlines()
        codes = [line.strip() for line in raw_lines if line.strip()]
        if not codes:
            print(f"{COLORS['RED']}[ERROR] File macoca.txt rỗng hoặc không có mã voucher nào")
            return
    except Exception as e:
        print(f"{COLORS['RED']}[ERROR] Lỗi đọc file macoca.txt: {e}")
        return

    total_points = 0
    code_index = 0
    error_count = 0
    ERROR_LIMIT = 5

    last_timestamp = [0]

    stop_event = threading.Event()
    watcher_thread = threading.Thread(target=watch_pull_loop, args=(stop_event, device, last_timestamp), daemon=True)
    watcher_thread.start()
    print(f"{COLORS['GREEN']}> Đã bật luồng theo dõi và kéo file captcha tự động.")

    while code_index < len(codes):
        code = codes[code_index]
        print(f"{COLORS['GREEN']}> Đang xử lý mã thứ {code_index+1}/{len(codes)}: {COLORS['CYAN']}{code}")

        pos_dienma = wait_for_image(auto, 'dienma.png', timeout=60)
        if not pos_dienma:
            print(f"{COLORS['RED']}[ERROR] Không tìm thấy chỗ nhập mã thoát chương trình.")
            break
        time.sleep(1.5)
        auto.click(*pos_dienma)
        time.sleep(0.3)
        auto.input_text_full(code)
        time.sleep(0.2)

        print(f"{COLORS['GREEN']}> Giữ click tìm chỗ tải captcha...")
        start_hold = time.time()
        captcha_found = False
        pos_dl = None
        while time.time() - start_hold < 60:
            pos_dl = auto.find_image('downloadcaptcha.png', 0.95)
            if pos_dl:
                captcha_found = True
                break
            auto.click_and_hold(683.0, 1015.1, 600)
        if not captcha_found:
            print(f"{COLORS['RED']}[ERROR] Không thấy chỗ tải captcha chuyển sang mã tiếp theo.")
            code_index += 1
            continue
        auto.click(*pos_dl)
        print(f"{COLORS['GREEN']}> Đã click tải captcha về giả lập")

        captcha_img_path = None
        wait_time = 0
        while wait_time < 30:
            local_path = os.path.join(LOCAL_SAVE_DIR, LOCAL_FILENAME)
            if os.path.exists(local_path):
                captcha_img_path = local_path
                break
            time.sleep(1)
            wait_time += 1

        if not captcha_img_path or not os.path.exists(captcha_img_path):
            print(f"{COLORS['RED']}[ERROR] Không tìm thấy file captcha mới để giải, chuyển mã tiếp theo.")
            code_index += 1
            continue

        retry_captcha_count = 0
        captcha_text = None

        while retry_captcha_count < 5:
            captcha_text = solve_captcha_with_fallback(captcha_img_path)
            if captcha_text:
                print(f"{COLORS['GREEN']}> Captcha được giải là: {COLORS['YELLOW']}{captcha_text}")
                break
            else:
                print(f"{COLORS['YELLOW']}> API không trả về kết quả hoặc lỗi, sẽ load lại captcha lần {retry_captcha_count+1}...")

                print(f"{COLORS['GREEN']}> Đang xóa tất cả file captcha trong thư mục trên thiết bị...")
                remove_all_files_in_watchpath(device, WATCH_PATH)

                pos_loadlai = wait_for_image(auto, 'loadlai.png', timeout=30)
                if not pos_loadlai:
                    print(f"{COLORS['RED']}[ERROR] Không tìm thấy ảnh load lại mã captcha.")
                    retry_captcha_count += 1
                    continue
                auto.click(*pos_loadlai)
                print(f"{COLORS['GREEN']}> Đã click load lại captcha.")

                pos_dongy = wait_for_image(auto, 'dongyloadlai.png', timeout=30)
                if not pos_dongy:
                    print(f"{COLORS['RED']}[ERROR] Không tìm thấy ảnh đồng ý load lại captcha.")
                    retry_captcha_count += 1
                    continue
                auto.click(*pos_dongy)
                print(f"{COLORS['GREEN']}> Đã xác nhận load lại captcha.")

                pos_dienma = wait_for_image(auto, 'dienma.png', timeout=30)
                if not pos_dienma:
                    print(f"{COLORS['RED']}[ERROR] Không tìm thấy chỗ nhập mã sau khi load lại captcha.")
                    retry_captcha_count += 1
                    continue
                time.sleep(2)
                auto.click(*pos_dienma)
                print(f"{COLORS['GREEN']}> Đã click vào ô nhập mã lại.")

                auto.input_text_full(code)
                time.sleep(0.5)

                print(f"{COLORS['GREEN']}> Giữ click tìm chỗ tải captcha mới...")
                start_hold = time.time()
                captcha_found = False
                pos_dl = None
                while time.time() - start_hold < 60:
                    pos_dl = auto.find_image('downloadcaptcha.png', 0.95)
                    if pos_dl:
                        captcha_found = True
                        break
                    auto.click_and_hold(683.0, 1015.1, 600)
                if not captcha_found:
                    print(f"{COLORS['RED']}[ERROR] Không thấy chỗ tải captcha mới, tiếp tục retry captcha.")
                    retry_captcha_count += 1
                    continue
                auto.click(*pos_dl)
                print(f"{COLORS['GREEN']}> Đã click tải captcha mới về giả lập")

                captcha_img_path = None
                wait_time = 0
                while wait_time < 30:
                    local_path = os.path.join(LOCAL_SAVE_DIR, LOCAL_FILENAME)
                    if os.path.exists(local_path):
                        captcha_img_path = local_path
                        break
                    time.sleep(1)
                    wait_time += 1

                if not captcha_img_path or not os.path.exists(captcha_img_path):
                    print(f"{COLORS['RED']}[ERROR] Không tìm thấy file captcha mới sau khi load lại.")
                    retry_captcha_count += 1
                    continue

                retry_captcha_count += 1

        if not captcha_text:
            print(f"{COLORS['RED']}[ERROR] Vẫn không giải được captcha sau 5 lần thử, chuyển mã tiếp theo.")
            code_index += 1
            continue

        try:
            os.remove(captcha_img_path)
        except:
            pass

        pos_nhapcapcha = wait_for_image(auto, 'nhapcapcha.png', timeout=60)
        if not pos_nhapcapcha:
            print(f"{COLORS['RED']}[ERROR] Không tìm thấy chỗ nhập captcha chuyển mã tiếp theo.")
            code_index += 1
            continue
        auto.click(*pos_nhapcapcha)
        time.sleep(0.3)
        auto.input_text_full(captcha_text)
        time.sleep(0.3)
        pos_done = wait_for_image(auto, 'done.png', timeout=60)
        if not pos_done:
            print(f"{COLORS['RED']}[ERROR] Không tìm chỗ ấn xong để chuyển mã tiếp theo.")
            code_index += 1
            continue
        auto.click(*pos_done)
        print(f"{COLORS['GREEN']}> Đã done với mã {code}.")

        # --- Phần xử lý mới bổ sung: check và click tieptucnhaptiepmamoi.png ---
        pos_tiep_tuc = wait_for_image(auto, 'tieptucnhaptiepmamoi.png', timeout=10)
        if pos_tiep_tuc:
            auto.click(444.6, 649.3)
            print(f"{COLORS['GREEN']}> Đã click vào nút tiếp tục nhập mã mới.")

        print(f"{COLORS['GREEN']}> Đang xóa tất cả file trong thư mục captcha trên thiết bị sau khi done...")
        remove_all_files_in_watchpath(device, WATCH_PATH)
        last_timestamp[0] = 0

        result = handle_done_click(auto)
        if result == 'repeat_captcha':
            print(f"{COLORS['YELLOW']}> Lặp lại bước captcha với mã hiện tại.")
            continue
        elif result == 'reload_captcha_input':
            print(f"{COLORS['YELLOW']}> Reload lại captcha input với mã hiện tại.")
            continue
        elif result == 'code_error':
            print(f"{COLORS['RED']}[ERROR] Mã bị lỗi hoặc captcha sai chuyển sang mã tiếp theo.")
            error_count += 1
            code_index += 1
            continue
        elif result == 'code_retry_same':
            print(f"{COLORS['RED']}[ERROR] Mã coca bị sai làm lại")
            continue
        elif result == 'success':
            print(f"{COLORS['GREEN']}> Chúc mừng bạn +5 điểm nhập mã thành công!")
            total_points += 5
            error_count = 0
            code_index += 1
            continue
        else:
            print(f"{COLORS['YELLOW']}> Không phát hiện cảnh báo nào, tiếp tục với mã tiếp theo")
            code_index += 1

    stop_event.set()
    print(f"{COLORS['CYAN']}> Đã chạy hết mã trong macoca.txt. Tổng điểm nhập mã là: {COLORS['YELLOW']}{total_points}")

if __name__ == "__main__":
    main()
