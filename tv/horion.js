// ==========================================
    // 1. HORION VISUALS (Particles & Boot)
    // ==========================================
    const tvCanvas = document.createElement('canvas');
    tvCanvas.id = 'bg-canvas';
    const tvCtx = tvCanvas.getContext('2d');
    document.body.appendChild(tvCanvas);
    
    let tvParticles = [];
    const tvMouse = { x: null, y: null, radius: 150 };
    window.addEventListener('mousemove', (e) => { tvMouse.x = e.x; tvMouse.y = e.y; });

    class Particle {
        constructor(x, y) {
            this.x = x; this.y = y; this.baseX = x; this.baseY = y;
            this.size = 1.5; this.density = (Math.random() * 20) + 2;
        }
        draw() {
            tvCtx.fillStyle = 'rgba(0, 112, 255, 0.5)';
            tvCtx.beginPath(); tvCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2); tvCtx.fill();
        }
        update() {
            let dx = tvMouse.x - this.x; let dy = tvMouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < tvMouse.radius) {
                const force = (tvMouse.radius - distance) / tvMouse.radius;
                const directionX = (dx / distance) * force * this.density;
                const directionY = (dy / distance) * force * this.density;
                this.x -= directionX; this.y -= directionY;
            } else {
                if (this.x !== this.baseX) this.x -= (this.x - this.baseX) / 10;
                if (this.y !== this.baseY) this.y -= (this.y - this.baseY) / 10;
            }
        }
    }

    function initParticles() {
        tvCanvas.width = window.innerWidth; tvCanvas.height = window.innerHeight;
        tvParticles = [];
        for (let i = 0; i < 150; i++) {
            tvParticles.push(new Particle(Math.random() * tvCanvas.width, Math.random() * tvCanvas.height));
        }
    }

    function animateParticles() {
        tvCtx.clearRect(0, 0, tvCanvas.width, tvCanvas.height);
        for (let i = 0; i < tvParticles.length; i++) {
            tvParticles[i].draw(); tvParticles[i].update();
            for (let j = i; j < tvParticles.length; j++) {
                let dx = tvParticles[i].x - tvParticles[j].x;
                let dy = tvParticles[i].y - tvParticles[j].y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    tvCtx.strokeStyle = `rgba(0, 112, 255, ${0.5 - dist/100})`;
                    tvCtx.lineWidth = 0.5; tvCtx.beginPath();
                    tvCtx.moveTo(tvParticles[i].x, tvParticles[i].y);
                    tvCtx.lineTo(tvParticles[j].x, tvParticles[j].y); tvCtx.stroke();
                }
            }
        }
        requestAnimationFrame(animateParticles);
    }
    
    window.addEventListener('resize', initParticles);
    initParticles(); animateParticles();

    function updateTvNavbarContentOffset() {
        const nav = document.querySelector('.hud-nav');
        const isHidden = document.body.classList.contains('navbar-hidden');
        let offset = isHidden ? 40 : 125;

        if (!isHidden && nav) {
            const rect = nav.getBoundingClientRect();
            offset = Math.max(96, Math.ceil(rect.bottom + 32));
        }

        document.body.style.setProperty('--navbar-content-offset', `${offset}px`);
    }

    function setTvNavbarHidden(isHidden) {
        const shouldHide = Boolean(isHidden);
        document.body.classList.toggle('navbar-hidden', shouldHide);
        updateTvNavbarContentOffset();

        document.querySelectorAll('.nav-collapse-btn').forEach(toggle => {
            toggle.setAttribute('aria-label', shouldHide ? 'Show navbar' : 'Hide navbar');
            toggle.title = shouldHide ? 'Show navbar' : 'Hide navbar';
        });
    }

    window.addEventListener('resize', updateTvNavbarContentOffset);
    document.addEventListener('DOMContentLoaded', updateTvNavbarContentOffset);

    // Boot Sequence
    document.addEventListener('DOMContentLoaded', () => {
        const bar = document.getElementById('bootBar');
        const overlay = document.getElementById('boot-overlay');
        const initialRoute = parseRouteFromUrl();
        window.history.replaceState({ viewName: initialRoute.view, param: initialRoute.param || null }, '', buildRouteUrl(initialRoute.view, initialRoute.param));
        let width = 0;
        
        // Start preloading data in background
        initHome(); 
        
        const interval = setInterval(() => {
            if (width >= 100) {
                clearInterval(interval);
                overlay.style.opacity = '0';
                setTimeout(() => { 
                    overlay.style.visibility = 'hidden'; 
                    if (!document.querySelector('.view-section.active')) {
                        router(initialRoute.view, initialRoute.param, { replaceHistory: true });
                    }
                }, 500);
            } else {
                width += Math.random() * 10; 
                if(width > 100) width = 100;
                bar.style.width = width + '%';
            }
        }, 50);
    });


    // ==========================================
    // 2. STREAMVAULT & STATE LOGIC (TMDB Integration)
    // ==========================================
