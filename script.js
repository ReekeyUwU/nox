let url = "";
let discordUserId = "324617277393600513";
const TRACKER_URL = 'https://link-tracker2.morning-surf-02e1.workers.dev/track';

async function loadPageStructure() {
    const config = await fetch(TRACKER_URL.replace('/track', '/config')).then(res => res.json());

    document.getElementById('avatar').src = config.avatar;

    document.getElementById('live-title').innerText = config.title;
    document.getElementById('live-bio').innerText = config.bio;
    document.getElementById('live-bg').style.backgroundImage = `url('${config.background}')`;
    document.getElementById('card').style.opacity = "1";
    fetchDynamicLinks();
}

function fetchDynamicLinks() {
    fetch(TRACKER_URL.replace('/track', '/links')).then(res => res.json()).then(links => {
        const buttonContainer = document.getElementById('dynamic-links-container');
        const socialContainer = document.getElementById('dynamic-social-container');
        const widgetArea = document.getElementById('dynamic-widget-area');
        buttonContainer.innerHTML = ''; socialContainer.innerHTML = '';

        const widgetData = links.find(l => l.link_type === 'widget');
        if (widgetData && widgetArea) {
            if(widgetData.url.includes('users/')) discordUserId = widgetData.url.split('users/')[1].replace(/\//g, '');
            widgetArea.innerHTML = `<div class="status-widget"><div class="status-row discord-row" onclick="track('${widgetData.title.replace(/ /g, '_')}', '${widgetData.url}')"><div class="avatar-mini"><img src="${document.getElementById('avatar').src}"><div id="widget-dot" class="widget-status-dot"></div></div><div class="widget-info"><div class="widget-name">${widgetData.title}</div><div id="widget-activity" class="widget-activity">Lädt...</div></div><span class="status-chip" id="widget-status-label"></span></div><div class="status-row spotify-row"><div id="spotify-bg" class="spotify-bg-blur"></div><i class="fa-brands fa-spotify spotify-icon"></i><div class="marquee-container"><div id="music-widget" class="marquee-text">Wird geladen...</div></div><div id="audio-eq" class="eq-container"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div></div></div>`;
        }

        links.forEach(l => {
            const trackingName = l.title.replace(/ /g, '_');
            const iconClass = l.icon ? (l.icon.startsWith('http') || l.icon.includes('simpleicons.org') ? `<img class="dyn-icon-img" src="${l.icon}">` : `<i class="${l.icon}"></i>`) : '<i class="fa-solid fa-link"></i>';
            if (l.link_type === 'social') {
                socialContainer.innerHTML += `<a class="social-icon" onclick="${l.is_nsfw === 1 || l.is_nsfw === true ? `gate('${l.url}', '${trackingName}')` : `track('${trackingName}', '${l.url}')`}">${iconClass}</a>`;
            } else if (l.link_type === 'button') {
                buttonContainer.innerHTML += `<div class="links-card" onclick="${l.is_nsfw === 1 || l.is_nsfw === true ? `gate('${l.url}', '${trackingName}')` : `track('${trackingName}', '${l.url}')`}"><span class="link-label"><span class="link-icon">${iconClass}</span><span class="link-title">${l.title}</span></span><span class="link-meta">${(l.is_nsfw === 1 || l.is_nsfw === true) ? '<span class="badge-18">18+</span>' : '<i class="fa-solid fa-chevron-right chevron"></i>'}</span></div>`;
            }
        });
        updateStatus(); updateMusicStatus();
    });
}

function countView() {
    if (!sessionStorage.getItem('viewed_nox')) {
        fetch(TRACKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link: 'reekey_de_views' }) }).then(() => {
            sessionStorage.setItem('viewed_nox', 'true');
            location.reload();
        }).catch(() => {});
    }
}

fetch(TRACKER_URL.replace('/track', '/view-count'))
  .then(res => res.json())
  .then(data => { document.getElementById('view-count').innerText = data.views.toLocaleString('de-DE'); })
  .catch(err => { document.getElementById('view-count').innerText = "—"; });

function track(name, u) {
    fetch(TRACKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link: name }) });
    if (u) window.open(u, '_blank');
}

function gate(u, name) {
    url = u;
    track(name);
    const el = document.getElementById('age-gate');
    el.style.display = 'flex';
    setTimeout(() => el.classList.add('open'), 10);
}

function hide() {
    const el = document.getElementById('age-gate');
    el.classList.remove('open');
    setTimeout(() => el.style.display = 'none', 300);
}

function go() { window.open(url, '_blank'); hide(); }

async function updateStatus() {
    try {
        const d = (await fetch(`https://api.lanyard.rest/v1/users/${discordUserId}`).then(res => res.json())).data;
        if(document.getElementById('widget-dot')) document.getElementById('widget-dot').style.backgroundColor = { 'online': '#43b581', 'idle': '#faa61a', 'dnd': '#f04747', 'offline': '#555' }[d.discord_status] || '#555';
        const statusLabelMap = { 'online': 'Online', 'idle': 'Idle', 'dnd': 'DND', 'offline': 'Offline' };
        if(document.getElementById('widget-status-label')) document.getElementById('widget-status-label').innerText = statusLabelMap[d.discord_status] || '';
        const game = d.activities.find(a => a.type === 0);
        if(document.getElementById('widget-activity')) document.getElementById('widget-activity').innerText = game ? `🎮 ${game.name}` : 'Discord';
    } catch(e) {}
}

async function updateMusicStatus() {
    try {
        const d = (await fetch(`https://api.lanyard.rest/v1/users/${discordUserId}`).then(res => res.json())).data;
        const m = document.getElementById('music-widget'), bg = document.getElementById('spotify-bg'), eq = document.getElementById('audio-eq');
        if (!m) return;
        if (!d.spotify) { m.innerText = "Läuft gerade nichts"; if(bg) bg.style.opacity = "0"; if(eq) eq.style.display = "none"; }
        else { m.innerText = `${d.spotify.song} – ${d.spotify.artist}`; if (d.spotify.album_art_url && bg) { bg.style.backgroundImage = `url('${d.spotify.album_art_url}')`; bg.style.opacity = "1"; } if(eq) eq.style.display = "flex"; }
    } catch(e) { }
}

loadPageStructure();
countView();
setInterval(updateStatus, 10000);
setInterval(updateMusicStatus, 30000);
