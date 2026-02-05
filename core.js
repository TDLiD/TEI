// core.js - 공통 핵심 로직
export const Core = {
    // 1. 날짜 포맷팅 (YYYY-MM-DD)
    formatDate: (date) => {
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-');
    },

    // 2. 해당 월의 달력 데이터 생성 (시작 요일, 마지막 날짜 등)
    getCalendarGrid: (year, month) => {
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const prevLastDate = new Date(year, month, 0).getDate();
        return { firstDay, lastDate, prevLastDate };
    },

    // 3. 사용자 권한 확인 및 리다이렉트
    checkAuth: (auth, callback) => {
        auth.onAuthStateChanged((user) => {
            if (!user) {
                location.replace("index.html");
            } else if (callback) {
                callback(user);
            }
        });
    },

    // 4. 공통 텍스트 처리 (이벤트 span 계산 등)
    getEventSpan: (startDate, endDate, weekEndStr) => {
        const sDate = new Date(startDate.split('T')[0]);
        const eDate = new Date(endDate.split('T')[0]);
        const wEnd = new Date(weekEndStr);
        const actualEnd = eDate > wEnd ? wEnd : eDate;
        return Math.max(1, Math.round((actualEnd - sDate) / (86400000)) + 1);
    }
};