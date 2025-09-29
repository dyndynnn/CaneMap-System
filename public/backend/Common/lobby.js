
        // Scroll animations (define early and run immediately to avoid hidden content if later errors occur)
        function animateOnScroll() {
            const elements = document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right, .scale-in, .slide-in-bottom');
            elements.forEach(element => {
                const elementTop = element.getBoundingClientRect().top;
                const elementVisible = 150;
                if (elementTop < window.innerHeight - elementVisible) {
                    element.classList.add('animate');
                }
            });
        }
        // run once in case other code errors before listeners are attached
        try { animateOnScroll(); } catch (_) {}
        window.addEventListener('scroll', animateOnScroll);
        window.addEventListener('load', animateOnScroll);

        // Weather API integration
        async function getWeather() {
            try {
                const apiKey = '2d59a2816a02c3178386f3d51233b2ea';
                const lat = 11.0064; // Ormoc City latitude
                const lon = 124.6075; // Ormoc City longitude
                const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
                const response = await fetch(url);
                const data = await response.json();
                const weatherContainer = document.getElementById('weatherForecast');
                const wxDaily = document.getElementById('wxDaily');
                
                if (!data.list) {
                    let errorMsg = 'Weather data unavailable.';
                    if (data.message) {
                        errorMsg += `<br><span class='text-xs text-[var(--cane-600)]'>API: ${data.message}</span>`;
                    }
                    if (wxDaily) {
                        wxDaily.innerHTML = `<div class='p-3 rounded-lg border border-[var(--cane-200)] bg-white/10 text-white/90'>${errorMsg}</div>`;
                    }
                    return;
                }
                
                // Group forecasts by day
                const days = {};
                data.list.forEach(item => {
                    const date = new Date(item.dt * 1000);
                    const dayStr = date.toLocaleDateString();
                    if (!days[dayStr]) {
                        days[dayStr] = [];
                    }
                    days[dayStr].push(item);
                });
                
                // Get today, tomorrow, and next day
                const dayKeys = Object.keys(days).slice(0, 3);
                const dayNames = [
                    'Today',
                    dayKeys[1] ? 'Tomorrow' : '',
                    dayKeys[2] ? new Date(dayKeys[2]).toLocaleDateString('en-US', { weekday: 'long' }) : ''
                ].filter(Boolean);
                
                const rows = dayKeys.map((key, idx) => {
                    // Use the forecast closest to noon for each day
                    const forecasts = days[key];
                    let forecast = forecasts.find(f => new Date(f.dt * 1000).getHours() === 12) || forecasts[Math.floor(forecasts.length / 2)];
                    const temp = `${Math.round(forecast.main.temp_min)}°C / ${Math.round(forecast.main.temp_max)}°C`;
                    const icon = forecast.weather[0].icon;
                    const desc = forecast.weather[0].description;
                    return `
                        <div class="flex items-center justify-between p-3 rounded-lg bg-white/10 text-white border border-white/20">
                            <div class="flex items-center space-x-3">
                                <span class="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
                                    <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${desc}" class="w-5 h-5" />
                                </span>
                                <span class="font-semibold text-sm">${dayNames[idx]}</span>
                            </div>
                            <div class="text-right leading-tight">
                                <div class="font-bold text-sm">${temp}</div>
                                <div class="text-xs opacity-90">${desc}</div>
                            </div>
                        </div>
                    `;
                }).join('');

                // Render into the compact list area only (preserve card structure)
                if (wxDaily) wxDaily.innerHTML = rows;

                // Update big "Today" metrics from first day
                try {
                    const firstKey = dayKeys[0];
                    const forecasts = days[firstKey] || [];
                    const forecast = forecasts.find(f => new Date(f.dt * 1000).getHours() === 12) || forecasts[0];
                    if (forecast) {
                        const tEl = document.getElementById('wxTemp');
                        const wEl = document.getElementById('wxWind');
                        const uvEl = document.getElementById('wxUv');
                        const uvBar = document.getElementById('wxUvBar');
                        const tempNow = Math.round(forecast.main.temp);
                        const windKmh = typeof forecast.wind?.speed === 'number' ? (forecast.wind.speed * 3.6) : null; // m/s → km/h
                        if (tEl) tEl.textContent = String(tempNow);
                        if (wEl && windKmh !== null) wEl.textContent = windKmh.toFixed(1) + ' km/h';
                        // UV not in forecast endpoint; leave as is if not available

                        // Notify background swapper
                        const cond = forecast.weather?.[0]?.description || '';
                        window.dispatchEvent(new CustomEvent('canemap:weather-updated', {
                            detail: { condition: cond, temp: tempNow, windKmh }
                        }));
                    }
                } catch(_) {}
            } catch (error) {
                console.error('Error fetching weather:', error);
                const el = document.getElementById('weatherForecast');
                if (el) el.innerHTML = `<div class='text-[var(--cane-700)] bg-[var(--cane-50)] p-3 rounded-lg border border-[var(--cane-200)]'>Weather data unavailable.<br><span class='text-xs text-[var(--cane-600)]'>${error}</span></div>`;
            }
        }

        // Remove the old expand button
        const expandBtn = document.getElementById('expandMapBtn');
        if (expandBtn) expandBtn.style.display = 'none';

        // New expand/collapse icon logic
        const expandMapIcon = document.getElementById('expandMapIcon');
        const expandIcon = document.getElementById('expandIcon');
        const mainContent = document.getElementById('mainContent');
        const mapPanel = document.getElementById('mapPanel');
        const sidePanel = document.getElementById('sidePanel');
        let expanded = false;

        if (expandMapIcon) {
            expandMapIcon.addEventListener('click', function() {
                expanded = !expanded;
                if (expanded) {
                    if (sidePanel) sidePanel.style.display = 'none';
                    if (mapPanel) mapPanel.classList.add('w-full');
                    if (mainContent) {
                        mainContent.classList.remove('flex', 'lg:flex-row', 'gap-8', 'px-4', 'pb-8');
                        mainContent.classList.add('block', 'p-0');
                    }
                    if (expandIcon) {
                        expandIcon.classList.remove('fa-expand');
                        expandIcon.classList.add('fa-compress');
                    }
                    const mapEl = document.getElementById('map');
                    if (mapEl) {
                        mapEl.classList.remove('mb-6', 'rounded-lg', 'border', 'border-gray-200');
                        mapEl.classList.add('h-[70vh]', 'w-full');
                    }
                    if (window.map) {
                        setTimeout(() => window.map.invalidateSize(), 100);
                    }
                } else {
                    if (sidePanel) sidePanel.style.display = '';
                    if (mapPanel) mapPanel.classList.remove('w-full');
                    if (mainContent) {
                        mainContent.classList.remove('block', 'p-0');
                        mainContent.classList.add('flex', 'lg:flex-row', 'gap-8', 'px-4', 'pb-8');
                    }
                    if (expandIcon) {
                        expandIcon.classList.remove('fa-compress');
                        expandIcon.classList.add('fa-expand');
                    }
                    const mapEl = document.getElementById('map');
                    if (mapEl) {
                        mapEl.classList.remove('h-[70vh]', 'w-full');
                        mapEl.classList.add('mb-6', 'rounded-lg', 'border', 'border-gray-200');
                    }
                    if (window.map) {
                        setTimeout(() => window.map.invalidateSize(), 100);
                    }
                }
            });
        }

        // Initialize map
        let map;
        function initMap() {
            try {
                if (map) return;
                const mapContainer = document.getElementById('map');
                if (!mapContainer) return;
                mapContainer.innerHTML = '';
                map = L.map('map').setView([11.0064, 124.6075], 12);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
                const caneIcon = L.icon({
                    iconUrl: '../img/PIN.png', iconSize: [40, 40], iconAnchor: [20, 38], popupAnchor: [0, -32]
                });
                // Seed any pending fields from Register-field
                try {
                  const pending = JSON.parse(localStorage.getItem('pendingFields')||'[]');
                  pending.forEach(f => {
                    const m = L.marker([f.lat, f.lng], { icon: caneIcon }).addTo(map);
                    const parts = [];
                    parts.push(`<b>${f.barangay || 'Field'}</b>`);
                    const meta = [];
                    if (f.size) meta.push(`${f.size} ha`);
                    if (f.terrain) meta.push(`${f.terrain}`);
                    meta.push('Under Review');
                    const label = parts.join('<br/>') + '<br/>' + meta.join(' · ');
                    m.bindPopup(label);
                  });
                } catch(_) {}
                window.map = map;
                // Search wiring (Nominatim)
                try {
                    const input = document.getElementById('mapSearchInput');
                    const btn = document.getElementById('mapSearchBtn');
                    async function runSearch() {
                        if (!input || !input.value.trim()) return;
                        const q = encodeURIComponent(input.value.trim());
                        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}`;
                        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
                        const results = await res.json();
                        if (!Array.isArray(results) || results.length === 0) {
                            alert('Place not found. Try a different search.');
                            return;
                        }
                        const first = results[0];
                        const lat = parseFloat(first.lat);
                        const lon = parseFloat(first.lon);
                        map.setView([lat, lon], 14);
                        L.marker([lat, lon], { icon: caneIcon }).addTo(map).bindPopup(first.display_name).openPopup();
                    }
                    if (btn) btn.addEventListener('click', function(e){ e.preventDefault(); runSearch(); });
                    if (input) input.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
                } catch(_) {}
            } catch (error) {
                console.error('Error initializing map:', error);
                const el = document.getElementById('map');
                if (el) {
                    el.innerHTML = `
                        <div class="flex items-center justify-center h-full bg-red-50 text-red-600">
                            <div class="text-center">
                                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                                <p>Error loading map</p>
                                <p class="text-sm">${error.message}</p>
                            </div>
                        </div>
                    `;
                }
            }
        }

        // Initialize everything when page loads
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => { initMap(); }, 100);
            getWeather();
            const fullName = localStorage.getItem('farmerName') || 'Farmer Name';
            const firstName = fullName.trim().split(/\s+/)[0] || fullName;
            const headerNameEl = document.getElementById('userName');
            const dropdownNameEl = document.getElementById('dropdownUserName');
            if (headerNameEl) headerNameEl.textContent = firstName;
            if (dropdownNameEl) dropdownNameEl.textContent = fullName;

            // Role gating for Dashboard
            const dashboardLink = document.getElementById('dashboardLink');
            const role = (localStorage.getItem('userRole') || '').toLowerCase();
            const approvedRoles = ['handler', 'worker', 'worker_driver', 'sra_officer'];
            const isApproved = approvedRoles.includes(role);
            if (dashboardLink) {
                if (!isApproved) {
                    dashboardLink.classList.add('opacity-60', 'cursor-not-allowed');
                    dashboardLink.href = 'javascript:void(0)';
                    dashboardLink.addEventListener('click', function(e){
                        e.preventDefault();
                        // Open locked modal tutorial
                        try {
                            const modal = document.getElementById('lockedModal');
                            const dialog = document.getElementById('lockedDialog');
                            const slides = Array.from(document.querySelectorAll('#lockedSlides .slide'));
                            const prev = document.getElementById('lockedPrev');
                            const next = document.getElementById('lockedNext');
                            const gotIt = document.getElementById('lockedGotIt');
                            const counter = document.getElementById('lockedCounter');
                            let idx = 0;
                            function render(){
                                slides.forEach((el,i)=>{ if (i===idx){ el.classList.remove('hidden'); el.classList.add('animate'); } else { el.classList.add('hidden'); el.classList.remove('animate'); } });
                                if (counter) counter.textContent = (idx+1) + ' / ' + slides.length;
                                if (prev) prev.disabled = (idx===0);
                                if (next) next.disabled = (idx===slides.length-1);
                            }
                            function open(){
                                if (!modal || !dialog) return;
                                idx = 0; render();
                                modal.classList.remove('opacity-0','invisible'); modal.classList.add('opacity-100','visible');
                                dialog.classList.remove('translate-y-2','scale-95','opacity-0','pointer-events-none');
                                dialog.classList.add('translate-y-0','scale-100','opacity-100');
                            }
                            function close(){
                                if (!modal || !dialog) return;
                                modal.classList.add('opacity-0','invisible'); modal.classList.remove('opacity-100','visible');
                                dialog.classList.add('translate-y-2','scale-95','opacity-0','pointer-events-none');
                                dialog.classList.remove('translate-y-0','scale-100','opacity-100');
                            }
                            if (prev) prev.onclick = function(){ if (idx>0){ idx--; render(); } };
                            if (next) next.onclick = function(){ if (idx<slides.length-1){ idx++; render(); } };
                            if (gotIt) gotIt.onclick = close;
                            if (modal) modal.addEventListener('click', function(ev){ if (ev.target === modal) close(); });
                            document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape') close(); }, { once: true });
                            open();
                        } catch(_) {}
                    });
                } else {
                    dashboardLink.classList.remove('opacity-60', 'cursor-not-allowed');
                    // Route to dashboard based on role
                    switch (role) {
                        case 'handler':
                            dashboardLink.href = '../Handler/dashboard.html';
                            break;
                        case 'worker':
                            dashboardLink.href = '../Worker/Workers.html';
                            break;
                        case 'worker_driver':
                            dashboardLink.href = '../Driver/Driver_Badge.html';
                            break;
                        case 'sra_officer':
                            dashboardLink.href = '../SRA/SRA_Dashboard.html';
                            break;
                        default:
                            dashboardLink.href = '../Worker/Workers.html';
                    }
                }
            }
            // Wire buttons to absolute paths within frontend
            const regBtn = document.getElementById('btnRegisterField');
            if (regBtn) regBtn.addEventListener('click', function(e){ e.preventDefault(); window.location.href = '../Handler/Register-field.html'; });
            const applyBtn = document.getElementById('btnApplyDriver');
            if (applyBtn) applyBtn.addEventListener('click', function(e){ e.preventDefault(); window.location.href = '../Driver/Driver_Badge.html'; });

            // Render user-specific notifications from localStorage
            try {
                const notificationsList = document.getElementById('notificationsList');
                const userId = localStorage.getItem('userId') || fullName; // fallback to name if no uid
                if (notificationsList) {
                    const all = JSON.parse(localStorage.getItem('notifications') || '{}');
                    const items = Array.isArray(all[userId]) ? all[userId] : [];
                    if (!items.length) {
                        notificationsList.innerHTML = '<div class="p-3 rounded-lg border border-[var(--cane-200)] bg-[var(--cane-50)] text-[var(--cane-900)]/90 text-sm">No new notifications.</div>';
                    } else {
                        notificationsList.innerHTML = items.map(function(n){
                            const icon = n.type === 'approved' ? 'fa-check' : (n.type === 'task' ? 'fa-clipboard' : 'fa-info-circle');
                            return (
                                '<div class="flex items-start space-x-3 p-3 bg-[var(--cane-50)] rounded-lg border border-[var(--cane-200)]">' +
                                  '<div class="w-10 h-10 bg-gradient-to-br from-[var(--cane-500)] to-[var(--cane-600)] rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md">' +
                                    '<i class="fas ' + icon + ' text-white text-base"></i>' +
                                  '</div>' +
                                  '<div>' +
                                    '<h4 class="font-semibold text-[var(--cane-950)]">' + (n.title || 'Notification') + '</h4>' +
                                    '<p class="text-[var(--cane-900)]/90 text-sm font-medium">' + (n.message || '') + '</p>' +
                                  '</div>' +
                                '</div>'
                            );
                        }).join('');
                    }
                }
            } catch(_) {}

            // Feedback FAB bindings (ensure after DOM is ready)
            try {
                const fab = document.getElementById('feedbackButton');
                const label = document.getElementById('feedbackLabel');
                const modal = document.getElementById('feedbackModal');
                const dialog = document.getElementById('feedbackDialog');
                const closeBtn = document.getElementById('feedbackClose');
                const form = document.getElementById('feedbackForm');
                const message = document.getElementById('feedbackMessage');
                if (fab && modal && dialog) {
                    fab.addEventListener('mouseenter', function(){
                        if (!label) return; label.classList.remove('opacity-0', 'invisible'); label.classList.add('opacity-100', 'visible');
                    });
                    fab.addEventListener('mouseleave', function(){
                        if (!label) return; label.classList.add('opacity-0', 'invisible'); label.classList.remove('opacity-100', 'visible');
                    });
                    const open = function(){
                        modal.classList.remove('opacity-0', 'invisible'); modal.classList.add('opacity-100', 'visible');
                        dialog.classList.remove('translate-y-2', 'scale-95', 'opacity-0', 'pointer-events-none');
                        dialog.classList.add('translate-y-0', 'scale-100', 'opacity-100');
                    };
                    const close = function(){
                        modal.classList.add('opacity-0', 'invisible'); modal.classList.remove('opacity-100', 'visible');
                        dialog.classList.add('translate-y-2', 'scale-95', 'opacity-0', 'pointer-events-none');
                        dialog.classList.remove('translate-y-0', 'scale-100', 'opacity-100');
                    };
                    fab.addEventListener('click', open);
                    closeBtn && closeBtn.addEventListener('click', close);
                    modal.addEventListener('click', function(e){ if (e.target === modal) close(); });
                    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
                    if (form) {
                        form.addEventListener('submit', function(e){
                            e.preventDefault();
                            const entries = JSON.parse(localStorage.getItem('feedbackEntries') || '[]');
                            entries.push({ at: new Date().toISOString(), user: localStorage.getItem('userId') || localStorage.getItem('farmerName') || 'anonymous', message: message ? message.value : '' });
                            localStorage.setItem('feedbackEntries', JSON.stringify(entries));
                            close();
                            alert('Thanks for your feedback!');
                            try { form.reset(); } catch(_) {}
                        });
                    }
                }
            } catch(_) {}

            // Logout confirmation modal wiring
            try {
                const logoutTrigger = document.getElementById('logoutLink');
                const modal = document.getElementById('logoutModal');
                const dialog = document.getElementById('logoutDialog');
                const btnYes = document.getElementById('logoutConfirm');
                const btnNo = document.getElementById('logoutCancel');
                function openLogout(){
                    if (!modal || !dialog) return;
                    modal.classList.remove('opacity-0', 'invisible');
                    modal.classList.add('opacity-100', 'visible');
                    dialog.classList.remove('translate-y-2', 'scale-95', 'opacity-0', 'pointer-events-none');
                    dialog.classList.add('translate-y-0', 'scale-100', 'opacity-100');
                }
                function closeLogout(){
                    if (!modal || !dialog) return;
                    modal.classList.add('opacity-0', 'invisible');
                    modal.classList.remove('opacity-100', 'visible');
                    dialog.classList.add('translate-y-2', 'scale-95', 'opacity-0', 'pointer-events-none');
                    dialog.classList.remove('translate-y-0', 'scale-100', 'opacity-100');
                }
                if (logoutTrigger) {
                    logoutTrigger.addEventListener('click', function(e){ e.preventDefault(); openLogout(); });
                }
                if (modal) {
                    modal.addEventListener('click', function(e){ if (e.target === modal) closeLogout(); });
                }
                document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeLogout(); });
                if (btnNo) btnNo.addEventListener('click', function(){ closeLogout(); });
                if (btnYes) btnYes.addEventListener('click', async function(){
                    try {
                        if (window.signOut && window.auth) {
                            await window.signOut(window.auth);
                        }
                    } catch (err) {
                        console.error('Error during sign out:', err);
                    } finally {
                        // Clean up local data regardless, then redirect
                        try {
                            localStorage.removeItem('userId');
                            localStorage.removeItem('userRole');
                            localStorage.removeItem('farmerName');
                        } catch(_) {}
                        window.location.href = '../Common/farmers_login.html';
                    }
                });
            } catch(_) {}
        });

        // Initialize Swiper with enhanced functionality
        let swiper;
        try {
            const featuresEl = document.querySelector('.featuresSwiper');
            if (featuresEl && window.Swiper) {
                swiper = new Swiper('.featuresSwiper', {
                    effect: 'slide',
                    grabCursor: true,
                    centeredSlides: false,
                    slidesPerView: 'auto',
                    spaceBetween: 20,
                    loop: false,
                    slidesPerGroup: 1,
                    allowTouchMove: true,
                    watchSlidesProgress: true,
                    slidesOffsetAfter: 560,
                    slideToClickedSlide: true,
                    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
                    on: {
                        init: function() {
                            window.__caneCounter = 1;
                            window.__lastActiveIndex = this.activeIndex;
                            adjustNavLineWidth();
                            updateSlideInfo(this);
                            updateProgressLine(this);
                            updateFeaturePanel(this);
                        },
                        slideChange: function() {
                            const prev = window.__lastActiveIndex ?? this.activeIndex;
                            const delta = this.activeIndex - prev;
                            const total = this.slides.length;
                            if (delta !== 0) {
                                window.__caneCounter = Math.min(Math.max((window.__caneCounter ?? 1) + delta, 1), total);
                            }
                            window.__lastActiveIndex = this.activeIndex;
                            updateSlideInfo(this);
                            updateProgressLine(this);
                            updateBackground(this);
                            updateFeaturePanel(this);
                        }
                    }
                });
            }
        } catch (err) {
            console.error('Failed to initialize features swiper:', err);
        }

        // Update slide number and progress line
        function updateSlideInfo(swiperInstance) {
            const totalSlides = swiperInstance.slides.length;
            const currentSlide = Math.min(Math.max(window.__caneCounter ?? (swiperInstance.activeIndex + 1), 1), totalSlides);
            const slideNumber = document.getElementById('slideNumber');
            if (slideNumber) {
                slideNumber.textContent = currentSlide.toString().padStart(2, '0');
            }
        }

        // Make nav line span from start of first card to end of third card
        function adjustNavLineWidth() {
            const swiperEl = document.querySelector('.featuresSwiper');
            const navLine = document.querySelector('.nav-line');
            if (!swiperEl || !navLine) return;
            const slides = swiperEl.querySelectorAll('.swiper-slide');
            if (slides.length < 3) return;
            const firstRect = slides[0].getBoundingClientRect();
            const thirdRect = slides[2].getBoundingClientRect();
            const span = thirdRect.right - firstRect.left;
            const adjusted = Math.min(Math.max(span * 0.6, 200), 360);
            navLine.style.width = adjusted + 'px';
        }
        window.addEventListener('resize', adjustNavLineWidth);

        // Update progress line based on current slide
        function updateProgressLine(swiperInstance) {
            const progressLine = document.getElementById('progressLine');
            if (!progressLine) return;
            const track = progressLine.parentElement; // .nav-line
            if (!track) return;
            const currentSlide = swiperInstance.activeIndex + 1; // +1 because activeIndex is 0-based
            const totalSlides = swiperInstance.slides.length;
            const trackWidth = track.clientWidth; // px width of gray line
            const minPx = 16; // minimum visible yellow width
            const widthPx = Math.max((currentSlide / totalSlides) * trackWidth, minPx);
            progressLine.style.width = widthPx + 'px';
        }

        // Update description panel based on active slide
        function updateFeaturePanel(swiperInstance) {
            const active = swiperInstance.slides[swiperInstance.activeIndex];
            if (!active) return;
            const title = active.getAttribute('data-title') || 'CaneMap Features';
            const desc = active.getAttribute('data-desc') || '';
            const tags = (active.getAttribute('data-tags') || '').split(',').filter(Boolean);
            const titleElement = document.getElementById('featureTitle');
            if (titleElement) { titleElement.textContent = title; }
            const descElement = document.getElementById('featureDesc');
            if (descElement) { descElement.textContent = desc; }
            const tagsContainer = document.getElementById('featureTags');
            if (tagsContainer) {
                tagsContainer.innerHTML = '';
                tags.forEach(function(tag) {
                    const span = document.createElement('span');
                    span.className = 'px-3 py-1 bg-white/10 rounded-full text-white text-sm font-medium';
                    span.textContent = tag.trim();
                    tagsContainer.appendChild(span);
                });
            }
        }

        // Update background image with smooth transition
        function updateBackground(swiperInstance) {
            const active = swiperInstance.slides[swiperInstance.activeIndex];
            if (!active) return;
            const img = active.querySelector('img');
            if (!img) return;
            const bg = document.getElementById('featuresBg');
            const swap = document.getElementById('featuresBgSwap');
            if (!bg || !swap) return;
            swap.src = img.src;
            swap.classList.remove('opacity-0');
            swap.classList.add('opacity-30');
            setTimeout(function() {
                bg.src = swap.src;
                swap.classList.remove('opacity-30');
                swap.classList.add('opacity-0');
            }, 500);
        }

        // Smooth scroll for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Profile dropdown functionality
        const profileDropdownBtn = document.getElementById('profileDropdownBtn');
        const profileDropdown = document.getElementById('profileDropdown');
        const dropdownArrow = document.getElementById('dropdownArrow');

        if (profileDropdownBtn && profileDropdown) {
            profileDropdownBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const isVisible = profileDropdown.classList.contains('opacity-100');
                if (isVisible) {
                    profileDropdown.classList.remove('opacity-100', 'visible', 'scale-100');
                    profileDropdown.classList.add('opacity-0', 'invisible', 'scale-95');
                    if (dropdownArrow) dropdownArrow.style.transform = 'rotate(0deg)';
                } else {
                    profileDropdown.classList.remove('opacity-0', 'invisible', 'scale-95');
                    profileDropdown.classList.add('opacity-100', 'visible', 'scale-100');
                    if (dropdownArrow) dropdownArrow.style.transform = 'rotate(180deg)';
                }
            });
            document.addEventListener('click', function(e) {
                if (!profileDropdownBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                    profileDropdown.classList.remove('opacity-100', 'visible', 'scale-100');
                    profileDropdown.classList.add('opacity-0', 'invisible', 'scale-95');
                    if (dropdownArrow) dropdownArrow.style.transform = 'rotate(0deg)';
                }
            });
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    profileDropdown.classList.remove('opacity-100', 'visible', 'scale-100');
                    profileDropdown.classList.add('opacity-0', 'invisible', 'scale-95');
                    if (dropdownArrow) dropdownArrow.style.transform = 'rotate(0deg)';
                }
            });
        }

        // Scroll to top function (exported globally)
        function scrollToTop() {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollToTop = scrollToTop;
    
        // Feedback FAB interactions (fallback binding in case DOMContentLoaded missed)
        (function(){
            const fab = document.getElementById('feedbackButton');
            const label = document.getElementById('feedbackLabel');
            const modal = document.getElementById('feedbackModal');
            const dialog = document.getElementById('feedbackDialog');
            const closeBtn = document.getElementById('feedbackClose');
            const form = document.getElementById('feedbackForm');
            const message = document.getElementById('feedbackMessage');
            if (!fab || !modal || !dialog) return;
            // hover label
            fab.addEventListener('mouseenter', function(){
                label.classList.remove('opacity-0', 'invisible');
                label.classList.add('opacity-100', 'visible');
            });
            fab.addEventListener('mouseleave', function(){
                label.classList.add('opacity-0', 'invisible');
                label.classList.remove('opacity-100', 'visible');
            });
            // open
            fab.addEventListener('click', function(){
                modal.classList.remove('opacity-0', 'invisible');
                modal.classList.add('opacity-100', 'visible');
                dialog.classList.remove('translate-y-2', 'scale-95', 'opacity-0', 'pointer-events-none');
                dialog.classList.add('translate-y-0', 'scale-100', 'opacity-100');
            });
            // close helpers
            function closeModal(){
                modal.classList.add('opacity-0', 'invisible');
                modal.classList.remove('opacity-100', 'visible');
                dialog.classList.add('translate-y-2', 'scale-95', 'opacity-0', 'pointer-events-none');
                dialog.classList.remove('translate-y-0', 'scale-100', 'opacity-100');
            }
            closeBtn && closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', function(e){ if (e.target === modal) closeModal(); });
            document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeModal(); });
            // submit
            if (form) {
                form.addEventListener('submit', function(e){
                    e.preventDefault();
                    const entries = JSON.parse(localStorage.getItem('feedbackEntries') || '[]');
                    entries.push({
                        at: new Date().toISOString(),
                        user: localStorage.getItem('userId') || localStorage.getItem('farmerName') || 'anonymous',
                        message: message ? message.value : ''
                    });
                    localStorage.setItem('feedbackEntries', JSON.stringify(entries));
                    closeModal();
                    alert('Thanks for your feedback!');
                    try { form.reset(); } catch(_) {}
                });
            }
        })();
