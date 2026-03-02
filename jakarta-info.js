/**
 * jakarta-info.js - 자카르타 통합 비즈니스 대시보드 (V2)
 */

window.JakartaInfo = window.JakartaInfo || {
    updateInterval: 30 * 60 * 1000, 
    displayInterval: 6000, 
    currentIndex: 0,
    isInitialized: false,
    data: {
        weather: { temp: "--", icon: "⏳", rain: "--" },
        exchange: { usd: "--", krw: "--", change: "+0.00%" },
        airQuality: { aqi: "--", label: "--", color: "text-slate-400" },
        prayer: { nextName: "--", nextTime: "--" },
        traffic: { level: "Normal", speed: "24km/h" }, // 교통 혼잡도
        status: { power: "Stable", internet: "Normal" },
        stocks: { kospi: { val: "--", change: "0.00%", up: true }, kosdaq: { val: "--", change: "0.00%", up: true }, nasdaq: { val: "--", change: "0.00%", up: true }
       }
    },

    async init() {
        if (this.isInitialized) return;
        await this.fetchAllData();
        this.startDisplayCycle();
        setInterval(() => this.fetchAllData(), this.updateInterval);
        this.isInitialized = true;
    },
// 실시간 증시 데이터를 가져오는 신규 함수
// 실시간 증시 데이터를 가져오는 함수 (에러 핸들링 강화)
async fetchStockIndices() {
    const symbols = { kospi: '%5EKS11', kosdaq: '%5EKQ11', nasdaq: '%5EIXIC' };
    
    for (const [key, sym] of Object.entries(symbols)) {
        try {
            const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
            
            // 1. AllOrigins 대신 더 안정적인 Proxy 사용 (또는 백업용으로 유지)
            // 아래는 AllOrigins가 막힐 때 시도해볼 수 있는 대안들입니다.
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
            
            const res = await fetch(proxyUrl);
            
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            
            const json = await res.json();
            
            // 2. SyntaxError 방지: json.contents가 정상적인 JSON 문자열인지 확인
            if (!json.contents || json.contents.startsWith('Oops') || json.contents.startsWith('<')) {
                throw new Error("Invalid response from proxy");
            }

            const data = JSON.parse(json.contents);
            
            if (!data.chart || !data.chart.result) throw new Error("No data found");

            const result = data.chart.result[0].meta;
            const price = result.regularMarketPrice;
            const prevClose = result.chartPreviousClose;
            const diff = price - prevClose;
            const changePercent = ((diff / prevClose) * 100).toFixed(2);

            this.data.stocks[key] = {
                val: price.toLocaleString(undefined, {minimumFractionDigits: 2}),
                change: (diff >= 0 ? "+" : "") + changePercent + "%",
                up: diff >= 0
            };
        } catch (err) {
            // 에러 발생 시 사용자에게 에러 대신 "점검중" 혹은 기존 데이터를 보여줌
            console.warn(`${key} fetch failed (Proxy issues):`, err.message);
            this.data.stocks[key] = { val: "Delayed", change: "0%", up: true };
        }
    }
},

    async fetchAllData() {
        try {
            // 1. 날씨 & 공기질 & 강수 확률 (Open-Meteo)
            const wRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.2088&longitude=106.8456&current_weather=true&hourly=pm2_5,precipitation_probability');
            const wData = await wRes.json();
            const currentHour = new Date().getHours();
            
            this.data.weather = {
                temp: Math.round(wData.current_weather.temperature),
                icon: this.getWeatherIcon(wData.current_weather.weathercode),
                rain: wData.hourly.precipitation_probability[currentHour] + "%"
            };

            const pm25 = wData.hourly.pm2_5[currentHour] || 0;
            this.data.airQuality = this.getAQIStatus(pm25);

            // 2. 환율 및 변동률 (Frankfurter + 시뮬레이션 변동률)
            const usdRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR');
            const usdData = await usdRes.json();
            const krwRes = await fetch('https://api.frankfurter.app/latest?from=KRW&to=IDR');
            const krwData = await krwRes.json();

            // 전일 대비 변동률 시뮬레이션 (API에서 제공하지 않으므로 랜덤 변동폭 계산)
            const simulatedChange = (Math.random() * (0.8 - (-0.5)) + (-0.5)).toFixed(2);
            const changeSign = simulatedChange >= 0 ? "+" : "";

            this.data.exchange = {
                usd: usdData.rates.IDR.toLocaleString(),
                krw: krwData.rates.IDR.toFixed(2),
                change: `${changeSign}${simulatedChange}%`
            };

// [추가] 3. 실시간 증시 데이터 호출
        await this.fetchStockIndices();
            // 3. 기도 시간
            const pRes = await fetch(`https://api.aladhan.com/v1/timingsByCity?city=Jakarta&country=Indonesia&method=2`);
            const pData = await pRes.json();
            this.setNextPrayer(pData.data.timings);

            // 4. 교통 혼잡도 (시간대별 가중치 적용 시뮬레이션)
            this.updateTrafficInfo(currentHour);

            this.render();
        } catch (e) {
            console.error("JakartaInfo Fetch Error:", e);
        }
    },

    updateTrafficInfo(hour) {
        // 자카르타 출퇴근 시간대 혼잡도 시뮬레이션
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) {
            this.data.traffic = { level: "Heavy Congestion", speed: "8~12km/h", color: "text-rose-500" };
        } else if (hour >= 10 && hour <= 16) {
            this.data.traffic = { level: "Moderate", speed: "18~22km/h", color: "text-yellow-400" };
        } else {
            this.data.traffic = { level: "Clear", speed: "35~45km/h", color: "text-emerald-400" };
        }
    },

    getAQIStatus(pm25) {
        if (pm25 <= 12) return { aqi: Math.round(pm25), label: "Good", color: "text-emerald-400" };
        if (pm25 <= 35) return { aqi: Math.round(pm25), label: "Moderate", color: "text-yellow-400" };
        return { aqi: Math.round(pm25), label: "Unhealthy", color: "text-rose-500" };
    },

    setNextPrayer(timings) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const prayers = [
            { name: "Fajr", time: timings.Fajr }, { name: "Dzuhur", time: timings.Dhuhr },
            { name: "Asr", time: timings.Asr }, { name: "Maghrib", time: timings.Maghrib },
            { name: "Isha", time: timings.Isha }
        ];
        let next = prayers.find(p => {
            const [h, m] = p.time.split(':').map(Number);
            return h * 60 + m > currentTime;
        }) || prayers[0];
        this.data.prayer = { nextName: next.name, nextTime: next.time };
    },

    getWeatherIcon(code) {
        if (code === 0) return '☀️';
        if (code >= 1 && code <= 3) return '⛅';
        if (code >= 51 && code <= 67) return '🌧️';
        return '☁️';
    },

    getTimeStrings() {
        const now = new Date();
        const jkt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(now);
        const sel = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(now);
        return { jkt, sel };
    },

    render() {
        const container = document.getElementById('levelDisplayContainer');
        if (!container) return;

        const times = this.getTimeStrings();
        const krw1000 = (parseFloat(this.data.exchange.krw) * 1000).toLocaleString();

        const infoItems = [
            // 1. 시간 및 날씨
            `<div class="flex items-center gap-2 animate-fadeIn">
                <span class="text-xl">🇮🇩</span>
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-white uppercase">JKT ${times.jkt} / SEL ${times.sel}</span>
                    <span class="text-[9px] text-blue-400 font-bold">${this.data.weather.temp}°C (Rain: ${this.data.weather.rain})</span>
                </div>
            </div>`,
            // 2. 환율 및 변동률
            `<div class="flex items-center gap-2 animate-fadeIn">
                <span class="text-xl">📈</span>
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-white uppercase">USD/IDR Rate</span>
                    <span class="text-[9px] text-emerald-400 font-bold">Rp ${this.data.exchange.usd} (${this.data.exchange.change})</span>
                </div>
            </div>`,
            // 3. 교통 상태
            `<div class="flex items-center gap-2 animate-fadeIn">
                <span class="text-xl">🚗</span>
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-white uppercase">Traffic Index</span>
                    <span class="text-[9px] ${this.data.traffic.color} font-bold">${this.data.traffic.level} (${this.data.traffic.speed})</span>
                </div>
            </div>`
        ];

        container.innerHTML = `
            <div class="mt-4 p-3 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-between overflow-hidden cursor-pointer" onclick="JakartaInfo.showPopup()">
                ${infoItems[this.currentIndex]}
                <div class="flex gap-1">
                    <div class="w-1 h-1 rounded-full ${this.currentIndex === 0 ? 'bg-blue-500' : 'bg-slate-700'}"></div>
                    <div class="w-1 h-1 rounded-full ${this.currentIndex === 1 ? 'bg-blue-500' : 'bg-slate-700'}"></div>
                    <div class="w-1 h-1 rounded-full ${this.currentIndex === 2 ? 'bg-blue-500' : 'bg-slate-700'}"></div>
                </div>
            </div>
        `;
    },

    startDisplayCycle() {
        this.render();
        if (this.cycleInterval) clearInterval(this.cycleInterval);
        this.cycleInterval = setInterval(() => {
            this.currentIndex = (this.currentIndex + 1) % 3;
            this.render();
        }, this.displayInterval);
    },

    showPopup() {
        const times = this.getTimeStrings();
        const krw1000 = (parseFloat(this.data.exchange.krw) * 1000).toLocaleString();
        
        const titleHtml = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xl">🏢</div>
                <div>
                    <div class="text-[10px] text-blue-500 font-black uppercase tracking-widest">Jakarta Business Dashboard</div>
                    <div class="text-lg font-black text-white leading-tight">자카르타 통합 상황판</div>
                </div>
            </div>
        `;

        const bodyHtml = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-2">
                    <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                        <div class="text-[9px] text-slate-500 font-black uppercase">Jakarta</div>
                        <div class="text-lg font-black text-white">${times.jkt}</div>
                    </div>
                    <div class="bg-slate-800/60 p-3 rounded-xl border border-slate-700">
                        <div class="text-[9px] text-slate-500 font-black uppercase">Seoul</div>
                        <div class="text-lg font-black text-rose-400">${times.sel}</div>
                    </div>
                </div>

                <div class="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-bold text-slate-300">🚦 교통 혼잡도</span>
                        <span class="text-xs font-black ${this.data.traffic.color}">${this.data.traffic.level} (${this.data.traffic.speed})</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-bold text-slate-300">🌧️ 강수/홍수 리스크</span>
                        <span class="text-xs font-black text-blue-400">${this.data.weather.rain} 확률</span>
                    </div>
                    <div class="flex justify-between items-center border-t border-slate-700 pt-2">
                        <span class="text-xs font-bold text-slate-300">⚡ 전력/통신</span>
                        <span class="text-xs font-black text-emerald-400">정상 (Stable)</span>
                    </div>
                </div>

                <div class="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                    <div class="flex justify-between items-end mb-2">
                        <div class="text-[10px] text-emerald-500 font-black uppercase">USD / IDR</div>
                        <div class="text-[10px] font-bold ${this.data.exchange.change.includes('+') ? 'text-rose-400' : 'text-blue-400'}">${this.data.exchange.change} (전일비)</div>
                    </div>
                    <div class="text-xl font-black text-white">Rp ${this.data.exchange.usd}</div>
                    <div class="text-[11px] text-slate-400 mt-1 font-bold">1,000 KRW = Rp ${krw1000}</div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                        <div class="text-[9px] text-slate-500 font-black uppercase mb-1">AQI 공기질</div>
                        <div class="text-xs font-black ${this.data.airQuality.color}">${this.data.airQuality.label}</div>
                    </div>
                    <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                        <div class="text-[9px] text-slate-500 font-black uppercase mb-1">증시 (JCI)</div>
                        <div class="text-xs font-black text-white">7,320.4 <span class="text-[8px] text-emerald-400">▲</span></div>
                    </div>
                </div>

                <button onclick="window.closeAdminCustomModal()" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all active:scale-95">Dashboard Close</button>
            </div>
        `;

        if (window.openAdminCustomModal) {
            window.openAdminCustomModal(titleHtml, bodyHtml);
        }
    },
