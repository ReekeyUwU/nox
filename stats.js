const users = {
    reekey: { api: "https://link-tracker.morning-surf-02e1.workers.dev", color: "#00ff08" },
    nox:    { api: "https://link-tracker2.morning-surf-02e1.workers.dev", color: "#4682B4" },
    dejaykey: { api: "https://link-tracker3.morning-surf-02e1.workers.dev", color: "#8a2be2" }
};

let currentUser = 'reekey', chartInstance = null, modalChartInstance = null, globalRawData = {}, currentFilter = 'all', activeLinkData = [];

function getToken(user) { return sessionStorage.getItem('authToken_' + user); }
function setToken(user, token) { sessionStorage.setItem('authToken_' + user, token); }
function clearToken(user) { sessionStorage.removeItem('authToken_' + user); }

(async function initSession() {
    const savedUser = localStorage.getItem('preferredAccount');
    if (savedUser && users[savedUser]) {
        currentUser = savedUser;
        document.getElementById('account-toggle').value = currentUser;
        document.getElementById('pre-login-account').value = currentUser;
    }
    const authed = await checkAuthStatus(currentUser);
    if (authed) {
        applyThemeContext();
        showStats();
    }
})();

async function checkAuthStatus(user) {
    const token = getToken(user);
    if (!token) return false;
    try {
        const res = await fetch(`${users[user].api}/check-auth`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        return !!data.authenticated;
    } catch (e) {
        return false;
    }
}

async function checkPassword() {
    const selectedAccount = document.getElementById('pre-login-account').value;
    const input = document.getElementById('pw-input').value;
    const btn = document.getElementById('login-submit-btn');
    document.getElementById('login-error').style.display = 'none';
    btn.disabled = true;
    btn.innerText = "Prüfe...";

    try {
        const res = await fetch(`${users[selectedAccount].api}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: input })
        });

        if (res.status === 429) {
            document.getElementById('login-error').innerText = "Zu viele Versuche. Bitte kurz warten.";
            document.getElementById('login-error').style.display = 'block';
            return;
        }

        if (!res.ok) {
            document.getElementById('login-error').innerText = "Falsches Passwort!";
            document.getElementById('login-error').style.display = 'block';
            return;
        }

        const data = await res.json();
        setToken(selectedAccount, data.token);
        currentUser = selectedAccount;
        document.getElementById('account-toggle').value = currentUser;
        localStorage.setItem('preferredAccount', currentUser);
        applyThemeContext();
        showStats();
    } catch (e) {
        document.getElementById('login-error').innerText = "Verbindung fehlgeschlagen.";
        document.getElementById('login-error').style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerText = "Dashboard öffnen";
    }
}

function applyThemeContext() {
    document.getElementById('body-context').className = currentUser === 'nox' ? 'theme-nox' : currentUser === 'dejaykey' ? 'theme-dejay' : 'theme-reekey';
    document.getElementById('login-card').style.borderColor = users[currentUser].color + "44";
}

async function switchAccount() {
    const newUser = document.getElementById('account-toggle').value;
    const authed = await checkAuthStatus(newUser);
    if (!authed) {
        document.getElementById('stats-content').style.display = 'none';
        document.getElementById('pw-overlay').style.display = 'flex';
        document.getElementById('pre-login-account').value = newUser;
        currentUser = newUser;
        applyThemeContext();
        return;
    }
    currentUser = newUser;
    localStorage.setItem('preferredAccount', currentUser);
    applyThemeContext();
    loadStats();
}

function showStats() {
    document.getElementById('pw-overlay').style.display = 'none';
    document.getElementById('stats-content').style.display = 'flex';
    loadStats();
    setInterval(loadStats, 10000);
}

async function logout() {
    const token = getToken(currentUser);
    try {
        await fetch(`${users[currentUser].api}/logout`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        });
    } catch (e) {}
    clearToken(currentUser);
    location.reload();
}

async function authedFetch(path, options = {}) {
    const token = getToken(currentUser);
    const headers = { ...(options.headers || {}), 'Authorization': 'Bearer ' + token };
    const res = await fetch(`${users[currentUser].api}${path}`, { ...options, headers });
    if (res.status === 401) {
        clearToken(currentUser);
        document.getElementById('stats-content').style.display = 'none';
        document.getElementById('pw-overlay').style.display = 'flex';
        throw new Error('Session abgelaufen');
    }
    return res;
}

function loadStats() {
    authedFetch('/stats').then(res => res.json()).then(data => {
        globalRawData = data;
        document.getElementById('live-ticker').innerText = `Live-Sync: ${new Date().toTimeString().split(' ')[0]} Uhr`;
        processAndRender();
        loadCMSLinks();
        loadSiteConfig();
    }).catch(() => {});
}

function loadSiteConfig() {
    fetch(`${users[currentUser].api}/config`).then(res => res.json()).then(config => {
        document.getElementById('site-avatar').value = config.avatar || '';
        document.getElementById('site-title').value = config.title || '';
        document.getElementById('site-bio').value = config.bio || '';
        document.getElementById('site-background').value = config.background || '';
    });
}

function saveSiteConfig() {
    const data = { avatar: document.getElementById('site-avatar').value, title: document.getElementById('site-title').value, bio: document.getElementById('site-bio').value, background: document.getElementById('site-background').value };
    const btn = document.getElementById('config-save-btn');
    btn.innerText = "Wird gespeichert...";
    authedFetch('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(() => { btn.innerText = "Erfolgreich live geschaltet!"; setTimeout(() => btn.innerText = "Design live aktualisieren", 2000); })
        .catch(() => {});
}

function changeFilter(filterType, btn) {
    currentFilter = filterType;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    processAndRender();
}

function cleanKey(str) {
    return str.replace(/ /g, '_').replace(/\(/g, '').replace(/\)/g, '').toLowerCase();
}

function processAndRender() {
    const rawAllTime = globalRawData.allTime || {}, rawHistory = globalRawData.history || {}, viewsKey = 'reekey_de_views';
    const targetCleanViewsKey = cleanKey(viewsKey);

    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let cutoffStr = todayStr;
    if (currentFilter !== 'all' && currentFilter !== '1d') {
        let days = currentFilter === '7d' ? 7 : currentFilter === '30d' ? 30 : 90;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;
    }

    const aggregated = {};

    Object.keys(rawAllTime).forEach(k => {
        const cKey = cleanKey(k);
        let cleanName = k.replace(/_/g, ' ');
        if (cleanName.toLowerCase() === 'x_twitter' || cleanName.toLowerCase() === 'x twitter') {
            cleanName = 'X (Twitter)';
        }

        if (!aggregated[cKey]) {
            aggregated[cKey] = { name: cleanName, normName: cKey, totalAllTime: 0, clicks: 0, historyRows: [] };
        }
        aggregated[cKey].totalAllTime += parseInt(rawAllTime[k]) || 0;
    });

    Object.keys(rawHistory).forEach(key => {
        const cKey = cleanKey(key);
        if (aggregated[cKey]) {
            aggregated[cKey].historyRows = aggregated[cKey].historyRows.concat(rawHistory[key]);
        }
    });

    Object.keys(aggregated).forEach(cKey => {
        const item = aggregated[cKey];
        if (currentFilter === 'all') {
            item.clicks = item.totalAllTime;
        } else {
            if (currentFilter === '1d') {
                item.clicks = item.historyRows.filter(r => r.date.slice(0, 10) === todayStr).reduce((s, r) => s + r.clicks, 0);
            } else {
                item.clicks = item.historyRows.filter(r => r.date.slice(0, 10) >= cutoffStr).reduce((s, r) => s + r.clicks, 0);
            }
        }
    });

    const currentViews = aggregated[targetCleanViewsKey] ? aggregated[targetCleanViewsKey].clicks : 0;
    const labelMap = { 'all': 'Gesamt', '90d': '90 Tage', '30d': '30 Tage', '7d': '7 Tage', '1d': 'Heute' };
    document.getElementById('page-views').innerText = `Aufrufe (${labelMap[currentFilter]}): ` + currentViews.toLocaleString('de-DE');

    activeLinkData = Object.keys(aggregated).filter(k => k !== targetCleanViewsKey).map(k => {
        const item = aggregated[k];
        let trendVal = 0;

        if (item.historyRows.length > 0) {
            const d7 = new Date(); d7.setDate(d7.getDate() - 7); const lim7 = d7.toISOString().slice(0,10);
            const d14 = new Date(); d14.setDate(d14.getDate() - 14); const lim14 = d14.toISOString().slice(0,10);
            const lastWeek = item.historyRows.filter(i => i.date >= lim7).reduce((s,i) => s+i.clicks, 0);
            const prevWeek = item.historyRows.filter(i => i.date >= lim14 && i.date < lim7).reduce((s,i) => s+i.clicks, 0);

            if (prevWeek === 0) {
                trendVal = 0;
            } else {
                trendVal = Math.round(((lastWeek - prevWeek) / prevWeek) * 100);
            }
        }

        const sortedHistory = item.historyRows.sort((a,b) => a.date.localeCompare(b.date)).slice(-7);

        return {
            name: item.name,
            normName: item.normName,
            clicks: item.clicks,
            totalAllTime: item.totalAllTime,
            ctr: currentViews > 0 ? ((item.clicks / currentViews) * 100).toFixed(1) : 0,
            trend: trendVal,
            chartLabels: sortedHistory.map(i => i.date.slice(5)),
            chartValues: sortedHistory.map(i => i.clicks)
        };
    }).sort((a, b) => b.clicks - a.clicks);

    renderList();
}

function gridColor() { return 'rgba(255,255,255,0.03)'; }

document.getElementById('search-bar').addEventListener('input', renderList);

function renderList() {
    const word = document.getElementById('search-bar').value.toLowerCase();
    const filtered = activeLinkData.filter(i => i.name.toLowerCase().includes(word));
    const container = document.getElementById('stats-container');

    container.innerHTML = filtered.map((item, index) => {
        const isNegative = item.trend < 0;
        const trendClass = isNegative ? 'trend-badge trend-down' : 'trend-badge trend-up';
        const trendStr = isNegative ? `↓ ${Math.abs(item.trend)}%` : `↑ ${item.trend}%`;
        const isTopWinner = index === 0 && currentFilter === 'all' && word === '';
        const rowIcon = isTopWinner
            ? '<i class="fa-solid fa-crown" style="color:#ffd700; margin-right:4px;"></i>'
            : '<i class="fa-solid fa-link" style="color:rgba(255,255,255,0.1); margin-right:4px;"></i>';

        return `
            <div class="${isTopWinner ? 'row top-winner' : 'row'}" onclick="openDetails('${item.normName}')">
                <div class="row-left">
                    <div class="row-title">${rowIcon}${item.name}</div>
                    <div class="metrics-box">
                        <span class="ctr-badge">${item.ctr}% CTR</span>
                        <span class="${trendClass}">${trendStr}</span>
                    </div>
                </div>
                <b>${item.clicks.toLocaleString('de-DE')} Klicks</b>
            </div>
        `;
    }).join('');

    const chartContainer = document.getElementById('statsChart').parentElement;
    chartContainer.style.height = Math.max(200, filtered.length * 28) + 'px';

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(document.getElementById('statsChart').getContext('2d'), { type: 'bar', data: { labels: filtered.map(e => e.name), datasets: [{ data: filtered.map(e => e.clicks), backgroundColor: users[currentUser].color, borderRadius: 5 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor() }, ticks:{color:'#666'} }, y: { grid: { display: false }, ticks: { color: users[currentUser].color, font: { weight: 'bold' }, autoSkip: false } } } } });
}

let cmsRawLinks = [];
function loadCMSLinks() {
    fetch(`${users[currentUser].api}/links`).then(res => res.json()).then(links => {
        cmsRawLinks = links || [];
        const groups = { button: [], social: [], widget: [] };
        cmsRawLinks.forEach(l => { if(groups[l.link_type]) groups[l.link_type].push(l); });

        let html = '';
        for (const [type, list] of Object.entries(groups)) {
            html += `<div class="cms-group-title">${type}s</div>`;
            html += list.map(l => {
                const isNsfw = (l.is_nsfw === 1 || l.is_nsfw === true || l.is_nsfw === "1");
                return `<div class="cms-item"><div><strong style="color:#fff;">${l.title}</strong> ${isNsfw ? '<span style="color:#ff0055; font-size:11px; font-weight:bold; margin-left:6px;">[18+]</span>':''}<div style="font-size:11px; color:#444;">${l.url}</div></div><div class="cms-actions"><button class="icon-btn edit" onclick="editLink(${l.id})"><i class="fa-solid fa-pen"></i></button><button class="icon-btn" onclick="deleteLink(${l.id})"><i class="fa-solid fa-trash"></i></button></div></div>`;
            }).join('');
        }
        document.getElementById('cms-list-container').innerHTML = html;
    });
}

function saveLink() {
    const data = {
        id: document.getElementById('link-id').value ? parseInt(document.getElementById('link-id').value) : null,
        title: document.getElementById('link-title').value,
        url: document.getElementById('link-url').value,
        icon: document.getElementById('link-icon').value,
        is_nsfw: document.getElementById('link-nsfw').checked,
        sort_order: parseInt(document.getElementById('link-order').value) || 0,
        link_type: document.getElementById('link-type').value
    };
    authedFetch('/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(() => { clearCMSForm(); loadStats(); })
        .catch(() => {});
}

function editLink(id) {
    const l = cmsRawLinks.find(item => item.id === id);
    if (!l) return;
    document.getElementById('link-id').value = l.id;
    document.getElementById('link-title').value = l.title;
    document.getElementById('link-url').value = l.url;
    document.getElementById('link-icon').value = l.icon || '';
    document.getElementById('link-nsfw').checked = (l.is_nsfw === 1 || l.is_nsfw === true || l.is_nsfw === "1");
    document.getElementById('link-order').value = l.sort_order;
    document.getElementById('link-type').value = l.link_type;
    document.getElementById('save-btn').innerText = "Änderungen abspeichern";
}

function deleteLink(id) {
    if(confirm("Link unwiderruflich löschen?")) {
        authedFetch('/links', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
            .then(() => loadStats())
            .catch(() => {});
    }
}

function clearCMSForm() {
    document.getElementById('link-id').value = "";
    document.getElementById('link-title').value = "";
    document.getElementById('link-url').value = "";
    document.getElementById('link-icon').value = "";
    document.getElementById('link-nsfw').checked = false;
    document.getElementById('link-order').value = "0";
    document.getElementById('save-btn').innerText = "Link speichern";
}

function openDetails(cleanK) {
    const item = activeLinkData.find(e => e.normName === cleanK);
    document.getElementById('modal-title').innerText = item.name;
    document.getElementById('modal-stats-summary').innerText = `All-Time: ${item.totalAllTime.toLocaleString('de-DE')} Klicks`;
    document.getElementById('detail-modal').style.display = 'flex';
    if (modalChartInstance) modalChartInstance.destroy();
    modalChartInstance = new Chart(document.getElementById('modalChart').getContext('2d'), { type: 'line', data: { labels: item.chartLabels, datasets: [{ data: item.chartValues, borderColor: users[currentUser].color, fill: true, tension: 0.3, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
}
function closeModal(e) { if(e.target.id === 'detail-modal') document.getElementById('detail-modal').style.display = 'none'; }
