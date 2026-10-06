"""
다이렉트자동차보험파트너(direct-car.co.kr) - 호스팅어(Hostinger) SFTP 자동 배포 스크립트
호스팅어 보안 SFTP 포트(65002)를 활용하여 정적 칼럼 및 사이트맵을 빠르고 안전하게 동기화합니다.
CDN/프록시 우회 및 다중 호스트 자동 장애복구(Failover), 타임아웃 방지 메커니즘 탑재.
"""

import os
import sys
import posixpath
import socket
import time

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
ENV_PATH = os.path.join(ROOT_DIR, '.env')

# 기본 호스팅어 원격 IP 및 도메인
HOSTINGER_DIRECT_IP = '145.79.25.99'
HOSTINGER_FTP_HOST = 'ftp.direct-car.co.kr'
KNOWN_CDN_IPS = {'147.93.77.230', '213.210.57.214'}

def load_env(path):
    env = {}
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip().strip("'\"")
    return env

config = load_env(ENV_PATH)

def clean_host(host_str):
    if not host_str:
        return ""
    h = host_str.strip()
    for prefix in ('https://', 'http://'):
        if h.startswith(prefix):
            h = h[len(prefix):]
    if ':' in h:
        h = h.split(':', 1)[0]
    return h.rstrip('/')

RAW_SERVER = config.get('FTP_SERVER') or os.environ.get('FTP_SERVER') or HOSTINGER_DIRECT_IP
SERVER = clean_host(RAW_SERVER)
USERNAME = config.get('FTP_USERNAME') or os.environ.get('FTP_USERNAME') or 'u687833262'
PASSWORD = config.get('FTP_PASSWORD') or os.environ.get('FTP_PASSWORD')
PORT = int(config.get('FTP_PORT') or os.environ.get('FTP_PORT') or 65002)
REMOTE_DIR = config.get('FTP_REMOTE_DIR') or os.environ.get('FTP_REMOTE_DIR') or 'domains/direct-car.co.kr/public_html'

def check_credentials():
    if not USERNAME or not PASSWORD:
        print("❌ 서버 접속 계정 또는 비밀번호가 설정되지 않았습니다. .env 또는 GitHub Secrets를 확인해주세요.")
        return False
    return True

created_dirs = set()

def ensure_remote_dir_sftp(sftp, remote_dir):
    """원격 SFTP 디렉토리가 없으면 계층별로 순차 생성 (캐싱 적용)"""
    if remote_dir in created_dirs:
        return
    parts = remote_dir.strip('/').split('/')
    current = "/" if remote_dir.startswith('/') else ""
    for part in parts:
        current = posixpath.join(current, part)
        if current in created_dirs:
            continue
        try:
            sftp.stat(current)
        except IOError:
            try:
                sftp.mkdir(current)
            except Exception:
                pass
        created_dirs.add(current)

def upload_file_sftp(sftp, local_file_path, remote_file_path):
    remote_dir = posixpath.dirname(remote_file_path)
    if remote_dir:
        ensure_remote_dir_sftp(sftp, remote_dir)
    sftp.put(local_file_path, remote_file_path)
    rel = os.path.relpath(local_file_path, ROOT_DIR).replace('\\', '/')
    print(f"  ⬆️ 업로드 성공: {rel}")

def upload_directory_sftp(sftp, local_dir, base_remote_dir):
    for root, dirs, files in os.walk(local_dir):
        rel_path = os.path.relpath(root, ROOT_DIR).replace('\\', '/')
        remote_target_dir = posixpath.join(base_remote_dir, rel_path)
        ensure_remote_dir_sftp(sftp, remote_target_dir)

        for file in files:
            local_path = os.path.join(root, file)
            remote_path = posixpath.join(remote_target_dir, file)
            upload_file_sftp(sftp, local_path, remote_path)

def build_candidate_hosts(primary_host):
    """CDN 프록시 감지 및 연결 가능한 호스트 목록 구성"""
    candidates = []

    # 1. 원본 호스트 분석
    if primary_host:
        resolved_ip = None
        try:
            resolved_ip = socket.gethostbyname(primary_host)
        except Exception:
            pass

        is_cdn = False
        if primary_host.lower() == 'direct-car.co.kr':
            is_cdn = True
        elif resolved_ip and resolved_ip in KNOWN_CDN_IPS:
            is_cdn = True

        if is_cdn:
            print(f"⚠️ 안내: '{primary_host}'(IP: {resolved_ip})는 Hostinger CDN 프록시로 SFTP 포트({PORT})가 차단됩니다.")
            print(f"🔄 실제 서버 IP({HOSTINGER_DIRECT_IP}) 및 우회 호스트({HOSTINGER_FTP_HOST})로 자동 연결을 진행합니다.")
        else:
            candidates.append((primary_host, resolved_ip))

    # 2. 우선순위 대체 호스트 추가
    for h in [HOSTINGER_DIRECT_IP, HOSTINGER_FTP_HOST]:
        if not any(c[0] == h for c in candidates):
            try:
                ip = socket.gethostbyname(h)
            except Exception:
                ip = None
            candidates.append((h, ip))

    return candidates

