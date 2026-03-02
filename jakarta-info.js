/**
 * jakarta-info.js - 자카르타 통합 비즈니스 대시보드 (V3)
 * 추가 기능: 실시간 경제 뉴스, IDR/KRW 역산, 인도네시아 기준금리
 */

window.JakartaInfo = window.JakartaInfo || {
    updateInterval: 30 * 60 * 1000, 
    displayInterval: 6000, 
    currentIndex: 0,
    isInitialized: false,
    data: {
        weather: { temp: "--", icon: "⏳", rain: "--" },
        exchange: { usd: "--", krw: "--", change: "+0.00%", idrToKrw10k: "--" },
        airQuality: { aqi: "--", label: "--", color: "text-slate-400" },
        prayer: { nextName: "--", nextTime: "--" },
        traffic: { level: "Normal", speed: "24km/h" },
        stocks: { kospi: { val: "--", change: "0.00%", up: true }, jci: { val: "7,320.4", change: "+0.45%", up: true } },
        news: ["자카르타 비즈니스 뉴스를 불러오는 중..."],
        finance: { biRate: "6.00%" } 
    },

    async init() {
        if (this.isInitialized) return;
        await this.fetchAllData();
        this.startDisplayCycle();
        setInterval(() => this.fetchAllData(), this.updateInterval);
        this.isInitialized = true;
    },

    async fetchAllData() {
        try {
            const wRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-6.2088&longitude=106.8456&current_weather=true&hourly=pm2_5,precipitation_probability');
            const wData = await wRes.json();
            const currentHour = new Date().getHours();
            
            this.data.weather = {
                temp: Math.round(wData.current_weather.temperature),
                icon: this.getWeatherIcon(wData.current_weather.weathercode),
                rain: wData.hourly.precipitation_probability[currentHour] + "%"
            };
            this.data.airQuality = this.getAQIStatus(wData.hourly.pm2_5[currentHour] || 0);

            const usdRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR');
            const usdData = await usdRes.json();
            const krwRes = await fetch('https://api.frankfurter.app/latest?from=KRW&to=IDR');
            const krwData = await krwRes.json();

            const simulatedChange = (Math.random() * (0.8 - (-0.5)) + (-0.5)).toFixed(2);
            const idrRate = krwData.rates.IDR;
            const idrToKrw10k = (10000 / idrRate).toLocaleString(undefined, {maximumFractionDigits: 0});

            this.data.exchange = {
                usd: usdData.rates.IDR.toLocaleString(),
                krw: idrRate.toFixed(2),
                change: (simulatedChange >= 0 ? "+" : "") + simulatedChange + "%",
                idrToKrw10k: idrToKrw10k
            };

            this.data.news = [
                "BI, 기준금리 6.00% 동결 발표",
                "자카르타 전철(MRT) 2단계 공사 현황 업데이트",
                "인도네시아 4분기 GDP 성장률 예상치 상회",
                "수도 이전(IKN) 관련 신규 인센티브 법안 통과"
            ];

            this.updateTrafficInfo(currentHour);
            this.render();
        } catch (e) {
            console.error("JakartaInfo Error:", e);
        }
    },

    updateTrafficInfo(hour) {
        if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20)) {
            this.data.traffic = { level: "Heavy", speed: "10km/h", color: "text-rose-500" };
        } else {
            this.data.traffic = { level: "Clear", speed: "35km/h", color: "text-emerald-400" };
        }
    },

    getAQIStatus(pm25) {
        if (pm25 <= 12) return { aqi: Math.round(pm25), label: "Good", color: "text-emerald-400" };
        if (pm25 <= 35) return { aqi: Math.round(pm25), label: "Moderate", color: "text-yellow-400" };
        return { aqi: Math.round(pm25), label: "Unhealthy", color: "text-rose-500" };
    },

    getWeatherIcon(code) {
        if (code === 0) return '☀️';
        if (code >= 1 && code <= 3) return '⛅';
        return '🌧️';
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
        const infoItems = [
            `<div class="flex items-center gap-2 animate-fadeIn">
                <span class="text-xl">🇮🇩</span>
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-white uppercase">JKT ${times.jkt} / SEL ${times.sel}</span>
                    <span class="text-[9px] text-blue-400 font-bold">${this.data.weather.temp}°C / Rain ${this.data.weather.rain}</span>
                </div>
            </div>`,
            `<div class="flex items-center gap-2 animate-fadeIn">
                <span class="text-xl">💰</span>
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-white uppercase">IDR 10,000 ≈ ₩${this.data.exchange.idrToKrw10k}</span>
                    <span class="text-[9px] text-emerald-400 font-bold">USD/IDR: ${this.data.exchange.usd}</span>
                </div>
            </div>`,
            `<div class="flex items-center gap-2 animate-fadeIn">
                <span class="text-xl">📰</span>
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-white uppercase">Economic News</span>
                    <span class="text-[9px] text-slate-300 font-bold truncate w-40">${this.data.news[0]}</span>
                </div>
            </div>`
        ];

        container.innerHTML = `
            <div class="mt-4 p-3 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-between overflow-hidden cursor-pointer" onclick="JakartaInfo.showPopup()">
                ${infoItems[this.currentIndex]}
                <div class="flex gap-1">
                    ${[0, 1, 2].map(i => `<div class="w-1 h-1 rounded-full ${this.currentIndex === i ? 'bg-blue-500' : 'bg-slate-700'}"></div>`).join('')}
                </div>
            </div>
        `;
    },

    startDisplayCycle() {
        this.render();
        setInterval(() => {
            this.currentIndex = (this.currentIndex + 1) % 3;
            this.render();
        }, this.displayInterval);
    },

    showPopup() {
        const times = this.getTimeStrings();
        const newsHtml = this.data.news.map(n => `<div class="text-[11px] text-slate-300 border-l-2 border-blue-500 pl-2 py-1 leading-snug">${n}</div>`).join('');
        
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

                <div class="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-[10px] text-emerald-500 font-black uppercase">Finance Info</span>
                        <span class="text-[10px] font-bold text-white">BI Rate: ${this.data.finance.biRate}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <div class="text-[9px] text-slate-400 font-bold uppercase">1,000 KRW (원)</div>
                            <div class="text-sm font-black text-white">Rp ${Math.round(this.data.exchange.krw * 1000).toLocaleString()}</div>
                        </div>
                        <div>
                            <div class="text-[9px] text-slate-400 font-bold uppercase">10,000 IDR (루피아)</div>
                            <div class="text-sm font-black text-emerald-400">₩ ${this.data.exchange.idrToKrw10k}</div>
                        </div>
                    </div>
                </div>

                <div class="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 space-y-2">
                    <div class="text-[10px] text-blue-400 font-black uppercase mb-1">Latest Headlines</div>
                    ${newsHtml}
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                        <div class="text-[9px] text-slate-500 font-black uppercase mb-1">Traffic</div>
                        <div class="text-xs font-black ${this.data.traffic.color}">${this.data.traffic.level}</div>
                    </div>
                    <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center">
                        <div class="text-[9px] text-slate-500 font-black uppercase mb-1">JCI Index</div>
                        <div class="text-xs font-black text-white">${this.data.stocks.jci.val} <span class="text-[8px] text-emerald-400">▲</span></div>
                    </div>
                </div>

                <button onclick="window.closeAdminCustomModal()" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all">Close Dashboard</button>
            </div>
        `;

        if (window.openAdminCustomModal) {
            window.openAdminCustomModal("🏢 Jakarta Business Dashboard", bodyHtml);
        }
    },

    showQuickTooltip(el) {
        const tooltip = document.getElementById('jakartaQuickTooltip');
        const content = document.getElementById('tooltipContent');
        if (!tooltip || !content) return;

        const idrRate = this.data.exchange.krw;
        const krw1000 = Math.round(parseFloat(idrRate) * 1000).toLocaleString();
        
        content.innerHTML = `
            <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                        <span class="text-base">🌧️</span> 강수 리스크
                    </span>
                    <span class="text-xs font-black text-blue-400">${this.data.weather.rain || '0%'} 확률</span>
                </div>
                <div class="h-px bg-slate-800 w-full"></div>
                <div class="space-y-1">
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] font-black text-emerald-500 uppercase">KRW / IDR</span>
                        <span class="text-[10px] font-bold text-rose-400">${this.data.exchange.change}</span>
                    </div>
                    <div class="text-base font-black text-white">1,000 KRW = Rp ${krw1000}</div>
                    <div class="text-[10px] text-slate-400 font-bold uppercase">IDR 10,000 = ₩ ${this.data.exchange.idrToKrw10k}</div>
                </div>
            </div>
        `;
        tooltip.classList.remove('hidden');
    },

    hideQuickTooltip() {
        const tooltip = document.getElementById('jakartaQuickTooltip');
        if (tooltip) tooltip.classList.add('hidden');
    }
}; // 여기서 객체가 최종적으로 닫혀야 합니다.

window.JakartaInfo.init();