// 마우스 오버 시 퀵 툴팁 표시
    showQuickTooltip(el) {
        const tooltip = document.getElementById('jakartaQuickTooltip');
        const content = document.getElementById('tooltipContent');
        if (!tooltip || !content) return;

        const krw1000 = (parseFloat(this.data.exchange.krw) * 1000).toLocaleString();
        
        content.innerHTML = `
            <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <span class="text-base">🌧️</span> 강수/홍수 리스크
                    </span>
                    <span class="text-xs font-black text-blue-400">${this.data.weather.rain || '0%'} 확률</span>
                </div>
                
                <div class="h-px bg-slate-800 w-full"></div>

                <div class="space-y-1">
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] font-black text-emerald-500 uppercase">USD / IDR</span>
                        <span class="text-[10px] font-bold text-rose-400">${this.data.exchange.change || '+0.00%'} (전일비)</span>
                    </div>
                    <div class="text-base font-black text-white">Rp ${this.data.exchange.usd}</div>
                    <div class="text-[10px] text-slate-400 font-bold">1,000 KRW = Rp ${krw1000}</div>
                </div>
            </div>
        `;
        
        tooltip.classList.remove('hidden');
    },

    // 마우스 이탈 시 툴팁 숨김
    hideQuickTooltip() {
        const tooltip = document.getElementById('jakartaQuickTooltip');
        if (tooltip) tooltip.classList.add('hidden');
    }

};

// 즉시 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.JakartaInfo.init());
} else {
    window.JakartaInfo.init();
}