def connect_with_failover(paramiko_module, candidates, port, username, password):
    """여러 호스트 후보군에 대해 재시도 및 페일오버를 수행하며 SFTP 연결"""
    last_error = None

    for host, ip in candidates:
        ip_display = f" (IP: {ip})" if ip else ""
        print(f"🌐 호스팅어 서버 접속 시도: {host}{ip_display}:{port} (계정: {username})")

        for attempt in range(1, 3):
            client = paramiko_module.SSHClient()
            client.set_missing_host_key_policy(paramiko_module.AutoAddPolicy())
            try:
                client.connect(
                    host,
                    port=port,
                    username=username,
                    password=password,
                    timeout=30,
                    banner_timeout=30,
                    auth_timeout=30
                )
                print(f"✅ SFTP 인증 성공! (접속 대상: {host})")
                sftp = client.open_sftp()
                return client, sftp
            except Exception as e:
                last_error = e
                print(f"  ⚠️ {host} 연결 시도 {attempt}/2 실패: {e}")
                try:
                    client.close()
                except Exception:
                    pass
                time.sleep(2)

    raise last_error

def main():
    print("🚀 === direct-car.co.kr 호스팅어(Hostinger) SFTP 자동 배포 시작 ===")
    if not check_credentials():
        sys.exit(1)

    try:
        import paramiko
    except ImportError:
        print("❌ paramiko 모듈이 필요합니다. (pip install paramiko)")
        sys.exit(1)

    try:
        candidates = build_candidate_hosts(SERVER)
        client, sftp = connect_with_failover(paramiko, candidates, PORT, USERNAME, PASSWORD)

        home_dir = sftp.normalize('.')
        
        if REMOTE_DIR.startswith('/'):
            target_base = REMOTE_DIR
        else:
            target_base = posixpath.join(home_dir, REMOTE_DIR)

        print(f"📂 원격 작업 디렉토리: {target_base}")
        ensure_remote_dir_sftp(sftp, target_base)

        # 1. 단일 핵심 파일 업로드 (sitemap, robots, index, guide, accident, faq, favicon)
        key_files = ['sitemap.xml', 'robots.txt', 'index.html', 'guide.html', 'accident.html', 'faq.html', 'favicon.svg']
        for kf in key_files:
            local_path = os.path.join(ROOT_DIR, kf)
            if os.path.exists(local_path):
                remote_path = posixpath.join(target_base, kf)
                upload_file_sftp(sftp, local_path, remote_path)

        # 2. 공통 에셋 폴더 업로드 (assets)
        for asset_folder in ['assets']:
            asset_dir = os.path.join(ROOT_DIR, asset_folder)
            if os.path.exists(asset_dir):
                upload_directory_sftp(sftp, asset_dir, target_base)

        # 3. data/ 폴더 업로드
        data_dir = os.path.join(ROOT_DIR, 'data')
        if os.path.exists(data_dir):
            upload_directory_sftp(sftp, data_dir, target_base)

        # 4. posts/ 폴더 업로드 (전체 칼럼 및 스타일, 스크립트)
        posts_dir = os.path.join(ROOT_DIR, 'posts')
        if os.path.exists(posts_dir):
            upload_directory_sftp(sftp, posts_dir, target_base)

        sftp.close()
        client.close()

        print("\n🎉 축하합니다! 호스팅어 서버로 모든 최신 칼럼과 사이트맵 배포가 완료되었습니다!")
        print("👉 라이브 확인 주소:")
        print("   - 메인 사이트: https://direct-car.co.kr/")
        print("   - 칼럼 정보마당: https://direct-car.co.kr/posts/")
        print("   - 사이트맵: https://direct-car.co.kr/sitemap.xml")
        print("   - 로봇 수집파일: https://direct-car.co.kr/robots.txt")

    except Exception as e:
        print(f"❌ SFTP 배포 중 최종 오류 발생: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