const TMDB_API_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb'; // Public demo key
    const TMDB_BASE = 'https://api.themoviedb.org/3';
    const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
    const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';
    const STREAMED_API_BASE = 'https://streamed.pk/api';

    const state = {
        currentShow: null,
        currentSeason: 1,
        currentEpisode: null,
        currentServer: 'server1', 
        trending: [],
        browseDefault: [], // Used for top 50 TMDB items
        posterFallback: 'https://via.placeholder.com/300x450/000000/0070FF?text=No+Poster',
        heroFallback: 'https://via.placeholder.com/1200x600/000000/0070FF?text=No+Image'
    };

    const sportsState = {
        initialized: false,
        catalogLoaded: false,
        feed: 'live',
        sport: 'all',
        popularOnly: false,
        sports: [],
        matches: [],
        selectedMatchId: null,
        selectedSourceValue: '',
        sourceStreamsCache: {}
    };

    const SPORTS_FALLBACK_CATALOG = [
        { id: 'american-football', name: 'American Football' },
        { id: 'football', name: 'Soccer' },
        { id: 'basketball', name: 'Basketball' },
        { id: '3x3-basketball', name: '3x3 Basketball' },
        { id: 'streetball', name: 'Streetball' },
        { id: 'baseball', name: 'Baseball' },
        { id: 'softball', name: 'Softball' },
        { id: 'lacrosse', name: 'Lacrosse' },
        { id: 'ice-hockey', name: 'Ice Hockey' },
        { id: 'hockey', name: 'Hockey' },
        { id: 'field-hockey', name: 'Field Hockey' },
        { id: 'roller-hockey', name: 'Roller Hockey' },
        { id: 'floorball', name: 'Floorball' },
        { id: 'bandy', name: 'Bandy' },
        { id: 'mma', name: 'MMA' },
        { id: 'boxing', name: 'Boxing' },
        { id: 'kickboxing', name: 'Kickboxing' },
        { id: 'muay-thai', name: 'Muay Thai' },
        { id: 'wrestling', name: 'Wrestling' },
        { id: 'judo', name: 'Judo' },
        { id: 'taekwondo', name: 'Taekwondo' },
        { id: 'karate', name: 'Karate' },
        { id: 'fencing', name: 'Fencing' },
        { id: 'sumo', name: 'Sumo' },
        { id: 'tennis', name: 'Tennis' },
        { id: 'golf', name: 'Golf' },
        { id: 'cricket', name: 'Cricket' },
        { id: 'rugby', name: 'Rugby' },
        { id: 'rugby-union', name: 'Rugby Union' },
        { id: 'rugby-league', name: 'Rugby League' },
        { id: 'motorsport', name: 'Motorsports' },
        { id: 'f1', name: 'Formula 1' },
        { id: 'nascar', name: 'NASCAR' },
        { id: 'indycar', name: 'IndyCar' },
        { id: 'motogp', name: 'MotoGP' },
        { id: 'wrc', name: 'World Rally' },
        { id: 'endurance-racing', name: 'Endurance Racing' },
        { id: 'formula-e', name: 'Formula E' },
        { id: 'supercars', name: 'Supercars' },
        { id: 'drag-racing', name: 'Drag Racing' },
        { id: 'speedway', name: 'Speedway' },
        { id: 'karting', name: 'Karting' },
        { id: 'darts', name: 'Darts' },
        { id: 'snooker', name: 'Snooker' },
        { id: 'pool', name: 'Pool' },
        { id: 'billiards', name: 'Billiards' },
        { id: 'table-tennis', name: 'Table Tennis' },
        { id: 'badminton', name: 'Badminton' },
        { id: 'squash', name: 'Squash' },
        { id: 'racquetball', name: 'Racquetball' },
        { id: 'pickleball', name: 'Pickleball' },
        { id: 'padel', name: 'Padel' },
        { id: 'handball', name: 'Handball' },
        { id: 'volleyball', name: 'Volleyball' },
        { id: 'beach-volleyball', name: 'Beach Volleyball' },
        { id: 'netball', name: 'Netball' },
        { id: 'cycling', name: 'Cycling' },
        { id: 'bmx', name: 'BMX' },
        { id: 'mountain-bike', name: 'Mountain Bike' },
        { id: 'track-cycling', name: 'Track Cycling' },
        { id: 'athletics', name: 'Athletics' },
        { id: 'marathon', name: 'Marathon' },
        { id: 'triathlon', name: 'Triathlon' },
        { id: 'duathlon', name: 'Duathlon' },
        { id: 'cross-country', name: 'Cross Country' },
        { id: 'biathlon', name: 'Biathlon' },
        { id: 'winter-sports', name: 'Winter Sports' },
        { id: 'alpine-skiing', name: 'Alpine Skiing' },
        { id: 'cross-country-skiing', name: 'Cross Country Skiing' },
        { id: 'ski-jumping', name: 'Ski Jumping' },
        { id: 'snowboarding', name: 'Snowboarding' },
        { id: 'figure-skating', name: 'Figure Skating' },
        { id: 'speed-skating', name: 'Speed Skating' },
        { id: 'curling', name: 'Curling' },
        { id: 'skeleton', name: 'Skeleton' },
        { id: 'luge', name: 'Luge' },
        { id: 'bobsleigh', name: 'Bobsleigh' },
        { id: 'water-polo', name: 'Water Polo' },
        { id: 'swimming', name: 'Swimming' },
        { id: 'diving', name: 'Diving' },
        { id: 'artistic-swimming', name: 'Artistic Swimming' },
        { id: 'sailing', name: 'Sailing' },
        { id: 'rowing', name: 'Rowing' },
        { id: 'canoe-sprint', name: 'Canoe Sprint' },
        { id: 'canoe-slalom', name: 'Canoe Slalom' },
        { id: 'surfing', name: 'Surfing' },
        { id: 'windsurfing', name: 'Windsurfing' },
        { id: 'kitesurfing', name: 'Kitesurfing' },
        { id: 'climbing', name: 'Sport Climbing' },
        { id: 'gymnastics', name: 'Gymnastics' },
        { id: 'rhythmic-gymnastics', name: 'Rhythmic Gymnastics' },
        { id: 'trampoline', name: 'Trampoline' },
        { id: 'weightlifting', name: 'Weightlifting' },
        { id: 'powerlifting', name: 'Powerlifting' },
        { id: 'strongman', name: 'Strongman' },
        { id: 'archery', name: 'Archery' },
        { id: 'shooting', name: 'Shooting' },
        { id: 'equestrian', name: 'Equestrian' },
        { id: 'horse-racing', name: 'Horse Racing' },
        { id: 'greyhound-racing', name: 'Greyhound Racing' },
        { id: 'polo', name: 'Polo' },
        { id: 'gaelic-football', name: 'Gaelic Football' },
        { id: 'hurling', name: 'Hurling' },
        { id: 'aussie-rules', name: 'Australian Rules' },
        { id: 'futsal', name: 'Futsal' },
        { id: 'beach-soccer', name: 'Beach Soccer' },
        { id: 'kabaddi', name: 'Kabaddi' },
        { id: 'baseket', name: 'Baseket' },
        { id: 'sepak-takraw', name: 'Sepak Takraw' },
        { id: 'chess', name: 'Chess' },
        { id: 'esports-fps', name: 'Esports FPS' },
        { id: 'esports-moba', name: 'Esports MOBA' },
        { id: 'esports-fighting', name: 'Esports Fighting' },
        { id: 'esports-racing', name: 'Esports Racing' },
        { id: 'esports-sports-sims', name: 'Esports Sports Sims' },
        { id: 'esports', name: 'Esports' }
    ];

    const SPORTS_QUICK_CHIP_IDS = [
        'football',
        'american-football',
        'basketball',
        'baseball',
        'mma',
        'wrestling',
        'tennis',
        'golf',
        'cricket',
        'darts',
        'motorsport'
    ];

    function normalizeTMDB(item) {
        if (item.media_type !== 'movie' && item.media_type !== 'tv') return null;
        const year = (item.release_date || item.first_air_date || '').split('-')[0] || '';
        const hasRating = typeof item.vote_average === 'number' && item.vote_average > 0;
        return {
            id: item.id,
            type: item.media_type,
            title: item.title || item.name,
            year,
            rating: hasRating ? item.vote_average.toFixed(1) : '',
            summary: item.overview,
            poster: item.poster_path ? `${IMG_BASE}${item.poster_path}` : state.posterFallback,
            backdrop: item.backdrop_path ? `${IMG_ORIGINAL}${item.backdrop_path}` : state.heroFallback
        };
    }

    // --- Utility Method to Randomize Arrays ---
    function shuffleList(array) {
        const shuffled = [...array]; 
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    const ShowService = {
        fetchHomeData: async () => {
            const myFeaturedList = [
    // --- Your Original List ---
    { id: 1434, type: 'tv' },       // Family Guy
    { id: 66732, type: 'tv' },      // Stranger Things
    { id: 1396, type: 'tv' },       // Breaking Bad
    { id: 97546, type: 'tv' },      // Ted Lasso
    { id: 507089, type: 'movie' },  // Five Nights at Freddy's
    { id: 1405, type: 'tv' },       // Dexter
    { id: 95557, type: 'tv' },      // Invincible
    { id: 2604, type: 'tv' },       // The Boondocks

    { id: 1408, type: 'tv' },       // House M.D.
    { id: 1402, type: 'tv' },       // The Walking Dead
    { id: 245927, type: 'tv' },     // Paradise
    { id: 1317288, type: 'movie' }, // Marty Supreme

    { id: 100088, type: 'tv' },     // The Last of Us
    { id: 76479, type: 'tv' },      // The Boys
    { id: 60059, type: 'tv' },      // Better Call Saul
    { id: 106379, type: 'tv' },     // Fallout
    { id: 105248, type: 'tv' },     // Cyberpunk: Edgerunners

    { id: 60625, type: 'tv' },      // Rick and Morty
    { id: 1100, type: 'tv' },       // How I Met Your Mother

    { id: 71694, type: 'tv' },      // Snowfall
    { id: 63174, type: 'tv' },      // Lucifer
    { id: 198178, type: 'tv' },     // Wonder Man
    { id: 250307, type: 'tv' },     // The Pitt
    { id: 687163, type: 'movie' },  // Project Hail Mary
    { id: 124364, type: 'tv' },     // FROM

    // --- New Additions ---
{ id: 93405, type: 'tv' },        // Squid Game
{ id: 119051, type: 'tv' },       // Wednesday
{ id: 246, type: 'tv' },          // Avatar: The Last Airbender (Animated)
{ id: 1339713, type: 'movie' },   // Obsession (2026)
{ id: 1083381, type: 'movie' },   // Backrooms (2026)
{ id: 604079, type: 'movie' },   // The Long Walk (2025)

];
            // 1. Randomize the list
            const randomizedList = shuffleList(myFeaturedList);
            
            // 2. Create an array of pending promises
            const fetchPromises = randomizedList.map(item => 
                ShowService.getDetails(item.id, item.type)
            );
            
            // 3. Wait for all of them to finish at the same time
            const results = await Promise.all(fetchPromises);
            
            return results;
        },

        fetchTopContent: async () => {
            const promises = [1, 2, 3].map(page => 
                fetch(`${TMDB_BASE}/trending/all/week?api_key=${TMDB_API_KEY}&page=${page}`).then(r=>r.json())
            );
            const results = await Promise.all(promises);
            const combined = results.flatMap(res => res.results);
            
            return combined.map(normalizeTMDB).filter(i => i !== null).slice(0, 50);
        },

        searchShows: async (query) => {
            if(!query) return [];
            const res = await fetch(`${TMDB_BASE}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`);
            const data = await res.json();
            return data.results
                .filter(item => item.adult !== true)
                .map(normalizeTMDB)
                .filter(i => i !== null);
        },
        getDetails: async (id, type) => {
            const res = await fetch(`${TMDB_BASE}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`);
            const data = await res.json();
            const year = (data.release_date || data.first_air_date || '').split('-')[0] || '';
            const hasRating = typeof data.vote_average === 'number' && data.vote_average > 0;
            
            const normalized = {
                id: data.id,
                type: type,
                imdbId: data.external_ids?.imdb_id || null,
                tmdbId: data.id,
                title: data.title || data.name,
                rating: hasRating ? data.vote_average.toFixed(1) : '',
                year,
                description: data.overview || 'No description available.',
                poster: data.poster_path ? `${IMG_BASE}${data.poster_path}` : state.posterFallback,
                backdrop: data.backdrop_path ? `${IMG_ORIGINAL}${data.backdrop_path}` : state.heroFallback,
                totalSeasons: data.number_of_seasons || 1,
                episodes: {}
            };
            return normalized;
        },
        getSeasonEpisodes: async (tvId, seasonNumber) => {
            const res = await fetch(`${TMDB_BASE}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`);
            const data = await res.json();
            if (!data.episodes) return [];
            return data.episodes.map(ep => ({
                number: ep.episode_number,
                title: ep.name,
                overview: ep.overview,
                image: ep.still_path ? `${IMG_BASE}${ep.still_path}` : null
            }));
        }
    };
    // ==========================================
    // 3. LOCAL STORAGE SAVE LOGIC
    // ==========================================
    
    window.addEventListener('beforeunload', saveProgress);

    function saveProgress() {
        if (!state.currentShow) return;
        if (state.currentShow.type === 'tv' && !state.currentEpisode) return;

        try {
            const cw = JSON.parse(localStorage.getItem('horion_cw') || '[]');
            const record = {
                id: state.currentShow.id,
                type: state.currentShow.type,
                title: state.currentShow.title,
                poster: state.currentShow.poster,
                season: state.currentShow.type === 'tv' ? state.currentSeason : null,
                episodeNumber: state.currentShow.type === 'tv' ? state.currentEpisode.number : null,
                timestamp: Date.now()
            };

            const filtered = cw.filter(item => item.id !== record.id);
            filtered.unshift(record);
            if (filtered.length > 20) filtered.pop();

            localStorage.setItem('horion_cw', JSON.stringify(filtered));
        } catch (e) {
            console.warn("Local storage save failed.", e);
        }
    }

    function getContinueWatching() {
        try {
            return JSON.parse(localStorage.getItem('horion_cw') || '[]');
        } catch (e) {
            return [];
        }
    }

    function parseRouteFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const requestedView = (params.get('view') || 'home').toLowerCase();
        const allowedViews = ['home', 'browse', 'continue', 'youtube', 'sports', 'details'];
        const view = allowedViews.includes(requestedView) ? requestedView : 'home';

        if (view !== 'details') {
            return { view, param: null };
        }

        const id = Number(params.get('id'));
        const typeRaw = (params.get('type') || '').toLowerCase();
        const type = typeRaw === 'movie' || typeRaw === 'tv' ? typeRaw : '';

        if (!Number.isFinite(id) || !type) {
            return { view: 'home', param: null };
        }

        const season = Number(params.get('season'));
        const epNumber = Number(params.get('ep'));

        return {
            view: 'details',
            param: {
                id,
                type,
                season: Number.isFinite(season) && season > 0 ? season : undefined,
                epNumber: Number.isFinite(epNumber) && epNumber > 0 ? epNumber : undefined
            }
        };
    }

    function buildRouteUrl(viewName, param) {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        const safeView = String(viewName || 'home').toLowerCase();

        params.set('view', safeView);
        params.delete('id');
        params.delete('type');
        params.delete('season');
        params.delete('ep');

        if (safeView === 'details' && param) {
            if (Number.isFinite(Number(param.id))) params.set('id', String(param.id));
            if (param.type === 'movie' || param.type === 'tv') params.set('type', String(param.type));
            if (Number.isFinite(Number(param.season)) && Number(param.season) > 0) params.set('season', String(param.season));
            if (Number.isFinite(Number(param.epNumber)) && Number(param.epNumber) > 0) params.set('ep', String(param.epNumber));
        }

        return `${url.pathname}?${params.toString()}${url.hash}`;
    }

    function syncRouteUrl(viewName, param, replace) {
        const nextUrl = buildRouteUrl(viewName, param);
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

        if (nextUrl === currentUrl) return;

        if (replace) {
            window.history.replaceState({ viewName, param: param || null }, '', nextUrl);
        } else {
            window.history.pushState({ viewName, param: param || null }, '', nextUrl);
        }
    }

    function syncCurrentDetailsUrl(replace) {
        if (!state.currentShow) return;

        const param = {
            id: state.currentShow.id,
            type: state.currentShow.type,
            season: state.currentShow.type === 'tv' ? state.currentSeason : undefined,
            epNumber: state.currentShow.type === 'tv' && state.currentEpisode ? state.currentEpisode.number : undefined
        };

        syncRouteUrl('details', param, Boolean(replace));
    }

    function isCurrentDetailsSelection(param) {
        if (!state.currentShow || !param) return false;

        const sameId = Number(state.currentShow.id) === Number(param.id);
        const sameType = String(state.currentShow.type || '') === String(param.type || '');
        if (!sameId || !sameType) return false;

        if (sameType !== 'tv') return true;

        const requestedSeason = Number(param.season);
        const requestedEpisode = Number(param.epNumber);
        const safeSeason = Number.isFinite(requestedSeason) && requestedSeason > 0 ? requestedSeason : 1;
        const safeEpisode = Number.isFinite(requestedEpisode) && requestedEpisode > 0 ? requestedEpisode : null;
        const currentEpisodeNumber = state.currentEpisode ? Number(state.currentEpisode.number) : null;

        if (state.currentSeason !== safeSeason) return false;
        if (safeEpisode && currentEpisodeNumber !== safeEpisode) return false;
        return true;
    }

    // ==========================================
    // 4. CONTROLLER & ROUTER
    // ==========================================
    
    function router(viewName, param, options) {
        const routeOptions = options || {};
        const fromPopState = Boolean(routeOptions.fromPopState);
        const replaceHistory = Boolean(routeOptions.replaceHistory);
        const activeView = document.querySelector('.view-section.active');
        const activeViewName = activeView ? activeView.id.replace('view-', '') : '';

        const inlinePage = document.getElementById('horion-tv-inline-page');
        if (inlinePage) inlinePage.remove();

        if (activeViewName === 'details' && viewName !== 'details' && state.currentShow) {
            saveProgress();
        }

        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        
        const target = document.getElementById(`view-${viewName}`);
        if(target) target.classList.add('active');

        const navBtn = document.getElementById(`nav-${viewName}`);
        if(navBtn) navBtn.classList.add('active');

        if (viewName !== 'details' && viewName !== 'sports' && viewName !== 'youtube') {
            pauseActiveTvMedia();
        }

        window.scrollTo(0,0);

        if(viewName === 'home') {
            if(state.trending.length === 0) initHome();
        } else if(viewName === 'browse') {
            document.getElementById('browse-search').focus();
            const grid = document.getElementById('browse-grid');
            
            // Generate Top 50 default list instead of featured list
            if(state.browseDefault.length === 0) {
                grid.innerHTML = '<div style="color:var(--neon-blue); font-family:\'JetBrains Mono\'; grid-column: 1/-1;">LOADING TOP 50 DATABASE...</div>';
                ShowService.fetchTopContent().then(results => {
                    state.browseDefault = results;
                    if(document.getElementById('browse-search').value.trim() === '') {
                        renderGrid(state.browseDefault, 'browse-grid');
                    }
                });
            } else if (document.getElementById('browse-search').value.trim() === '') {
                renderGrid(state.browseDefault, 'browse-grid');
            }
            
        } else if(viewName === 'continue') {
            renderContinueWatching();
        } else if(viewName === 'youtube') {
            initYoutubeView();
        } else if(viewName === 'sports') {
            initSportsView();
        } else if(viewName === 'details' && param) {
            if (isCurrentDetailsSelection(param)) {
                syncCurrentDetailsUrl(true);
            } else {
                loadMedia(param);
            }
        }

        const viewTitleMap = {
            home: 'Horion TV',
            browse: 'Horion TV - Browse',
            continue: 'Horion TV - Continue Watching',
            youtube: 'YouTube - Horion TV',
            sports: 'Live Sports - Horion TV',
            details: 'Horion TV'
        };
        if (viewName !== 'details') {
            document.title = viewTitleMap[viewName] || 'Horion TV';
        }

        try {
            if (window.parent && window.parent !== window && typeof window.parent.onTvViewChange === 'function') {
                window.parent.onTvViewChange(viewName, param || null);
            }
        } catch (err) {
            // Ignore parent messaging errors.
        }

        if (!fromPopState) {
            syncRouteUrl(viewName, param || null, replaceHistory);
        }
    }

    function setTvTaskbarHighlight(buttonId) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const targetBtn = document.getElementById(buttonId);
        if (targetBtn) targetBtn.classList.add('active');
    }

    function setFrameToAboutBlank(frameId) {
        const frame = document.getElementById(frameId);
        if (frame) frame.src = 'about:blank';
    }

    function extractYoutubeVideoId(value) {
        const trimmed = String(value || '').trim();
        if (!trimmed) return '';
        if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
        try {
            const parsed = new URL(trimmed);
            const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
            if (host === 'youtu.be') {
                const idFromPath = parsed.pathname.split('/').filter(Boolean)[0] || '';
                return /^[a-zA-Z0-9_-]{11}$/.test(idFromPath) ? idFromPath : '';
            }
            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
                const watchId = parsed.searchParams.get('v') || '';
                if (/^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;
                const pathBits = parsed.pathname.split('/').filter(Boolean);
                const embedIndex = pathBits.indexOf('embed');
                if (embedIndex !== -1 && pathBits[embedIndex + 1]) {
                    const embeddedId = pathBits[embedIndex + 1];
                    return /^[a-zA-Z0-9_-]{11}$/.test(embeddedId) ? embeddedId : '';
                }
            }
        } catch (error) {
            // Treat malformed URLs as plain IDs below.
        }
        const maybeId = trimmed.match(/[a-zA-Z0-9_-]{11}/);
        return maybeId ? maybeId[0] : trimmed;
    }

    function buildYoutubeSearchUrl(value) {
        return extractYoutubeVideoId(value);
    }

    function renderYoutubeFrame(targetUrl) {
        const frame = document.getElementById('youtube-frame');
        if (!frame) return;
        const videoId = extractYoutubeVideoId(targetUrl);
        if (!videoId) {
            frame.src = 'about:blank';
            return;
        }
        const embedUrl = `https://invidious.tiekoetter.com/embed/${encodeURIComponent(videoId)}`;
        const escaped = embedUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        frame.srcdoc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><base target="_self"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}iframe{border:0;width:100%;height:100%;display:block;background:#000}</style></head><body><iframe src="' + escaped + '" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>';
    }

    function initYoutubeView() {
        const form = document.getElementById('youtube-search-form');
        const input = document.getElementById('youtube-search-input');
        if (input && !input.placeholder) {
            input.placeholder = 'Enter YouTube video ID or link';
        }
        if (form && !form.dataset.bound) {
            form.dataset.bound = '1';
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                renderYoutubeFrame(buildYoutubeSearchUrl(input ? input.value : ''));
            });
        }
        renderYoutubeFrame(buildYoutubeSearchUrl(input ? input.value : ''));
    }

    function pauseActiveTvMedia() {
        setFrameToAboutBlank('video-player');
        setFrameToAboutBlank('sports-stream-frame');
        setFrameToAboutBlank('youtube-frame');
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            pauseActiveTvMedia();
        }
    });

    function setSportsStatus(message, isError) {
        const statusEl = document.getElementById('sports-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.classList.toggle('error', Boolean(isError));
    }

    function setSportsPlayerStatus(message) {
        const statusEl = document.getElementById('sports-player-status');
        if (!statusEl) return;
        statusEl.textContent = message || '';
    }

    async function fetchSportsJson(url) {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('HTTP ' + response.status);
        }
        return response.json();
    }

    function getSportsMatchesEndpoint(scopeOverride) {
        const scope = String(scopeOverride || (sportsState.sport !== 'all' ? sportsState.sport : sportsState.feed));
        let endpoint = `${STREAMED_API_BASE}/matches/${encodeURIComponent(scope)}`;
        if (sportsState.popularOnly) endpoint += '/popular';
        return endpoint;
    }

    function getSportsStreamEndpoint(sourceName, sourceId) {
        return `${STREAMED_API_BASE}/stream/${encodeURIComponent(String(sourceName || '').trim())}/${encodeURIComponent(String(sourceId || '').trim())}`;
    }

    function buildSportsStreamFallbacks(sourceName, sourceId) {
        const safeSource = String(sourceName || '').trim();
        const safeId = String(sourceId || '').trim();
        if (!safeSource || !safeId) return [];

        return [1, 2, 3, 4].map(function (streamNo) {
            return {
                id: safeId,
                streamNo: streamNo,
                language: 'Auto',
                hd: true,
                embedUrl: `https://embedsports.top/embed/${encodeURIComponent(safeSource)}/${encodeURIComponent(safeId)}/${streamNo}`,
                source: safeSource,
                viewers: 0
            };
        });
    }

    function sanitizeSportsCatalogEntry(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const rawId = String(entry.id || '').trim();
        if (!rawId) return null;
        const fallbackName = rawId === 'football' ? 'Soccer' : rawId;
        const rawName = String(entry.name || fallbackName).trim() || fallbackName;
        const normalizedName = rawId === 'football' ? 'Soccer' : rawName;
        return {
            id: rawId,
            name: normalizedName
        };
    }

    function getMergedSportsCatalog(remoteSports) {
        const mergedById = new Map();
        const pushEntry = function (entry) {
            const normalized = sanitizeSportsCatalogEntry(entry);
            if (!normalized) return;
            if (!mergedById.has(normalized.id)) {
                mergedById.set(normalized.id, normalized);
            }
        };

        (Array.isArray(remoteSports) ? remoteSports : []).forEach(pushEntry);
        SPORTS_FALLBACK_CATALOG.forEach(pushEntry);
        return Array.from(mergedById.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    function getSportLabelById(sportId) {
        if (!sportId || sportId === 'all') return 'All Sports';
        const found = sportsState.sports.find((entry) => entry.id === sportId);
        return found ? found.name : sportId;
    }

    function getBadgeUrl(badgeId) {
        if (!badgeId) return '';
        return `${STREAMED_API_BASE}/images/badge/${encodeURIComponent(badgeId)}.webp`;
    }

    function getSportsPosterUrl(match) {
        const posterValue = String(match && match.poster ? match.poster : '').trim();
        if (posterValue) {
            if (/^https?:\/\//i.test(posterValue)) return posterValue;

            if (posterValue.startsWith('/api/')) {
                return `https://streamed.pk${posterValue}${posterValue.endsWith('.webp') ? '' : '.webp'}`;
            }

            if (posterValue.startsWith('/')) {
                return `https://streamed.pk${posterValue}${posterValue.endsWith('.webp') ? '' : '.webp'}`;
            }

            return `${STREAMED_API_BASE}/images/proxy/${encodeURIComponent(posterValue)}.webp`;
        }

        const homeBadge = match && match.teams && match.teams.home ? match.teams.home.badge : '';
        const awayBadge = match && match.teams && match.teams.away ? match.teams.away.badge : '';
        if (homeBadge && awayBadge) {
            return `${STREAMED_API_BASE}/images/poster/${encodeURIComponent(homeBadge)}/${encodeURIComponent(awayBadge)}.webp`;
        }

        return '';
    }

    function slugifySportsText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-');
    }

    function buildEmbedSportsMatchUrl(match, streamNumber) {
        const homeName = slugifySportsText(match?.teams?.home?.name || '');
        const awayName = slugifySportsText(match?.teams?.away?.name || '');
        const fallbackTitle = slugifySportsText(match?.title || 'live-match');
        const matchupSlug = homeName && awayName ? `ppv-${homeName}-vs-${awayName}` : `ppv-${fallbackTitle}`;
        const safeNumber = Number.isFinite(Number(streamNumber)) && Number(streamNumber) > 0 ? Number(streamNumber) : 1;
        return `https://embedsports.top/embed/admin/${matchupSlug}/${safeNumber}`;
    }

    function escapeHtmlAttribute(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function buildLockedEmbedSrcDoc(targetUrl, options) {
        const safeUrl = escapeHtmlAttribute(targetUrl);
        const opts = options || {};
        const sandboxAttr = opts.disableInnerSandbox
            ? ''
            : ' sandbox="allow-same-origin allow-scripts allow-forms allow-presentation allow-pointer-lock"';
        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><base target="_self"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}iframe{border:0;width:100%;height:100%;display:block;background:#000}</style></head><body><iframe src="' + safeUrl + '"' + sandboxAttr + ' allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><script>(function(){const frame=document.querySelector("iframe");if(!frame){return;}const enforceSelf=function(){try{const win=frame.contentWindow;if(!win){return;}win.open=function(url){if(url){win.location.assign(url);}return win;};}catch(err){}};frame.addEventListener("load",enforceSelf);enforceSelf();})();<\/script></body></html>';
    }

    function setLockedEmbedFrame(frame, targetUrl, options) {
        if (!frame) return;
        const opts = options || {};

        if (opts.disableOuterSandbox) {
            frame.removeAttribute('sandbox');
        } else {
            frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        }

        const normalizedUrl = String(targetUrl || '').trim();
        if (!normalizedUrl) {
            frame.removeAttribute('srcdoc');
            frame.src = 'about:blank';
            return;
        }

        frame.src = 'about:blank';
        frame.srcdoc = buildLockedEmbedSrcDoc(normalizedUrl, opts);
    }

    async function fetchEmbedHtmlWithFallback(targetUrl) {
        const safeTarget = String(targetUrl || '').trim();
        if (!safeTarget) throw new Error('Missing embed URL');

        const attempts = [
            safeTarget,
            'https://api.allorigins.win/raw?url=' + encodeURIComponent(safeTarget),
            'https://api.allorigins.win/get?url=' + encodeURIComponent(safeTarget),
            'https://corsproxy.io/?' + encodeURIComponent(safeTarget),
            'https://r.jina.ai/http://' + safeTarget.replace(/^https?:\/\//i, '')
        ];

        let lastError = null;
        for (const attemptUrl of attempts) {
            try {
                const response = await fetch(attemptUrl, { cache: 'no-store' });
                if (!response.ok) {
                    lastError = new Error('HTTP ' + response.status + ' for ' + attemptUrl);
                    continue;
                }

                let text = await response.text();
                if (attemptUrl.includes('api.allorigins.win/get?url=')) {
                    try {
                        const parsed = JSON.parse(text);
                        text = typeof parsed.contents === 'string' ? parsed.contents : '';
                    } catch (error) {
                        text = '';
                    }
                }

                if (typeof text === 'string' && /<html|<body|<script|<iframe/i.test(text)) {
                    return text;
                }

                lastError = new Error('Unexpected response body for ' + attemptUrl);
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('Unable to fetch embed HTML');
    }

    function setSportsNoSandboxNoNewTabsFrame(frame, targetUrl, fallbackUrl) {
        if (!frame) return;
        const normalizedUrl = String(targetUrl || '').trim();

        frame.removeAttribute('sandbox');

        if (!normalizedUrl) {
            frame.removeAttribute('srcdoc');
            frame.src = 'about:blank';
            return;
        }

        frame.src = 'about:blank';
    const primaryAttr = escapeHtmlAttribute(normalizedUrl);
    frame.srcdoc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><base target="_self"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}iframe{border:0;width:100%;height:100%;display:block;background:#000}</style></head><body><iframe src="' + primaryAttr + '" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>';
    }

    function formatMatchTime(timestamp) {
        const value = Number(timestamp);
        if (!Number.isFinite(value)) return 'Time unavailable';
        return new Date(value).toLocaleString();
    }

    function renderSportsCatalog() {
        const select = document.getElementById('sports-category-select');
        if (!select) return;

        select.innerHTML = '<option value="all">ALL SPORTS</option>';
        sportsState.sports.forEach((sport) => {
            const option = document.createElement('option');
            option.value = sport.id;
            option.textContent = sport.name || sport.id;
            if (sport.id === sportsState.sport) option.selected = true;
            select.appendChild(option);
        });

        renderSportsQuickChips();
    }

    function renderSportsQuickChips() {
        const host = document.getElementById('sports-quick-chips');
        if (!host) return;

        host.innerHTML = '';
        const byId = new Map(sportsState.sports.map((sport) => [sport.id, sport]));
        const selectedSport = String(sportsState.sport || 'all');

        const quickSports = SPORTS_QUICK_CHIP_IDS
            .map((id) => byId.get(id))
            .filter(Boolean);

        if (selectedSport !== 'all' && byId.has(selectedSport) && !quickSports.some((sport) => sport.id === selectedSport)) {
            quickSports.unshift(byId.get(selectedSport));
        }

        const allChip = document.createElement('button');
        allChip.type = 'button';
        allChip.className = 'sports-chip' + (selectedSport === 'all' ? ' active' : '');
        allChip.textContent = 'ALL SPORTS';
        allChip.onclick = function () {
            onSportsCategoryChanged('all');
            const select = document.getElementById('sports-category-select');
            if (select) select.value = 'all';
        };
        host.appendChild(allChip);

        quickSports.forEach((sport) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'sports-chip' + (selectedSport === sport.id ? ' active' : '');
            chip.textContent = String(sport.name || sport.id).toUpperCase();
            chip.onclick = function () {
                onSportsCategoryChanged(sport.id);
                const select = document.getElementById('sports-category-select');
                if (select) select.value = sport.id;
            };
            host.appendChild(chip);
        });
    }

    function renderSportsMatches() {
        const container = document.getElementById('sports-matches-grid');
        if (!container) return;

        container.innerHTML = '';
        if (!sportsState.matches.length) {
            const empty = document.createElement('div');
            empty.className = 'sports-status';
            empty.textContent = 'No matches found for this filter.';
            container.appendChild(empty);
            return;
        }

        sportsState.matches.forEach((match) => {
            const card = document.createElement('div');
            card.className = 'sports-match-card' + (sportsState.selectedMatchId === match.id ? ' active' : '');
            card.onclick = () => selectSportsMatch(match.id);

            const bannerWrap = document.createElement('div');
            bannerWrap.className = 'sports-match-banner';
            const bannerImage = document.createElement('img');
            bannerImage.src = getSportsPosterUrl(match);
            bannerImage.alt = match.title || 'Match banner';
            bannerImage.loading = 'lazy';
            bannerImage.referrerPolicy = 'no-referrer';
            bannerImage.onerror = () => {
                bannerWrap.style.display = 'none';
            };
            bannerWrap.appendChild(bannerImage);
            card.appendChild(bannerWrap);

            const title = document.createElement('div');
            title.className = 'sports-match-title';
            title.textContent = match.title || 'Untitled Match';
            card.appendChild(title);

            const matchup = document.createElement('div');
            matchup.className = 'sports-matchup';
            const homeNameText = match?.teams?.home?.name || 'Home';
            const awayNameText = match?.teams?.away?.name || 'Away';
            matchup.textContent = `${homeNameText} vs ${awayNameText}`;
            card.appendChild(matchup);

            const meta = document.createElement('div');
            meta.className = 'sports-match-meta';
            meta.textContent = `${String(match.category || '').toUpperCase()} | ${formatMatchTime(match.date)}`;
            card.appendChild(meta);

            const teamsRow = document.createElement('div');
            teamsRow.className = 'sports-teams-row';

            const homeTeam = document.createElement('div');
            homeTeam.className = 'sports-team';
            const homeBadge = document.createElement('img');
            homeBadge.src = getBadgeUrl(match?.teams?.home?.badge) || '';
            homeBadge.alt = match?.teams?.home?.name || 'Home';
            homeBadge.loading = 'lazy';
            homeBadge.referrerPolicy = 'no-referrer';
            homeBadge.onerror = () => { homeBadge.style.visibility = 'hidden'; };
            const homeName = document.createElement('span');
            homeName.className = 'sports-team-name';
            homeName.textContent = match?.teams?.home?.name || 'Home';
            homeTeam.appendChild(homeBadge);
            homeTeam.appendChild(homeName);

            const awayTeam = document.createElement('div');
            awayTeam.className = 'sports-team';
            const awayBadge = document.createElement('img');
            awayBadge.src = getBadgeUrl(match?.teams?.away?.badge) || '';
            awayBadge.alt = match?.teams?.away?.name || 'Away';
            awayBadge.loading = 'lazy';
            awayBadge.referrerPolicy = 'no-referrer';
            awayBadge.onerror = () => { awayBadge.style.visibility = 'hidden'; };
            const awayName = document.createElement('span');
            awayName.className = 'sports-team-name';
            awayName.textContent = match?.teams?.away?.name || 'Away';
            awayTeam.appendChild(awayBadge);
            awayTeam.appendChild(awayName);

            const vs = document.createElement('span');
            vs.className = 'sports-match-meta';
            vs.style.margin = '0 4px';
            vs.textContent = 'VS';

            teamsRow.appendChild(homeTeam);
            teamsRow.appendChild(vs);
            teamsRow.appendChild(awayTeam);
            card.appendChild(teamsRow);

            container.appendChild(card);
        });
    }

    function resetSportsPlayer() {
        sportsState.selectedSourceValue = '';
        const sourceSelect = document.getElementById('sports-source-select');
        const streamSelect = document.getElementById('sports-stream-select');
        const frame = document.getElementById('sports-stream-frame');

        if (sourceSelect) {
            sourceSelect.innerHTML = '<option value="">SELECT SOURCE</option>';
            sourceSelect.disabled = true;
        }

        if (streamSelect) {
            streamSelect.innerHTML = '<option value="">SELECT STREAM</option>';
            streamSelect.disabled = true;
        }

        if (frame) {
            frame.src = 'about:blank';
        }

        setSportsPlayerStatus('Choose a match to load stream sources.');
    }

    async function refreshSportsMatches() {
        setSportsStatus('Loading matches...', false);
        resetSportsPlayer();

        try {
            const endpoint = getSportsMatchesEndpoint();
            const matches = await fetchSportsJson(endpoint);
            sportsState.matches = Array.isArray(matches) ? matches : [];
            sportsState.selectedMatchId = null;
            renderSportsMatches();
            setSportsStatus(`Loaded ${sportsState.matches.length} matches.`, false);
        } catch (error) {
            if (sportsState.sport !== 'all') {
                try {
                    const fallbackEndpoint = getSportsMatchesEndpoint(sportsState.feed);
                    const fallbackMatches = await fetchSportsJson(fallbackEndpoint);
                    sportsState.matches = Array.isArray(fallbackMatches) ? fallbackMatches : [];
                    sportsState.selectedMatchId = null;
                    renderSportsMatches();
                    setSportsStatus(`${getSportLabelById(sportsState.sport)} currently unavailable. Showing ${String(sportsState.feed).toUpperCase()} feed with ${sportsState.matches.length} matches.`, false);
                    return;
                } catch (fallbackError) {
                    console.error('Sports fallback load failed:', fallbackError);
                }
            }

            sportsState.matches = [];
            renderSportsMatches();
            setSportsStatus('Failed to load sports matches. Try again.', true);
            console.error('Sports match load failed:', error);
        }
    }

    async function selectSportsMatch(matchId) {
        sportsState.selectedMatchId = String(matchId || '');
        renderSportsMatches();

        const selectedMatch = sportsState.matches.find((m) => String(m.id) === sportsState.selectedMatchId);
        if (!selectedMatch || !Array.isArray(selectedMatch.sources) || !selectedMatch.sources.length) {
            resetSportsPlayer();
            setSportsPlayerStatus('No stream sources available for this match.');
            return;
        }

        const sourceSelect = document.getElementById('sports-source-select');
        if (!sourceSelect) return;

        sourceSelect.innerHTML = '';
        selectedMatch.sources.forEach((entry) => {
            const option = document.createElement('option');
            const value = `${entry.source}::${entry.id}`;
            option.value = value;
            option.textContent = `${String(entry.source || '').toUpperCase()} | ${entry.id}`;
            sourceSelect.appendChild(option);
        });

        sourceSelect.disabled = false;
        const firstSource = selectedMatch.sources[0];
        const sourceValue = `${firstSource.source}::${firstSource.id}`;
        sourceSelect.value = sourceValue;
        await onSportsSourceChanged(sourceValue);
    }

    async function onSportsSourceChanged(value) {
        const streamSelect = document.getElementById('sports-stream-select');
        if (!streamSelect) return;

        const safeValue = String(value || '');
        if (!safeValue.includes('::')) {
            streamSelect.innerHTML = '<option value="">SELECT STREAM</option>';
            streamSelect.disabled = true;
            return;
        }

        sportsState.selectedSourceValue = safeValue;
        const parts = safeValue.split('::');
        const sourceName = parts[0];
        const sourceId = parts.slice(1).join('::');
        const cacheKey = `${sourceName}::${sourceId}`;
        let streams = sportsState.sourceStreamsCache[cacheKey];

        setSportsPlayerStatus('Loading stream list...');
        if (!Array.isArray(streams)) {
            try {
                streams = await fetchSportsJson(getSportsStreamEndpoint(sourceName, sourceId));
                streams = Array.isArray(streams) ? streams : [];
            } catch (error) {
                streams = [];
                console.error('Sports stream load failed:', error);
            }

            if (!streams.length) {
                streams = buildSportsStreamFallbacks(sourceName, sourceId);
            }

            sportsState.sourceStreamsCache[cacheKey] = streams;
        }

        streamSelect.innerHTML = '';
        if (!streams.length) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'NO STREAMS FOUND';
            streamSelect.appendChild(option);
            streamSelect.disabled = true;
            setSportsPlayerStatus('No streams found for this source. Try another source.');
            return;
        }

        streams.forEach((stream, idx) => {
            const option = document.createElement('option');
            option.value = String(idx);
            const lang = stream.language || 'Unknown';
            const quality = stream.hd ? 'HD' : 'SD';
            const number = Number.isFinite(Number(stream.streamNo)) ? stream.streamNo : (idx + 1);
            option.textContent = `#${number} | ${lang} | ${quality}`;
            streamSelect.appendChild(option);
        });

        streamSelect.disabled = false;
        streamSelect.value = '0';
        onSportsStreamChanged('0');
    }

    function onSportsStreamChanged(indexValue) {
        const safeSource = String(sportsState.selectedSourceValue || '');
        if (!safeSource.includes('::')) return;

        const parts = safeSource.split('::');
        const sourceName = parts[0];
        const sourceId = parts.slice(1).join('::');
        const cacheKey = `${sourceName}::${sourceId}`;
        const streams = sportsState.sourceStreamsCache[cacheKey] || [];
        const selectedIndex = Number(indexValue);
        const selectedStream = streams[selectedIndex];
        const selectedMatch = sportsState.matches.find((m) => String(m.id) === String(sportsState.selectedMatchId));

        if (!selectedStream || !selectedStream.embedUrl) {
            setSportsPlayerStatus('Selected stream is unavailable.');
            return;
        }

        const launchUrl = selectedStream.embedUrl;

        const frame = document.getElementById('sports-stream-frame');
        if (frame) {
            setSportsNoSandboxNoNewTabsFrame(frame, launchUrl);
        }

        setSportsPlayerStatus(`Now playing: ${selectedStream.language || 'Unknown'} ${selectedStream.hd ? 'HD' : 'SD'} (${sourceName.toUpperCase()})`);
    }

    function onSportsFeedChanged(value) {
        sportsState.feed = String(value || 'live');
        refreshSportsMatches();
    }

    function onSportsCategoryChanged(value) {
        sportsState.sport = String(value || 'all');
        renderSportsQuickChips();
        refreshSportsMatches();
    }

    function toggleSportsPopular() {
        sportsState.popularOnly = !sportsState.popularOnly;
        const btn = document.getElementById('sports-popular-btn');
        if (btn) {
            btn.textContent = `POPULAR: ${sportsState.popularOnly ? 'ON' : 'OFF'}`;
            btn.classList.toggle('active', sportsState.popularOnly);
        }
        refreshSportsMatches();
    }

    async function initSportsView() {
        if (!sportsState.initialized) {
            const feedSelect = document.getElementById('sports-feed-select');
            const categorySelect = document.getElementById('sports-category-select');
            if (feedSelect) feedSelect.value = sportsState.feed;
            if (categorySelect) categorySelect.value = sportsState.sport;
            sportsState.initialized = true;
        }

        if (!sportsState.catalogLoaded) {
            try {
                const sports = await fetchSportsJson(`${STREAMED_API_BASE}/sports`);
                sportsState.sports = getMergedSportsCatalog(sports);
                sportsState.catalogLoaded = true;
            } catch (error) {
                sportsState.sports = getMergedSportsCatalog([]);
                sportsState.catalogLoaded = true;
                setSportsStatus('Sports catalog unavailable. Loaded local expanded catalog instead.', true);
                console.error('Sports catalog load failed:', error);
            }
            renderSportsCatalog();
        }

        if (!sportsState.matches.length) {
            await refreshSportsMatches();
        } else {
            renderSportsMatches();
            setSportsStatus(`Loaded ${sportsState.matches.length} matches.`, false);
        }
    }

    async function initHome() {
        try {
            const shows = await ShowService.fetchHomeData();
            state.trending = shows;
            renderHero(shows[0]);
            renderGrid(shows.slice(1), 'trending-grid');
        } catch (e) {
            console.error(e);
        }
    }

    async function loadMedia({ id, type, season, epNumber }) {
        document.getElementById('view-details').innerHTML = '<div style="text-align:center; padding:50px; color:var(--neon-blue);">ACCESSING DATA...</div>';
        
        try {
            state.currentShow = await ShowService.getDetails(id, type);
            
            if (type === 'tv') {
                const targetSeason = season || 1;
                state.currentSeason = targetSeason;
                
                const eps = await ShowService.getSeasonEpisodes(id, targetSeason);
                state.currentShow.episodes[targetSeason] = eps;

                if (epNumber) {
                    state.currentEpisode = eps.find(e => e.number === epNumber) || eps[0];
                } else {
                    state.currentEpisode = eps[0] || { number: 1, title: 'Unavailable' };
                }
            } else {
                saveProgress();
            }
            
            renderDetailsView();
            syncCurrentDetailsUrl(true);

            if (state.currentShow && state.currentShow.title) {
                document.title = `${state.currentShow.title} - Horion TV`;
            } else {
                document.title = 'Horion TV';
            }

            try {
                if (window.parent && window.parent !== window && typeof window.parent.onTvViewChange === 'function') {
                    window.parent.onTvViewChange('details', {
                        id: state.currentShow.id,
                        type: state.currentShow.type,
                        season: state.currentShow.type === 'tv' ? state.currentSeason : null,
                        epNumber: state.currentShow.type === 'tv' && state.currentEpisode ? state.currentEpisode.number : null,
                        title: state.currentShow.title || ''
                    });
                }
            } catch (err) {
                // Ignore parent messaging errors.
            }
        } catch(e) {
             document.getElementById('view-details').innerHTML = '<div style="text-align:center; padding:50px; color:red;">DATA CORRUPTED. RETRY.</div>';
        }
    }

    // ==========================================
    // 5. RENDERERS
    // ==========================================

    function renderHero(show) {
        const container = document.getElementById('hero-container');
        if(!show) return;
        const heroMeta = [
            show.rating ? `<span style="color:var(--warning-gold);">RATING ${show.rating}</span>` : '',
            show.year ? `<span>${show.year}</span>` : ''
        ].filter(Boolean).join('<span>|</span>');
        
        container.innerHTML = `
            <div class="hero-banner">
                <div class="hero-bg" style="background-image: url('${show.backdrop}')"></div>
                <div class="hero-content">
                    <div style="color:var(--neon-blue); font-family:'JetBrains Mono'; margin-bottom:5px; text-transform: uppercase;">
                       FEATURED ${show.type === 'movie' ? 'MOVIE' : 'TV SHOW'}
                    </div>
                    <h1 class="hero-title">${show.title}</h1>
                    ${heroMeta ? `<div style="display:flex; gap:15px; margin-bottom:15px; font-family:'JetBrains Mono'; font-size:0.9rem;">${heroMeta}</div>` : ''}
                    <p class="hero-desc">${show.summary ? show.summary.substring(0, 200) + '...' : ''}</p>
                    <button onclick="router('details', { id: ${show.id}, type: '${show.type}' })" class="btn-action">WATCH NOW</button>
                </div>
            </div>
        `;
    }

    function renderGrid(shows, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        shows.forEach(show => {
            const card = document.createElement('div');
            card.className = 'tv-card';
            card.onclick = () => router('details', { id: show.id, type: show.type });
            const metaParts = [show.year, show.rating ? `RATING ${show.rating}` : '', (show.type || '').toUpperCase()].filter(Boolean);
            
            card.innerHTML = `
                <img src="${show.poster}" loading="lazy">
                <div class="card-overlay">
                    <div class="tv-title">${show.title}</div>
                    <div class="tv-meta">${metaParts.join(' | ')}</div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function renderContinueWatching() {
        const container = document.getElementById('continue-grid');
        const cwList = getContinueWatching();
        
        if (cwList.length === 0) {
            container.innerHTML = `
                <div style="color:var(--text-grey); font-family:'JetBrains Mono'; grid-column: 1 / -1; padding: 40px 0;">
                    Start watching a show or movie to add it to Continue Watching.
                </div>`;
            return;
        }

        container.innerHTML = '';
        cwList.forEach(item => {
            const card = document.createElement('div');
            card.className = 'tv-card';
            card.onclick = () => router('details', { id: item.id, type: item.type, season: item.season, epNumber: item.episodeNumber });
            
            const metaText = item.type === 'movie' ? 'MOVIE' : `S${item.season}:E${item.episodeNumber}`;
            
            card.innerHTML = `
                <img src="${item.poster}" loading="lazy">
                <div class="card-overlay">
                    <div class="tv-title">${item.title}</div>
                    <div class="tv-meta" style="color: var(--neon-blue);">${metaText} | RESUME</div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function renderDetailsView() {
        const show = state.currentShow;
        const isMovie = show.type === 'movie';
        const container = document.getElementById('view-details');
        const detailsMeta = [
            show.rating ? `<span style="color:var(--warning-gold);">RATING ${show.rating}</span>` : '',
            show.year ? `<span>${show.year}</span>` : '',
            !isMovie ? `<span>${show.totalSeasons} SEASONS</span>` : ''
        ].filter(Boolean).join('<span>|</span>');
        
        let providerUrl = '';
        let episodeTitleText = '';
        
        if (isMovie) {
            providerUrl = getProviderUrl(show.imdbId, show.tmdbId, 'movie');
            episodeTitleText = 'FEATURE FILM';
        } else {
            providerUrl = getProviderUrl(show.imdbId, show.tmdbId, 'tv', state.currentSeason, state.currentEpisode.number);
            episodeTitleText = `S${state.currentSeason}:E${state.currentEpisode.number} - ${state.currentEpisode.title}`;
        }
        
        container.innerHTML = `
            <button onclick="router('home')" style="background:none; border:none; color:var(--text-grey); cursor:pointer; margin-bottom:20px; font-family:'JetBrains Mono';">
                < BACK
            </button>

            <div class="sports-ad-warning" style="margin-top:0;">
                With Horion TV, use an ad blocker, as TV streams are embedded with ads outside Horion jurisdiction.
                Most school devices have adblockers built in.
                <a href="https://ublockorigin.com/" target="_blank" rel="noopener noreferrer">Get uBlock Origin</a>
            </div>
            
            <div class="details-layout" style="${isMovie ? 'grid-template-columns: 1fr;' : ''}">
                <!-- LEFT/MAIN: PLAYER -->
                <div>
                    <div class="video-container">
                        <iframe id="video-player" src="about:blank" frameborder="0" allowfullscreen></iframe>
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px; margin-bottom:16px;">
                        <button type="button" class="btn-secondary" onclick="openTvPlayerFullscreen()">FULLSCREEN</button>
                        <button type="button" class="btn-secondary" onclick="openTvPlayerLink()">OPEN LINK</button>
                        <button type="button" class="btn-secondary" onclick="refreshTvPlayer()">REFRESH</button>
                        <button type="button" class="btn-secondary" onclick="openTvPlayerInAboutBlank()">OPEN IN ABOUT:BLANK</button>
                    </div>
                    <div class="server-bar">
                        <div>
                            <div style="color:white; font-weight:bold;">${episodeTitleText}</div>
                            <div style="color:var(--text-grey); font-size:0.8rem;">SOURCE: ${state.currentServer === 'server1' ? 'VidLink (S1)' : 'VidSrc (S2)'}</div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button onclick="switchServer('server1')" class="btn-secondary ${state.currentServer === 'server1' ? 'active' : ''}">S1</button>
                            <button onclick="switchServer('server2')" class="btn-secondary ${state.currentServer === 'server2' ? 'active' : ''}">S2</button>
                        </div>
                    </div>
                    
                    <div style="margin-top:30px;">
                        <div style="color:var(--hacker-blue); font-family:'JetBrains Mono'; letter-spacing:2px; margin-bottom:5px;">
                            ${isMovie ? 'MOVIE' : 'TV SERIES'}
                        </div>
                        <h1 style="font-size:3rem; margin:0; line-height:1.2;">${show.title}</h1>
                        ${detailsMeta ? `<div style="display:flex; gap:20px; color:var(--text-grey); margin:10px 0; font-family:'JetBrains Mono';">${detailsMeta}</div>` : ''}
                        <p style="color:#ccc; line-height:1.6; max-width: ${isMovie ? '100%' : '800px'};">${show.description}</p>
                    </div>
                </div>

                <!-- RIGHT: EPISODES (Only visible for TV) -->
                ${isMovie ? '' : `
                <div class="episode-list-container">
                    <div class="season-header">
                        <span style="font-family:'JetBrains Mono'; font-weight:bold;">EPISODES</span>
                        <select id="season-select" class="season-select" onchange="changeSeason(this.value)">
                            ${Array.from({length: show.totalSeasons}, (_, i) => i + 1).map(s => 
                                `<option value="${s}" ${s == state.currentSeason ? 'selected' : ''}>SEASON ${s}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div id="episodes-scroll" class="episodes-scroll">
                        <!-- Eps injected here -->
                    </div>
                </div>
                `}
            </div>
        `;

        setLockedEmbedFrame(document.getElementById('video-player'), providerUrl, {
            disableOuterSandbox: true,
            disableInnerSandbox: true
        });
        
        if (!isMovie) renderEpisodeList();
    }

    function getCurrentProviderUrl() {
        if (!state.currentShow) return '';

        const show = state.currentShow;
        if (show.type === 'movie') {
            return getProviderUrl(show.imdbId, show.tmdbId, 'movie');
        }

        if (!state.currentEpisode) return '';
        return getProviderUrl(show.imdbId, show.tmdbId, 'tv', state.currentSeason, state.currentEpisode.number);
    }

    function openTvPlayerFullscreen() {
        const frame = document.getElementById('video-player');
        if (!frame) return;

        if (frame.requestFullscreen) {
            frame.requestFullscreen();
        } else if (frame.webkitRequestFullscreen) {
            frame.webkitRequestFullscreen();
        }
    }

    function refreshTvPlayer() {
        const frame = document.getElementById('video-player');
        const providerUrl = getCurrentProviderUrl();
        if (!frame || !providerUrl) return;

        setLockedEmbedFrame(frame, providerUrl, {
            disableOuterSandbox: true,
            disableInnerSandbox: true
        });
    }

    function openTvPlayerInAboutBlank() {
        const providerUrl = getCurrentProviderUrl();
        if (!providerUrl) return;
        launchSite(providerUrl);
    }

    function openTvPlayerLink() {
        const providerUrl = getCurrentProviderUrl();
        if (!providerUrl) return;
        window.open(providerUrl, '_blank', 'noopener,noreferrer');
    }

    function renderEpisodeList() {
        const container = document.getElementById('episodes-scroll');
        const episodes = state.currentShow.episodes[state.currentSeason] || [];
        
        if(episodes.length === 0) {
            container.innerHTML = '<div style="padding:20px; color:grey; text-align:center;">NO DATA AVAILABLE</div>';
            return;
        }

        container.innerHTML = episodes.map((ep, idx) => {
            const isActive = (ep.number === state.currentEpisode?.number);
            return `
                <div class="episode-item ${isActive ? 'active' : ''}" onclick="playEpisode(${state.currentSeason}, ${idx})">
                    <div class="ep-num">${ep.number}</div>
                    <div class="ep-title">${ep.title}</div>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // 6. PLAYER LOGIC
    // ==========================================

    async function changeSeason(season) {
        state.currentSeason = parseInt(season);
        
        if (!state.currentShow.episodes[state.currentSeason]) {
            const container = document.getElementById('episodes-scroll');
            container.innerHTML = '<div style="padding:20px; color:var(--neon-blue); text-align:center; font-family:\'JetBrains Mono\';">LOADING...</div>';
            
            const eps = await ShowService.getSeasonEpisodes(state.currentShow.id, state.currentSeason);
            state.currentShow.episodes[state.currentSeason] = eps;
        }
        renderEpisodeList();
        syncCurrentDetailsUrl(true);

        try {
            if (window.parent && window.parent !== window && typeof window.parent.onTvViewChange === 'function' && state.currentShow) {
                window.parent.onTvViewChange('details', {
                    id: state.currentShow.id,
                    type: state.currentShow.type,
                    season: state.currentSeason,
                    epNumber: state.currentEpisode ? state.currentEpisode.number : null,
                    title: state.currentShow.title || ''
                });
            }
        } catch (err) {
            // Ignore parent messaging errors.
        }
    }

 function playEpisode(season, index) {
    state.currentSeason = season;
    state.currentEpisode = state.currentShow.episodes[season][index];

    saveProgress();
    renderDetailsView();
    window.scrollTo(0, 0);
    syncCurrentDetailsUrl(true);

    try {
        if (
            window.parent &&
            window.parent !== window &&
            typeof window.parent.onTvViewChange === 'function' &&
            state.currentShow
        ) {
            window.parent.onTvViewChange('details', {
                id: state.currentShow.id,
                type: state.currentShow.type,
                season: state.currentSeason,
                epNumber: state.currentEpisode?.number ?? (index + 1),
                title: state.currentShow.title || ''
            });
        }
    } catch (err) {
        // Ignore parent messaging errors.
    }
}

function switchServer(server) {
    state.currentServer = server;
    renderDetailsView();
    syncCurrentDetailsUrl(true);
}

function getProviderUrl(imdbId, tmdbId, type, season = null, episode = null) {
    const idToUse = tmdbId || imdbId;

    // Ensure valid season/episode values
    const seasonValue = season ?? state.currentSeason ?? 1;
    const episodeValue =
        episode ??
        state.currentEpisode?.number ??
        state.currentEpisode?.episode_number ??
        1;

    if (state.currentServer === 'server1') {
        if (type === 'movie') {
            return `https://vidlink.pro/movie/${idToUse}?primaryColor=0278fd&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=true&poster=true&autoplay=true&nextbutton=false`;
        }

        return `https://vidlink.pro/tv/${idToUse}/${seasonValue}/${episodeValue}?primaryColor=0278fd&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=true&poster=true&autoplay=true&nextbutton=false`;
    }

    if (type === 'movie') {
        return `https://www.vidsrc.wtf/api/1/movie/?id=${idToUse}`;
    }

    return `https://www.vidsrc.wtf/api/1/tv/?id=${idToUse}&s=${seasonValue}&e=${episodeValue}`;
}

    // https://vidlink.pro/movie/${idToUse}?primaryColor=0278fd&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=true&poster=true&autoplay=true&nextbutton=false
    // 7. EXTERNAL PAGE LAUNCHER LOGIC
    // ==========================================

const UBEAST_MATCH_TEXT = 'ubeast';
const UBEAST_RELOAD_PARAM = '__horion_ubeast_reload';

function urlContainsUbeast(urlValue) {
    return String(urlValue || '').toLowerCase().includes(UBEAST_MATCH_TEXT);
}

function appendUbeastReloadParam(urlValue) {
    const raw = String(urlValue || '').trim();
    if (!raw) return raw;
    try {
        const parsed = new URL(raw, window.location.href);
        parsed.searchParams.set(UBEAST_RELOAD_PARAM, String(Date.now()));
        return parsed.href;
    } catch (error) {
        const separator = raw.includes('?') ? '&' : '?';
        return raw + separator + UBEAST_RELOAD_PARAM + '=' + Date.now();
    }
}

function getUbeastReloadKey(urlValue) {
    const raw = String(urlValue || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw, window.location.href);
        parsed.searchParams.delete(UBEAST_RELOAD_PARAM);
        return parsed.href;
    } catch (error) {
        return raw
            .replace(new RegExp('([?&])' + UBEAST_RELOAD_PARAM + '=[^&]*', 'ig'), '$1')
            .replace(/[?&]$/, '');
    }
}

function launchSite(targetUrl, options) {
    const normalizedUrl = String(targetUrl || '').trim();
    if (!normalizedUrl) return false;
    const safeUrl = normalizedUrl;
    const safeUrlAttr = safeUrl
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');

    const win = window.open('about:blank', '_blank');
    if (!win) {
        alert('Pop-up blocked! Please allow popups for this site.');
        return false;
    }

    try {
        win.opener = null;
    } catch (err) {
        // Some browsers may not allow updating opener.
    }

    const wrapperHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horion TV</title>
    <style>
        html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000}
        iframe{border:0;width:100%;height:100%;display:block;background:#000}
    </style>
</head>
<body>
    <iframe id="horion-tv-popup-frame" src="${safeUrlAttr}" allow="autoplay; fullscreen; xr-spatial-tracking; encrypted-media; clipboard-read; clipboard-write; display-capture; gamepad; picture-in-picture; screen-wake-lock" allowfullscreen referrerpolicy="no-referrer"></iframe>
    <script>
    (function () {
        const frame = document.getElementById('horion-tv-popup-frame');
        if (!frame) return;

        const matchText = ${JSON.stringify(UBEAST_MATCH_TEXT)};
        const reloadParam = ${JSON.stringify(UBEAST_RELOAD_PARAM)};
        const cooldownMs = 3500;
        const seenAt = new Map();

        const appendReloadParam = function (urlValue) {
            const raw = String(urlValue || '').trim();
            if (!raw) return raw;
            try {
                const parsed = new URL(raw, window.location.href);
                parsed.searchParams.set(reloadParam, String(Date.now()));
                return parsed.href;
            } catch (error) {
                const separator = raw.includes('?') ? '&' : '?';
                return raw + separator + reloadParam + '=' + Date.now();
            }
        };

        const getReloadKey = function (urlValue) {
            const raw = String(urlValue || '').trim();
            if (!raw) return '';
            try {
                const parsed = new URL(raw, window.location.href);
                parsed.searchParams.delete(reloadParam);
                return parsed.href;
            } catch (error) {
                return raw
                    .replace(new RegExp('([?&])' + reloadParam + '=[^&]*', 'ig'), '$1')
                    .replace(/[?&]$/, '');
            }
        };

        const shouldReloadNow = function (candidateUrl) {
            if (!candidateUrl || String(candidateUrl).toLowerCase().indexOf(matchText) === -1) return false;
            const key = getReloadKey(candidateUrl);
            const now = Date.now();
            const last = seenAt.get(key) || 0;
            if (now - last < cooldownMs) return false;
            seenAt.set(key, now);
            return true;
        };

        const reloadSameMethod = function (candidateUrl) {
            const target = appendReloadParam(candidateUrl || frame.getAttribute('src') || frame.src);
            if (!target) return;
            try {
                frame.src = target;
            } catch (error) {
                window.location.reload();
            }
        };

        const inspectUrl = function (candidateUrl) {
            if (!shouldReloadNow(candidateUrl)) return;
            reloadSameMethod(candidateUrl);
        };

        frame.addEventListener('load', function () {
            inspectUrl(frame.getAttribute('src') || frame.src);
            try {
                inspectUrl(frame.contentWindow && frame.contentWindow.location ? frame.contentWindow.location.href : '');
            } catch (error) {
                // Cross-origin frame location is expected to be blocked.
            }
        });

        const observer = new MutationObserver(function () {
            inspectUrl(frame.getAttribute('src') || frame.src);
        });
        observer.observe(frame, { attributes: true, attributeFilter: ['src'] });

        setInterval(function () {
            inspectUrl(frame.getAttribute('src') || frame.src);
            try {
                inspectUrl(frame.contentWindow && frame.contentWindow.location ? frame.contentWindow.location.href : '');
            } catch (error) {
                // Cross-origin frame location is expected to be blocked.
            }
        }, 1000);

        inspectUrl(frame.getAttribute('src') || frame.src);
    })();
    <\/script>
</body>
</html>`;

    win.document.open();
    win.document.write(wrapperHtml);
    win.document.close();
    
    return true;
}

function buildTvProxiedInlineHtml(html, baseUrl) {
    const safeBase = String(baseUrl).replace(/"/g, '&quot;');
    const baseTag = `<base href="${safeBase}" target="_self">`;

    const sanitizedHtml = String(html)
        .replace(/<meta[^>]*http-equiv=["']content-security-policy["'][^>]*>/gi, '')
        .replace(/<meta[^>]*http-equiv=["']x-content-security-policy["'][^>]*>/gi, '')
        .replace(/<base[^>]*>/gi, '');

    const guardScript = `
<script>
(function () {
    const toAbsoluteUrl = function (value) {
        try {
            return new URL(value, document.baseURI).href;
        } catch (error) {
            return null;
        }
    };

    const isSkippableHref = function (href) {
        if (!href) return true;
        const lower = String(href).trim().toLowerCase();
        return lower.startsWith('#') || lower.startsWith('javascript:') || lower.startsWith('mailto:') || lower.startsWith('tel:');
    };

    const navigateInline = function (url) {
        if (!url || typeof window.__horionNavigate !== 'function') return;
        window.__horionNavigate(url);
    };

    const normalizeNodeTarget = function (node) {
        if (!node || !node.getAttribute || !node.setAttribute) return;
        const tag = (node.tagName || '').toLowerCase();
        if (tag !== 'a' && tag !== 'form') return;
        node.setAttribute('target', '_self');
        if (tag === 'a') {
            node.setAttribute('rel', 'noopener noreferrer');
        }
    };

    const forceSameTabTargets = function () {
        document.querySelectorAll('a, form').forEach(function (node) {
            normalizeNodeTarget(node);
        });
    };

    const rerouteToSameTab = function (candidateUrl) {
        const resolved = toAbsoluteUrl(candidateUrl || '');
        if (resolved) {
            navigateInline(resolved);
            return window;
        }
        navigateInline(window.location.href);
        return window;
    };

    const originalOpen = window.open;
    const blockedOpen = function (url) {
        return rerouteToSameTab(url);
    };

    try { window.open = blockedOpen; } catch (error) {}
    try { globalThis.open = blockedOpen; } catch (error) {}
    try { if (window.parent) window.parent.open = blockedOpen; } catch (error) {}
    try { if (window.top) window.top.open = blockedOpen; } catch (error) {}

    forceSameTabTargets();
    const observer = new MutationObserver(function (mutations) {
        forceSameTabTargets();
        mutations.forEach(function (mutation) {
            if (mutation.type === 'attributes' && mutation.target) {
                normalizeNodeTarget(mutation.target);
            }
        });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['target', 'rel', 'href', 'action'] });
    setInterval(forceSameTabTargets, 500);

    const handleLinkLikeNavigation = function (event) {
        const target = event.target && event.target.closest ? event.target.closest('a[href], [data-href], button[data-href]') : null;
        if (!target) return;

        const href = target.getAttribute('href') || target.getAttribute('data-href');
        if (isSkippableHref(href)) return;

        const resolved = toAbsoluteUrl(href);
        if (!resolved) return;

        event.preventDefault();
        event.stopPropagation();
        navigateInline(resolved);
    };

    document.addEventListener('click', handleLinkLikeNavigation, true);
    document.addEventListener('auxclick', handleLinkLikeNavigation, true);

    document.addEventListener('submit', function (event) {
        const form = event.target;
        if (!form || !form.getAttribute) return;

        form.setAttribute('target', '_self');

        const method = (form.getAttribute('method') || 'get').toLowerCase();
        const action = form.getAttribute('action') || window.location.href;
        const resolvedAction = toAbsoluteUrl(action);
        if (!resolvedAction) return;

        if (method !== 'get') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        const formData = new FormData(form);
        const params = new URLSearchParams(formData);
        const nextUrl = new URL(resolvedAction);
        params.forEach(function (value, key) {
            nextUrl.searchParams.set(key, value);
        });
        navigateInline(nextUrl.href);
    }, true);
})();
<\/script>`;

    if (/<head[^>]*>/i.test(sanitizedHtml)) {
        return sanitizedHtml.replace(/<head[^>]*>/i, function (match) {
            return match + baseTag + guardScript;
        });
    }

    return baseTag + guardScript + sanitizedHtml;
}

function openInlineTvPage(targetUrl, titleText, options) {
    const normalizedUrl = String(targetUrl || '').trim();
    if (!normalizedUrl) return false;

    const opts = options || {};
    const blockNewTabs = Boolean(opts.blockNewTabs);
    const useProxyGuard = Boolean(opts.useProxyGuard);
    const fullscreen = Boolean(opts.fullscreen);

    const existing = document.getElementById('horion-tv-inline-page');
    if (existing) existing.remove();

    const host = document.createElement('section');
    host.id = 'horion-tv-inline-page';
    host.style.position = 'fixed';
    host.style.left = '0';
    host.style.right = '0';
    host.style.bottom = '0';
    host.style.zIndex = '9990';
    host.style.background = '#000';
    host.style.borderTop = '1px solid rgba(0, 112, 255, 0.25)';

    host.innerHTML = `
        <iframe
            id="horion-tv-inline-host-frame"
            src="about:blank"
            allow="autoplay; encrypted-media; fullscreen"
            allowfullscreen
            style="border:none;width:100%;height:100%;background:#000;"
        ></iframe>
    `;

    const applyOffset = function () {
        if (fullscreen) {
            host.style.top = '0px';
            return;
        }
        const nav = document.querySelector('.hud-nav');
        const top = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 0;
        host.style.top = top + 'px';
    };

    const closeInlineView = function () {
        window.removeEventListener('resize', applyOffset);
        document.removeEventListener('keydown', onKeydown);
        host.remove();
    };

    const onKeydown = function (event) {
        if (event.key === 'Escape') closeInlineView();
    };

    document.body.appendChild(host);
    const hostFrame = document.getElementById('horion-tv-inline-host-frame');
    const inlineNavToken = 'horion-tv-inline-nav-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    let isClosing = false;
    const inlineUbeastReloadSeenAt = new Map();

    const shouldReloadInlineForUbeast = function (candidateUrl, scope) {
        if (!urlContainsUbeast(candidateUrl)) return false;
        const key = scope + '|' + getUbeastReloadKey(candidateUrl);
        const now = Date.now();
        const last = inlineUbeastReloadSeenAt.get(key) || 0;
        if (now - last < 3500) return false;
        inlineUbeastReloadSeenAt.set(key, now);
        return true;
    };

    const renderDirectWrapper = function (urlOverride) {
        if (!hostFrame || !hostFrame.contentWindow || !hostFrame.contentWindow.document) return;
        const titleAttr = String(titleText || 'TV Tool');
        const launchUrl = String(urlOverride || normalizedUrl || '').trim();
        const wrapperHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + titleAttr + '</title><base target="_self"><style>html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden}iframe{border:none;width:100%;height:100%;background:#000}</style></head><body><iframe id="horion-tv-inline-inner-frame" src="' + launchUrl + '" allow="autoplay; encrypted-media; fullscreen; clipboard-read; clipboard-write; picture-in-picture; screen-wake-lock"></iframe><script>(function(){const frame=document.getElementById("horion-tv-inline-inner-frame");if(!frame)return;const inspect=function(url){if(!url||typeof window.__horionReloadSelf!=="function")return;if(String(url).toLowerCase().indexOf("' + UBEAST_MATCH_TEXT + '")!==-1){window.__horionReloadSelf(url);}};frame.addEventListener("load",function(){inspect(frame.getAttribute("src")||frame.src);try{inspect(frame.contentWindow&&frame.contentWindow.location?frame.contentWindow.location.href:"");}catch(err){}});const observer=new MutationObserver(function(){inspect(frame.getAttribute("src")||frame.src);});observer.observe(frame,{attributes:true,attributeFilter:["src"]});setInterval(function(){inspect(frame.getAttribute("src")||frame.src);try{inspect(frame.contentWindow&&frame.contentWindow.location?frame.contentWindow.location.href:"");}catch(err){}},1000);inspect(frame.getAttribute("src")||frame.src);})();<\/script></body></html>';
        hostFrame.contentWindow.__horionReloadSelf = function (nextUrl) {
            if (isClosing) return;
            const detectedUrl = String(nextUrl || launchUrl || normalizedUrl || '').trim();
            if (!shouldReloadInlineForUbeast(detectedUrl, 'direct')) return;
            renderDirectWrapper(appendUbeastReloadParam(detectedUrl));
        };
        hostFrame.contentWindow.document.open();
        hostFrame.contentWindow.document.write(wrapperHtml);
        hostFrame.contentWindow.document.close();
    };

    const renderProxiedPage = function (urlValue) {
        const safeUrl = String(urlValue || '').trim();
        if (!safeUrl || isClosing || !hostFrame || !hostFrame.contentWindow || !hostFrame.contentWindow.document) return;

        if (shouldReloadInlineForUbeast(safeUrl, 'proxy')) {
            renderProxiedPage(appendUbeastReloadParam(safeUrl));
            return;
        }

        fetch(safeUrl)
            .then((response) => {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.text();
            })
            .then((htmlText) => {
                if (isClosing || !hostFrame.contentWindow || !hostFrame.contentWindow.document) return;
                const proxiedHtml = buildTvProxiedInlineHtml(htmlText, safeUrl);
                hostFrame.contentWindow.__horionNavigate = function (nextUrl) {
                    window.postMessage({ type: 'HORION_TV_INLINE_NAV', token: inlineNavToken, url: nextUrl }, '*');
                };
                hostFrame.contentWindow.__horionReloadSelf = function (nextUrl) {
                    const detectedUrl = String(nextUrl || safeUrl || '').trim();
                    if (!shouldReloadInlineForUbeast(detectedUrl, 'proxy')) return;
                    renderProxiedPage(appendUbeastReloadParam(detectedUrl));
                };
                hostFrame.contentWindow.document.open();
                hostFrame.contentWindow.document.write(proxiedHtml);
                hostFrame.contentWindow.document.close();
            })
            .catch((error) => {
                console.warn('Inline proxy fetch failed, falling back to direct iframe wrapper.', error);
                renderDirectWrapper();
            });
    };

    const onInlineMessage = function (event) {
        const data = event && event.data ? event.data : null;
        if (!data || data.type !== 'HORION_TV_INLINE_NAV' || data.token !== inlineNavToken) return;
        if (shouldReloadInlineForUbeast(data.url, 'proxy')) {
            renderProxiedPage(appendUbeastReloadParam(data.url));
            return;
        }
        renderProxiedPage(data.url);
    };

    if (useProxyGuard && blockNewTabs) {
        window.addEventListener('message', onInlineMessage);
        renderProxiedPage(normalizedUrl);
    } else {
        renderDirectWrapper();
    }

    const originalCloseInlineView = closeInlineView;
    closeInlineView = function () {
        isClosing = true;
        window.removeEventListener('message', onInlineMessage);
        originalCloseInlineView();
    };

    applyOffset();
    window.addEventListener('resize', applyOffset);
    document.addEventListener('keydown', onKeydown);

    return true;
}

function launchSportsTool() {
        router('sports');
    }

function openOriginalSports(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    launchSite('https://streami.su/');
}

    // ==========================================
    // 8. BROWSE / SEARCH LOGIC
    // ==========================================
    const searchInput = document.getElementById('browse-search');
    let debounceTimer;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const query = e.target.value.trim();
            const container = document.getElementById('browse-grid');
            
            // Revert back to top 50 default list if search is empty
            if(!query) {
                renderGrid(state.browseDefault, 'browse-grid');
                return;
            }
            
            container.innerHTML = '<div style="color:var(--neon-blue); font-family:\'JetBrains Mono\'; grid-column: 1/-1;">SCANNING DATABASE...</div>';
            const results = await ShowService.searchShows(query);
            
            if (results.length === 0) {
                 container.innerHTML = '<div style="color:var(--text-grey); font-family:\'JetBrains Mono\'; grid-column: 1/-1;">No results found in database.</div>';
            } else {
                 renderGrid(results, 'browse-grid');
            }
        }, 600);
    });

    window.addEventListener('popstate', () => {
        const route = parseRouteFromUrl();
        router(route.view, route.param, { fromPopState: true });
    });
