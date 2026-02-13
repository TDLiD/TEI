/**
 * staff-level.js - 프로필 이미지, 안개 효과 순환 및 상세 정보 복구 버전
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

    allStaffRankings: [],
    displayInterval: null,
    currentIndex: -1, 
    myId: null,
    myData: null,

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

    calculateUserStats(userId, allAtt, allReports, userLeaves, profileImg) {
        if (!userId) return null;
        let totalAttRows = 0, pureAttCount = 0, lateCount = 0, reportCount = 0;
        let totalLeaveMinutes = 0, leaveTimeCount = 0;
        let missingAttendCount = 0, missingLeaveCount = 0;
        const leaveStatusList = ["WO", "PEL", "ANL", "HAL", "SIL", "SPL", "EVL", "OFF"];

        if (allAtt) {
            Object.keys(allAtt).forEach(date => {
                const dayData = allAtt[date];
                if (!dayData || !dayData[userId]) return;
                const userData = dayData[userId];
                const attVal = (typeof userData === 'object') ? userData.attend : userData;
                const statusStr = String(attVal || "").trim().toUpperCase();
                const lTime = (typeof userData === 'object') ? userData.leave : null;
                const leaveStr = String(lTime || "").trim().toUpperCase();
                
                const isNormalWork = statusStr.includes("ATT") || statusStr.includes("LATE") || statusStr.match(/^\d{2}:\d{2}$/);
                const isLeaveStatus = leaveStatusList.some(s => statusStr.includes(s));
                
                if (isNormalWork || isLeaveStatus) totalAttRows++;
                else return;

                if (isNormalWork) {
                    const hasAttend = statusStr.includes("ATT") || statusStr.includes("LATE") || statusStr.match(/^\d{2}:\d{2}$/);
                    const hasLeave = leaveStr.match(/^\d{2}:\d{2}$/);
                    if (hasAttend && !hasLeave) missingLeaveCount++;
                    if (!hasAttend && hasLeave) missingAttendCount++;
                    
                    if (statusStr.includes("ATT") || (statusStr.match(/^\d{2}:\d{2}$/) && !statusStr.includes("LATE"))) pureAttCount++;
                    else if (statusStr.includes("LATE")) lateCount++;
                    
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
            Object.keys(allReports).forEach(date => { 
                if (allReports[date] && allReports[date][userId]) reportCount++; 
            });
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
            profileImg: profileImg || 'image-001.webp',
            stats: { 
                totalAttRows, pureAttCount, lateCount, reportCount, 
                avgLeaveTime, missingAttendCount, missingLeaveCount,
                attRate: (attRate * 100).toFixed(0) 
            }
        };
    },

    async init(userId) {
        if (!userId) return;
        this.myId = userId;
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
            if (!allUsers) return;

            this.myData = this.calculateUserStats(userId, allAtt, allReports, allLeaves ? allLeaves[userId] : null, allUsers[userId]?.profileImg);

            this.allStaffRankings = Object.keys(allUsers)
                .filter(u => u !== 'Admin' && allUsers[u] && allUsers[u].role !== 'Manager')
                .map(u => this.calculateUserStats(u, allAtt, allReports, allLeaves ? allLeaves[u] : null, allUsers[u].profileImg))
                .filter(res => res !== null)
                .sort((a, b) => b.totalPoints - a.totalPoints);

            if (this.myData) {
                this.render();
                this.startCycling();
            }
        } catch (error) { console.error("Initialization Failed:", error); }
    },

    startCycling() {
        if (this.displayInterval) clearInterval(this.displayInterval);
        this.displayInterval = setInterval(() => {
            const inner = document.getElementById('levelDisplayInner');
            if (!inner) return;

            inner.style.opacity = '0';
            inner.style.filter = 'blur(10px)';
            inner.style.transform = 'scale(0.95) translateY(-5px)';

            setTimeout(() => {
                this.currentIndex++;
                if (this.currentIndex >= this.allStaffRankings.length) {
                    this.currentIndex = -1;
                }
                const targetData = this.currentIndex === -1 ? this.myData : this.allStaffRankings[this.currentIndex];
                this.updateContent(targetData);
                inner.style.opacity = '1';
                inner.style.filter = 'blur(0px)';
                inner.style.transform = 'scale(1) translateY(0px)';
            }, 700);
        }, 2700);
    },

    updateContent(data) {
        const inner = document.getElementById('levelDisplayInner');
        if (!inner || !data) return;

        const progress = Math.min((data.totalPoints / data.rank.next) * 100, 100);
        const isMe = data.userId === this.myId;

        inner.innerHTML = `
            <div class="flex items-center gap-3 mb-2">
                <div class="relative shrink-0">
                    <div class="w-12 h-12 rounded-xl overflow-hidden border-2 ${isMe ? 'border-blue-500/50' : 'border-slate-700'} shadow-lg bg-black/20">
                        <img src="images/profile/${data.profileImg}" class="w-full h-full object-cover" onerror="this.src='images/profile/image-001.webp'">
                    </div>
                    <div class="absolute -bottom-1 -right-1 bg-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] border border-slate-700 shadow-md">
                        ${data.rank.icon}
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-end mb-1">
                        <div class="flex flex-col">
                            <div class="flex items-center gap-1">
                                <span class="text-[9px] text-slate-400 font-bold tracking-tight">${data.userId}</span>
                                ${isMe ? '<span class="bg-blue-600 text-[6px] px-1 rounded-[2px] text-white font-black animate-pulse">MY</span>' : ''}
                            </div>
                            <h3 class="text-[11px] font-black ${data.rank.color} tracking-tighter uppercase leading-none mt-0.5">${data.rank.name}</h3>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] text-white font-mono font-bold block leading-none">${data.totalPoints.toLocaleString()} <span class="text-slate-500 text-[8px]">PTS</span></span>
                            <span class="text-[7px] font-bold text-blue-400 uppercase tracking-widest">${data.stats.attRate}% ATT</span>
                        </div>
                    </div>
                    <div class="w-full h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                        <div class="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500 transition-all duration-1000 shadow-[0_0_8px_rgba(6,182,212,0.5)]" style="width: ${progress}%"></div>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-4 gap-1 text-[9px] font-medium border-t border-slate-800/50 pt-2 text-center">
                <div><p class="text-slate-500 text-[7px] scale-90 uppercase font-bold">ATT</p><p class="text-white">${data.stats.pureAttCount}/${data.stats.totalAttRows}</p></div>
                <div><p class="text-yellow-500 text-[7px] scale-90 uppercase font-bold">LATE</p><p class="text-yellow-400">${data.stats.lateCount}/${data.stats.totalAttRows}</p></div>
                <div><p class="text-rose-500 text-[7px] scale-90 uppercase font-bold">MISS</p><p class="text-rose-400">${data.stats.missingAttendCount}/${data.stats.missingLeaveCount}</p></div>
                <div><p class="text-blue-300 text-[7px] scale-90 uppercase font-bold">AVG OUT</p><p class="text-blue-200">${data.stats.avgLeaveTime}</p></div>
            </div>
        `;
    },

    render() {
        const container = document.getElementById('levelDisplayContainer');
        if (!container) return;

        if (!document.getElementById('fog-effect-style')) {
            const style = document.createElement('style');
            style.id = 'fog-effect-style';
            style.innerHTML = `
                #levelDisplayInner { transition: all 0.7s cubic-bezier(0.4, 0, 0.2, 1); will-change: opacity, filter, transform; }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
                @keyframes pageFlip { 
                    0% { transform: perspective(1000px) rotateX(-90deg); opacity: 0; } 
                    100% { transform: perspective(1000px) rotateX(0deg); opacity: 1; } 
                }
                .rank-card-flip { animation: pageFlip 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards; opacity: 0; transform-origin: top; }
            `;
            document.head.appendChild(style);
        }

        container.innerHTML = `
            <div onclick="LevelSystem.showStaffPopup()" id="levelDisplayCard" 
                 class="mt-2 p-3 bg-slate-900/95 rounded-2xl border border-slate-700/50 backdrop-blur-xl shadow-2xl cursor-pointer 
                        hover:bg-slate-800/90 transition-all active:scale-[0.97] group overflow-hidden relative">
                <div class="absolute -top-10 -left-10 w-20 h-20 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors"></div>
                <div id="levelDisplayInner"></div>
            </div>
        `;
        this.updateContent(this.myData);
    },

    showStaffPopup() {
        let existing = document.getElementById('staffRankPopup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'staffRankPopup';
        popup.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm';
        
        let listHtml = this.allStaffRankings.map((user, idx) => {
            const isMe = user.userId === this.myId;
            return `
                <div class="rank-card-flip flex flex-col p-3 ${isMe ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/5'} rounded-xl border mb-2" 
                     style="animation-delay: ${idx * 0.05}s">
                    <div class="flex items-center gap-3">
                        <div class="text-[10px] font-bold text-slate-500 w-4">${idx + 1}</div>
                        <div class="relative shrink-0">
                            <img src="images/profile/${user.profileImg}" class="w-10 h-10 rounded-full object-cover border border-slate-700" onerror="this.src='images/profile/image-001.webp'">
                            <div class="absolute -bottom-1 -right-1 bg-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-[10px] border border-slate-700">${user.rank.icon}</div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center">
                                <span class="text-xs font-bold text-white truncate mr-2">${user.userId} ${isMe ? '<span class="text-blue-400 text-[9px]">(MY)</span>' : ''}</span>
                                <span class="text-[10px] font-mono ${user.rank.color} shrink-0">${user.totalPoints.toLocaleString()} PTS</span>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-4 gap-1 mt-2 pt-2 border-t border-white/5 text-[8px] text-center text-slate-400 uppercase tracking-tighter font-medium">
                        <span>Att: <b class="text-white">${user.stats.pureAttCount}/${user.stats.totalAttRows}</b></span>
                        <span>Late: <b class="text-yellow-400">${user.stats.lateCount}/${user.stats.totalAttRows}</b></span>
                        <span>Miss (A/L): <b class="text-rose-400">${user.stats.missingAttendCount}/${user.stats.missingLeaveCount}</b></span>
                        <span>Avg Out: <b class="text-blue-300">${user.stats.avgLeaveTime}</b></span>
                    </div>
                </div>
            `;
        }).join('');

        popup.innerHTML = `
            <div class="bg-slate-900 w-full max-w-md max-h-[80vh] rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] font-sans">
                <div class="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h2 class="text-sm font-black text-white tracking-widest uppercase">Staff Leaderboard</h2>
                    <button onclick="document.getElementById('staffRankPopup').remove()" class="text-slate-400 hover:text-white text-xl transition-transform hover:rotate-90">&times;</button>
                </div>
                <div class="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gradient-to-b from-transparent to-black/20">
                    ${listHtml || '<div class="text-center text-slate-500 py-10">No rankings available</div>'}
                </div>
            </div>
        `;
        document.body.appendChild(popup);
    }
};

window.LevelSystem = LevelSystem;