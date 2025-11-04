// Basic client-side option simulator using bundled CSV historical data
// - plots price candlesticks and payoff simulation
// - animates historical price and shows option P/L over time

const dataPath = {
  samsung: 'data/samsung.csv',
  sk: 'data/sk.csv',
  lg: 'data/lg.csv'
};

let historical = null;
let animTimer = null;
let animIndex = 0;

// utility: parse CSV to array of objects
async function loadCSV(url){
  const res = await fetch(url);
  const txt = await res.text();
  const lines = txt.trim().split('\n');
  const headers = lines.shift().split(',');
  return lines.map(l => {
    const cols = l.split(',');
    const obj = {};
    headers.forEach((h,i)=>obj[h]=cols[i]);
    return obj;
  });
}

function toNumber(x){return x===''?null:parseFloat(x)}

// Black-Scholes in JS (standard normal CDF via erf)
function normCDF(x){
  return (1 - Math.erfc(x/Math.sqrt(2)))/2;
}

function blackScholes(S,K,T,r,sigma,type){
  if(T<=0 || sigma<=0) return Math.max(0, (type==='call'?S-K:K-S));
  const d1 = (Math.log(S/K) + (r + 0.5*sigma*sigma)*T) / (sigma*Math.sqrt(T));
  const d2 = d1 - sigma*Math.sqrt(T);
  if(type==='call') return S*normCDF(d1) - K*Math.exp(-r*T)*normCDF(d2);
  return K*Math.exp(-r*T)*normCDF(-d2) - S*normCDF(-d1);
}

function calculateVolatility(arr){
  // arr: array of close prices (numbers)
  const returns = [];
  for(let i=1;i<arr.length;i++) returns.push(Math.log(arr[i]/arr[i-1]));
  const mean = returns.reduce((a,b)=>a+b,0)/returns.length;
  const sq = returns.map(r=>(r-mean)*(r-mean));
  const varr = sq.reduce((a,b)=>a+b,0)/(returns.length-1);
  return Math.sqrt(varr)*Math.sqrt(252);
}

async function updateUI(){
  const ticker = document.getElementById('tickerSelect').value;
  const csv = dataPath[ticker];
  const rows = await loadCSV(csv);
  // parse
  const dates = rows.map(r=>r.Date);
  const close = rows.map(r=>toNumber(r.Close));
  const open = rows.map(r=>toNumber(r.Open));
  const high = rows.map(r=>toNumber(r.High));
  const low = rows.map(r=>toNumber(r.Low));

  historical = {dates,close,open,high,low,rows};

  const currentPrice = close[close.length-1];
  const strikeInput = document.getElementById('strike');
  if(!strikeInput.value) strikeInput.value = Math.round(currentPrice);
  strikeInput.min = Math.round(currentPrice*0.8);
  strikeInput.max = Math.round(currentPrice*1.2);

  drawPriceChart(historical);
}

function drawPriceChart(h){
  const trace = { x:h.dates, open:h.open, high:h.high, low:h.low, close:h.close, type:'candlestick', name:'price' };
  const layout = { title:'주가 차트', xaxis:{rangeslider:{visible:false}} };
  Plotly.newPlot('chart',[trace],layout,{responsive:true});
}

function drawSimChart(prices,payoffs,current){
  const t1 = { x:prices, y:payoffs, mode:'lines', name:'손익(원)'};
  const t2 = { x:[current,current], y:[Math.min(...payoffs),Math.max(...payoffs)], mode:'lines', name:'현재가', line:{dash:'dash',color:'red'}};
  Plotly.newPlot('simChart',[t1,t2],{title:'주가별 예상 손익', xaxis:{title:'만기 시 주가'}, yaxis:{title:'손익(원)'}},{responsive:true});
}

function calcAndShow(){
  if(!historical) return alert('데이터가 로드되지 않았습니다.');
  const current = historical.close[historical.close.length-1];
  const optionType = document.getElementById('optionType').value;
  const days = parseInt(document.getElementById('days').value,10);
  const strike = parseFloat(document.getElementById('strike').value);
  const investment = parseFloat(document.getElementById('investment').value);
  const sigma = calculateVolatility(historical.close);
  const r = 0.035;
  const T = days/365;
  const optPrice = blackScholes(current,strike,T,r,sigma,optionType);
  const contracts = optPrice>0?investment/(optPrice*100):0;

  // payoff across range
  const prices = [];
  const payoffs = [];
  const minP = current*0.5, maxP = current*1.5;
  for(let p=minP;p<=maxP;p+=(maxP-minP)/200){
    prices.push(p);
    const payoff = Math.max(0, (optionType==='call'?p-strike:strike-p))*contracts*100;
    payoffs.push(payoff - investment);
  }
  drawSimChart(prices,payoffs,current);

  // summary
  const summary = document.getElementById('summary');
  summary.innerHTML = `\
    <table class="summary-table">\
      <tr><td>현재가</td><td>${current.toLocaleString()} 원</td></tr>\
      <tr><td>행사가격</td><td>${strike.toLocaleString()} 원</td></tr>\
      <tr><td>옵션유형</td><td>${optionType}</td></tr>\
      <tr><td>만기(일)</td><td>${days}</td></tr>\
      <tr><td>옵션 가격(1주)</td><td>${optPrice.toFixed(2)} 원</td></tr>\
      <tr><td>계약 수량(근사)</td><td>${contracts.toFixed(2)} 계약</td></tr>\
      <tr><td>변동성(연)</td><td>${(sigma*100).toFixed(2)}%</td></tr>\
    </table>`;
}

function startAnimation(){
  if(!historical) return alert('데이터가 로드되지 않았습니다.');
  document.getElementById('playBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  animIndex = 0;
  animTimer = setInterval(()=>{
    if(animIndex>=historical.close.length){ stopAnimation(); return; }
    // show price up to animIndex
    const idx = animIndex;
    const slice = {
      dates: historical.dates.slice(0, idx+1),
      open: historical.open.slice(0, idx+1),
      high: historical.high.slice(0, idx+1),
      low: historical.low.slice(0, idx+1),
      close: historical.close.slice(0, idx+1)
    };
    Plotly.react('chart',[{ x:slice.dates, open:slice.open, high:slice.high, low:slice.low, close:slice.close, type:'candlestick'}],{title:'애니메이션: 주가 진행'});

    // compute option value for this price snapshot
    const currentPrice = slice.close[slice.close.length-1];
    const optionType = document.getElementById('optionType').value;
    const days = parseInt(document.getElementById('days').value,10);
    const strike = parseFloat(document.getElementById('strike').value);
    const sigma = calculateVolatility(historical.close.slice(0,idx+1));
    const r = 0.035;
    const T = days/365;
    const optPrice = blackScholes(currentPrice,strike,T,r,sigma,optionType);

    // you could show value over time in separate plot; here we update summary
    document.getElementById('summary').innerHTML = `<div>시간: ${idx+1}/${historical.close.length} — 현재가: ${currentPrice.toLocaleString()} 원 — 옵션 이론가(1주): ${optPrice.toFixed(2)} 원</div>`;

    animIndex++;
  }, 150); // 150ms per frame
}

function stopAnimation(){
  if(animTimer) clearInterval(animTimer);
  animTimer = null;
  document.getElementById('playBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
}

// bind
document.getElementById('tickerSelect').addEventListener('change', ()=>updateUI());
document.getElementById('calcBtn').addEventListener('click', ()=>calcAndShow());
document.getElementById('playBtn').addEventListener('click', ()=>startAnimation());
document.getElementById('stopBtn').addEventListener('click', ()=>stopAnimation());

// initial load
updateUI();
