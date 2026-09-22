@echo off
chcp 65001 > nul
echo ========================================================
echo  다이렉트자동차보험파트너 (direct-car.co.kr)
echo  SEO & GEO 자동차보험 칼럼 자동 생성 및 배포 시작
echo ========================================================
cd /d "%~dp0\.."
call npm run post:deploy
echo.
echo 작업이 완료되었습니다. 아무 키나 누르면 창이 닫힙니다.
pause > nul
