# 주식 옵션 시뮬레이터

이 프로젝트는 한국 주식 시장의 옵션 거래를 시뮬레이션할 수 있는 웹 기반 도구입니다.

## 기능

- 실시간 주가 데이터 조회 (삼성전자, SK하이닉스, LG)
- 콜옵션/풋옵션 시뮬레이션
- 옵션 가격 계산 (Black-Scholes 모델 사용)
- 수익률 시각화

## 사용 방법

1. 종목 선택
2. 옵션 유형 선택 (콜/풋)
3. 계약 조건 설정
   - 만기 기간
   - 행사가격
   - 투자금액
4. 시뮬레이션 실행

## 로컬에서 실행하기

```bash
# 저장소 클론
git clone https://github.com/realbocho/stock-option-simulator.git

# 필요한 패키지 설치
pip install -r requirements.txt

# Streamlit으로 웹 앱 실행
streamlit run app.py

또는 Jupyter 노트북을 바로 확인하려면:
```bash
# Voila로 노트북 실행
voila stock_option_simulator.ipynb
```
```