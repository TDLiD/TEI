/**
 * staff-level.js - 프로필 이미지 표시 버전
 */
const LevelSystem = {
    points: { 
        attPerfect: 15,    
        attRow: 5,         
        report: 5,         
        leave: -2,         
        missingLeave: -5,  
        latePenalty: -2    
    },

    getRank(totalPoints) {
        if (totalPoints >= 50000) return { name: 'ETERNAL', color: 'text-white shadow-[0_0_10px_#fff]', icon: '🌌', next: 100000 };
        if (totalPoints >= 35000) return { name: 'CHALLENGER I', color: 'text-rose-500', icon: '👑', next: 50000 };
        if (totalPoints >= 25000) return { name: 'CHALLENGER II', color: 'text-rose-400', icon: '🏆', next: 35000 };
        if (totalPoints >= 18000) return { name: 'GRANDMASTER I', color: 'text-red-500', icon: '🔥', next: 25000 };
        if (totalPoints >= 12000) return { name: 'GRANDMASTER II', color: 'text-red-400', icon: '🌋', next: 18000 };
        if (totalPoints >= 900)   return { name: 'SILVER I', color: 'text-slate-200', icon: '🥈', next: 1300 };
        if (totalPoints >= 600)   return { name: 'SILVER II', color: 'text-slate-400', icon: '⚪', next: 900 };
        if (totalPoints >= 400)   return { name: 'BRONZE I', color: 'text-orange-400', icon: '🥉', next: 600 };
        if (totalPoints >= 200)   return { name: 'BRONZE II', color: 'text-orange-600', icon: '🟠', next: 400 };
        if (totalPoints >= 50)    return { name: 'IRON I', color: 'text-stone-400', icon: '🛠️', next: 200 };
        return { name: 'IRON II', color: 'text-stone-600', icon: '👶', next: 50 };
    },

    // profileImg 매개변수 추가
    calculateUserStats(userId, allAtt, allReports, userLeaves, profileImg) {
        let totalAttRows = 0, pureAttCount = 0, lateCount = 0, reportCount = 0;
        let totalLeaveMinutes = 0, leaveTimeCount = 0;
        let missingAttendCount = 0, missingLeaveCount = 0;

        const leaveStatusList = ["WO", "PEL", "ANL", "HAL", "SIL", "SPL", "EVL", "OFF"];

        if (allAtt) {
            Object.keys(allAtt).forEach(date => {
                const userData = allAtt[date][userId];
                if (!userData) return;

                const attVal = (typeof userData === 'object') ? userData.attend : userData;
                const statusStr = String(attVal || "").trim().toUpperCase();
                const lTime = (typeof userData === 'object') ? userData.leave : null;
                const leaveStr = String(lTime || "").trim().toUpperCase();

                const isNormalWork = statusStr.includes("ATT") || statusStr.includes("LATE") || statusStr.match(/^\d{2}:\d{2}$/);
                const isLeaveStatus = leaveStatusList.some(s => statusStr.includes(s));

                if (isNormalWork || isLeaveStatus) {
                    totalAttRows++;
                } else {
                    return;
                }

                if (isNormalWork) {
                    const hasAttend = statusStr.includes("ATT") || statusStr.includes("LATE") || statusStr.match(/^\d{2}:\d{2}$/);
                    const hasLeave = leaveStr.match(/^\d{2}:\d{2}$/);

                    if (hasAttend && !hasLeave) missingLeaveCount++;
                    if (!hasAttend && hasLeave) missingAttendCount++;

                    if (statusStr.includes("ATT") || (statusStr.match(/^\d{2}:\d{2}$/) && !statusStr.includes("LATE"))) {
                        pureAttCount++;
                    } else if (statusStr.includes("LATE")) {
                        lateCount++;
                    }

                    if (hasLeave) {
                        const m = leaveStr.match(/(\d{1,2}):(\d{1,2})/);
                        if (m) {
                            totalLeaveMinutes += (parseInt(m[1]) * 60) + parseInt(m[2]);
                            leaveTimeCount++;
                        }
                    }
                }
            });
        }

        if (allReports) {
            Object.keys(allReports).forEach(date => { if (allReports[date][userId]) reportCount++; });
        }
        
        const leaveUsageCount = userLeaves ? Object.keys(userLeaves).length : 0;
        const attPoints = pureAttCount * this.points.attPerfect;
        const latePoints = lateCount * (this.points.attPerfect * 0.4); 
        const rowPoints = totalAttRows * this.points.attRow;
        const repPoints = reportCount * this.points.report;
        const penaltyPoints = (leaveUsageCount * this.points.leave) + (missingLeaveCount * this.points.missingLeave);

        let basePoints = attPoints + latePoints + rowPoints + repPoints + penaltyPoints;
        const attRate = totalAttRows > 0 ? (pureAttCount / totalAttRows) : 0;
        
        let bonus = 0;
        if (attRate >= 0.95) bonus = basePoints * 0.1;
        else if (attRate < 0.3) bonus = -(basePoints * 0.1);

        const totalPoints = Math.max(totalAttRows * 2, Math.floor(basePoints + bonus));

        let avgLeaveTime = "--:--";
        if (leaveTimeCount > 0) {
            const avgMins = Math.floor(totalLeaveMinutes / leaveTimeCount);
            avgLeaveTime = `${String(Math.floor(avgMins/60)).padStart(2,'0')}:${String(avgMins%60).padStart(2,'0')}`;
        }
        
        return { 
            userId, totalPoints, rank: this.getRank(totalPoints), 
            profileImg: profileImg || 'image-001.webp', // 이미지 정보 포함
            stats: { 
                totalAttRows, pureAttCount, lateCount, reportCount, 
                avgLeaveTime, missingAttendCount, missingLeaveCount,
                attRate: (attRate * 100).toFixed(0) 
            }
        };
    },

    async init(userId) {
        if (!userId) return;
        try {
            const db = firebase.database();
            const [attSnap, leavesSnap, reportsSnap, usersSnap] = await Promise.all([
                db.ref(`attendance`).once('value'),
                db.ref(`leaves`).once('value'),
                db.ref(`reports`).once('value'),
                db.ref(`users`).once('value')
            ]);

            const allAtt = attSnap.val();
            const allLeaves = leavesSnap.val();
            const allReports = reportsSnap.val();
            const allUsers = usersSnap.val();

            // 본인 데이터 계산
            const myProfileImg = allUsers[userId]?.profileImg;
            const myData = this.calculateUserStats(userId, allAtt, allReports, allLeaves ? allLeaves[userId] : null, myProfileImg);
            this.render(myData.totalPoints, myData.rank, myData.stats);

            // 리더보드 데이터 구성 (profileImg 포함)
            this.allStaffRankings = Object.keys(allUsers)
                .filter(u => u !== 'Admin' && allUsers[u].role !== 'Manager')
                .map(u => this.calculateUserStats(u, allAtt, allReports, allLeaves ? allLeaves[u] : null, allUsers[u].profileImg))
                .sort((a, b) => b.totalPoints - a.totalPoints);

        } catch (error) { console.error("Level System Error:", error); }
    },

    showStaffPopup() {
        let existing = document.getElementById('staffRankPopup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'staffRankPopup';
        popup.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn';
        
        let listHtml = this.allStaffRankings.map((user, idx) => `
            <div class="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 mb-2">
                <div class="text-[10px] font-bold text-slate-500 w-4">${idx + 1}</div>
                
                <div class="relative">
                    <img src="images/profile/${user.profileImg}" class="w-10 h-10 rounded-full object-cover border border-slate-700 shadow-lg" onerror="this.src='images/profile/image-001.webp'">
                    <div class="absolute -bottom-1 -right-1 bg-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] border border-slate-700">
                        ${user.rank.icon}
                    </div>
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center">
                        <span class="text-xs font-bold text-white truncate mr-2">${user.userId}</span>
                        <span class="text-[10px] font-mono ${user.rank.color} shrink-0">${user.totalPoints.toLocaleString()} PTS</span>
                    </div>
                    <div class="grid grid-cols-2 gap-x-2 mt-1 text-[8px] text-slate-400 font-medium uppercase tracking-tighter">
                        <span>Att: ${user.stats.pureAttCount}/${user.stats.totalAttRows}</span>
                        <span>Late: ${user.stats.lateCount}/${user.stats.totalAttRows}</span>
                        <span>Avg Leave: ${user.stats.avgLeaveTime}</span>
                        <span class="text-rose-400 text-right font-bold">Miss(A/L): ${user.stats.missingAttendCount}/${user.stats.missingLeaveCount}</span>
                    </div>
                </div>
            </div>
        `).join('');

        popup.innerHTML = `
            <div class="bg-slate-900 w-full max-w-md max-h-[80vh] rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden font-sans">
                <div class="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h2 class="text-sm font-black text-white tracking-widest uppercase">Staff Leaderboard</h2>
                    <button onclick="this.closest('#staffRankPopup').remove()" class="text-slate-400 hover:text-white text-xl">&times;</button>
                </div>
                <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    ${listHtml}
                </div>
            </div>
        `;
        document.body.appendChild(popup);
    },

    render(points, rank, stats) {
        const container = document.getElementById('levelDisplayContainer');
        if (!container) return;
        const progress = Math.min((points / rank.next) * 100, 100);

        container.innerHTML = `
            <div onclick="LevelSystem.showStaffPopup()" class="mt-2 p-3 bg-slate-900/90 rounded-2xl border border-slate-700 backdrop-blur-md shadow-lg cursor-pointer hover:bg-slate-800/90 transition-all active:scale-95">
                <div class="flex items-center gap-3 mb-2">
                    <div class="flex flex-col items-center justify-center bg-black/40 w-12 h-12 rounded-lg border border-white/5">
                        <span class="text-xl">${rank.icon}</span>
                        <span class="text-[8px] font-bold text-blue-400 leading-none">${stats.attRate}%</span>
                    </div>
                    <div class="flex-1">
                        <div class="flex justify-between items-center mb-1">
                            <h3 class="text-[10px] font-black ${rank.color} tracking-tighter uppercase">${rank.name}</h3>
                            <span class="text-[10px] text-white font-mono font-bold">${points.toLocaleString()} <span class="text-slate-500 text-[8px]">PTS</span></span>
                        </div>
                        <div class="w-full h-1 bg-black/50 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-4 gap-1 text-[9px] font-medium border-t border-slate-800/50 pt-2 text-center">
                    <div>
                        <p class="text-slate-500 text-[7px] scale-90 uppercase">Att / Total</p>
                        <p class="text-white">${stats.pureAttCount}/${stats.totalAttRows}</p>
                    </div>
                    <div>
                        <p class="text-yellow-500 text-[7px] scale-90 uppercase font-bold">Late / Total</p>
                        <p class="text-yellow-400">${stats.lateCount}/${stats.totalAttRows}</p>
                    </div>
                    <div>
                        <p class="text-rose-500 text-[7px] scale-90 uppercase font-bold">Miss(A/L)</p>
                        <p class="text-rose-400">${stats.missingAttendCount}/${stats.missingLeaveCount}</p>
                    </div>
                    <div>
                        <p class="text-blue-300 text-[7px] scale-90 uppercase font-bold">Avg Leave</p>
                        <p class="text-blue-200">${stats.avgLeaveTime}</p>
                    </div>
                </div>
            </div>
        `;
    }
};
window.LevelSystem = LevelSystem;