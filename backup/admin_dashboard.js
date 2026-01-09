/**
 * 공통 유틸리티: 자카르타 시간
 */
function getJakartaDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const jakartaOffset = 7 * 60 * 60000;
    return new Date(utc + jakartaOffset);
}

/**
 * 메인 로드 함수
 */
window.loadDashboardData = function () {
    const user = sessionStorage.getItem('loggedInUser');
    if (!user) return;

    const db = firebase.database();
    const todayStr = getJakartaDate().toISOString().split('T')[0];

    /* ================= Attendance ================= */
    const initAttendance = () => {
        const container = document.getElementById('calendar_main_area');
        if (!container) return;

        let viewDate = getJakartaDate();

        container.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <div id="main_month_display" class="text-sm font-bold text-white italic"></div>
                <div class="flex bg-slate-800 rounded-lg p-1 scale-75">
                    <button id="main_prev" class="px-2 py-1 text-slate-400 text-[10px] font-black">PREV</button>
                    <button id="main_today" class="px-2 py-1 text-blue-400 text-[10px] font-black mx-1">TODAY</button>
                    <button id="main_next" class="px-2 py-1 text-slate-400 text-[10px] font-black">NEXT</button>
                </div>
            </div>
            <table class="calendar-table w-full text-[10px]">
                <thead>
                    <tr class="text-slate-500">
                        <th>SUN</th><th>MON</th><th>TUE</th><th>WED</th>
                        <th>THU</th><th>FRI</th><th>SAT</th>
                    </tr>
                </thead>
                <tbody id="main_calendar_body"></tbody>
            </table>`;

        const render = () => {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const lastDate = new Date(year, month + 1, 0).getDate();

            document.getElementById('main_month_display').innerText =
                viewDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

            db.ref('attendance').off();
            db.ref('attendance').on('value', snap => {
                const data = snap.val() || {};
                const tbody = document.getElementById('main_calendar_body');
                tbody.innerHTML = '';

                let d = 1;
                for (let i = 0; i < 6; i++) {
                    const row = document.createElement('tr');
                    for (let j = 0; j < 7; j++) {
                        const cell = document.createElement('td');
                        if ((i === 0 && j < firstDay) || d > lastDate) {
                            row.appendChild(cell);
                        } else {
                            const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            const rec = data[dStr]?.[user];

                            let html = `<div class="opacity-50 mb-1">${d}</div>`;
                            if (rec) {
                                if (typeof rec === 'string') {
                                    html += `<span>${rec}</span>`;
                                } else {
                                    html += `☀️ ${rec.attend || ''}<br>🌙 ${rec.leave || ''}`;
                                }
                            }
                            cell.innerHTML = html;
                            row.appendChild(cell);
                            d++;
                        }
                    }
                    tbody.appendChild(row);
                    if (d > lastDate) break;
                }
            });
        };

        document.getElementById('main_prev').onclick = () => { viewDate.setMonth(viewDate.getMonth() - 1); render(); };
        document.getElementById('main_next').onclick = () => { viewDate.setMonth(viewDate.getMonth() + 1); render(); };
        document.getElementById('main_today').onclick = () => { viewDate = getJakartaDate(); render(); };

        render();
    };

    /* ================= Work ================= */
    const initWork = () => {
        const container = document.getElementById('calendar_work_area');
        if (!container) return;

        let viewDate = getJakartaDate();
        container.innerHTML = `
            <div id="work_month_display" class="mb-2 font-bold"></div>
            <table class="mini-cal w-full text-[10px]">
                <tbody id="work_calendar_body"></tbody>
            </table>`;

        const render = () => {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            document.getElementById('work_month_display').innerText =
                viewDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
        };
        render();
    };

    /* ================= Schedule ================= */
    const initSchedule = () => {
        const container = document.getElementById('calendar_event_area');
        if (!container) return;

        container.innerHTML = `
            <div id="event_month_display" class="font-bold mb-2"></div>
            <table class="schedule-cal w-full">
                <tbody id="event_calendar_body"></tbody>
            </table>`;
    };

    initAttendance();
    initWork();
    initSchedule();
};

/* 자동 실행 */
setTimeout(() => {
    if (document.getElementById('calendar_main_area')) {
        window.loadDashboardData();
    }
}, 0);
