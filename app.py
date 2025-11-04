import streamlit as st
import yfinance as yf
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from scipy.stats import norm
from datetime import datetime, timedelta

st.set_page_config(page_title="주식 옵션 시뮬레이터", layout="wide")

st.title("📈 주식 옵션 시뮬레이터 (삼성전자 / SK하이닉스 / LG)")

SYMBOLS = {
    '삼성전자': '005930.KS',
    'SK하이닉스': '000660.KS',
    'LG': '003550.KS'
}

@st.cache_data
def load_data(symbol, period_days=365):
    end = datetime.now()
    start = end - timedelta(days=period_days)
    return yf.download(symbol, start=start, end=end)

def calculate_volatility(df):
    returns = np.log(df['Close'] / df['Close'].shift(1)).dropna()
    return returns.std() * np.sqrt(252)

def black_scholes(S, K, T, r, sigma, option_type='call'):
    if T <= 0 or sigma <= 0:
        return max(0.0, (S - K) if option_type=='call' else (K - S))
    d1 = (np.log(S/K) + (r + 0.5 * sigma**2)*T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    if option_type == 'call':
        return S * norm.cdf(d1) - K * np.exp(-r*T) * norm.cdf(d2)
    else:
        return K * np.exp(-r*T) * norm.cdf(-d2) - S * norm.cdf(-d1)

with st.sidebar:
    stock_name = st.selectbox('종목 선택', list(SYMBOLS.keys()))
    option_type = st.radio('옵션 유형', ('콜 (오를 것)', '풋 (내릴 것)'))
    days = st.slider('만기까지 남은 기간 (일)', 1, 180, 30)
    investment = st.number_input('투자금액 (원)', min_value=1000, value=1000000, step=1000)

symbol = SYMBOLS[stock_name]

df = load_data(symbol)
if df is None or df.empty:
    st.error('데이터를 불러올 수 없습니다. 인터넷 연결을 확인하거나 나중에 다시 시도하세요.')
    st.stop()

current_price = df['Close'].iloc[-1]
min_strike = float(current_price * 0.8)
max_strike = float(current_price * 1.2)
strike = st.sidebar.slider('행사가격 (원)', int(min_strike), int(max_strike), int(current_price), step=max(1, int((max_strike-min_strike)//100)))

st.subheader(f"{stock_name} 현재가: {current_price:,.0f} 원")

# 차트
fig = go.Figure()
fig.add_trace(go.Candlestick(x=df.index, open=df['Open'], high=df['High'], low=df['Low'], close=df['Close'], name='주가'))
fig.update_layout(height=500, margin=dict(l=20, r=20, t=30, b=20))
st.plotly_chart(fig, use_container_width=True)

# 옵션 가격 계산
r = 0.035
sigma = calculate_volatility(df)
T = days / 365.0
opt_type_short = 'call' if option_type.startswith('콜') or option_type.startswith('콜') or '콜' in option_type else 'put'
option_price = black_scholes(current_price, strike, T, r, sigma, option_type=opt_type_short)

if option_price <= 0:
    st.warning('계산된 옵션 가격이 0이거나 음수입니다. 파라미터를 확인하세요.')

contracts = 0
if option_price > 0:
    contracts = investment / (option_price * 100)

col1, col2 = st.columns([2,1])
with col2:
    st.metric('옵션 가격(이론값, 1주 기준)', f"{option_price:,.2f} 원")
    st.metric('예상 계약 수(근사)', f"{contracts:.2f} 계약 (1계약=100주)")
    st.metric('변동성(연율)', f"{sigma:.2%}")

# 수익 시뮬레이션
prices = np.linspace(current_price*0.5, current_price*1.5, 200)
payoffs = []
for p in prices:
    if opt_type_short == 'call':
        payoff = max(0, p - strike) * contracts * 100
    else:
        payoff = max(0, strike - p) * contracts * 100
    payoffs.append(payoff - investment)

sim_fig = go.Figure()
sim_fig.add_trace(go.Scatter(x=prices, y=payoffs, name='예상 손익(원)'))
sim_fig.add_trace(go.Scatter(x=[current_price, current_price], y=[min(payoffs), max(payoffs)], mode='lines', name='현재가', line=dict(dash='dash', color='red')))
sim_fig.update_layout(title='주가별 예상 손익', xaxis_title='만기 시 주가', yaxis_title='손익 (원)', height=450)
st.plotly_chart(sim_fig, use_container_width=True)

# 요약 테이블
summary = pd.DataFrame({
    '항목': ['종목','옵션 유형','현재가','행사가격','만기(일)','옵션 가격(1주)','투자금액(원)'],
    '값': [stock_name, option_type, f"{current_price:,.0f} 원", f"{strike:,.0f} 원", f"{days} 일", f"{option_price:,.2f} 원", f"{investment:,.0f} 원"]
})

st.table(summary)

st.markdown('---')
st.write('참고: 이 계산은 교육용 시뮬레이션입니다. 거래 수수료, 슬리피지, 마진 요구사항 등은 반영되어 있지 않습니다.')
