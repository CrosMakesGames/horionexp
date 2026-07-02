const gamesTemplate = document.getElementById('games-app-template');
        const tvTemplate = document.getElementById('tv-app-template');
        const GAMES_APP_HTML = gamesTemplate.value || gamesTemplate.textContent || '';
        const TV_APP_HTML = tvTemplate.value || tvTemplate.textContent || '';

        const model = {
            mode: 'games',
            currentGamesView: 'home',
            currentGamesPage: null,
            currentTvView: 'home',
            currentTvDetails: null
        };

        const ROUTE_STORAGE_KEY = 'horion-route-v1';
    const ANNOUNCEMENT_STORAGE_KEY = 'horion-end-of-year-announcement-v1';

        const validModes = new Set(['games', 'tv']);
        const validGamesViews = new Set(['home', 'favorites', 'featured', 'database', 'extensions', 'more']);
        const specialGamesViews = new Set(['gnmath']);
        const validTvViews = new Set(['home', 'browse', 'continue', 'details', 'youtube', 'sports']);
        const launchOnlyGamesViews = new Set(['gnmath']);
        const launchOnlyTvViews = new Set(['youtube']);
        let isApplyingRoute = false;
        let switchTrackTimer = null;
        let switchTrackTransitionHandler = null;
        let lastHistoryPushAt = 0;

        const frameState = {
            gamesLoaded: false,
            tvLoaded: false,
            pendingGamesView: null,
            pendingTvNavigation: null
        };

        function shouldShowBetaModalForNormalGamesRoute() {
            const url = new URL(window.location.href);
            const typeParam = (url.searchParams.get('type') || '').toLowerCase();
            const pageParam = (url.searchParams.get('page') || '').toLowerCase();
            return typeParam === 'games' && (pageParam === 'normal' || pageParam === 'home');
        }

        function showBetaModalIfNeeded() {
            if (!shouldShowBetaModalForNormalGamesRoute()) {
                return;
            }

            const overlay = document.getElementById('beta-modal-overlay');
            const closeBtn = document.getElementById('beta-modal-close');
            if (!overlay || !closeBtn) {
                return;
            }

            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');

            const dismiss = () => {
                overlay.classList.remove('active');
                overlay.setAttribute('aria-hidden', 'true');
                overlay.removeEventListener('click', onOverlayClick);
                document.removeEventListener('keydown', onEscape);
                closeBtn.removeEventListener('click', dismiss);
            };

            const onOverlayClick = (event) => {
                if (event.target === overlay) {
                    dismiss();
                }
            };

            const onEscape = (event) => {
                if (event.key === 'Escape') {
                    dismiss();
                }
            };

            closeBtn.addEventListener('click', dismiss);
            overlay.addEventListener('click', onOverlayClick);
            document.addEventListener('keydown', onEscape);
        }

        function showAnnouncementModalIfNeeded() {
            if (localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY) === 'seen') {
                return;
            }

            const overlay = document.getElementById('announcement-modal-overlay');
            const continueBtn = document.getElementById('announcement-modal-continue');
            if (!overlay || !continueBtn) {
                return;
            }

            const dismiss = () => {
                localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, 'seen');
                overlay.classList.remove('active');
                overlay.setAttribute('aria-hidden', 'true');
                continueBtn.removeEventListener('click', dismiss);
            };

            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');
            continueBtn.addEventListener('click', dismiss);
        }

        window.clearCache = function clearCache() {
            localStorage.removeItem(ANNOUNCEMENT_STORAGE_KEY);
            return 'Horion announcement cache cleared.';
        };

        function syncClearCacheToEmbeddedFrames() {
            ['games-frame', 'tv-frame'].forEach((frameId) => {
                const frame = document.getElementById(frameId);
                if (!frame || !frame.contentWindow) return;
                try {
                    frame.contentWindow.clearCache = window.clearCache;
                } catch (error) {
                    // Ignore frame sync failures until the srcdoc content is ready.
                }
            });
        }

        function normalizeTvDetails(param) {
            if (!param || typeof param !== 'object') return null;

            const idNum = Number(param.id);
            const type = String(param.type || '').toLowerCase();
            if (!Number.isFinite(idNum) || idNum <= 0) return null;
            if (type !== 'movie' && type !== 'tv') return null;

            let season = null;
            let epNumber = null;

            if (param.season !== undefined && param.season !== null && param.season !== '') {
                const s = Number(param.season);
                if (Number.isFinite(s) && s > 0) season = Math.floor(s);
            }

            if (param.epNumber !== undefined && param.epNumber !== null && param.epNumber !== '') {
                const e = Number(param.epNumber);
                if (Number.isFinite(e) && e > 0) epNumber = Math.floor(e);
            }

            const title = typeof param.title === 'string' ? param.title.trim() : '';

            return { id: Math.floor(idNum), type, season, epNumber, title };
        }

        function areTvDetailsEqual(a, b) {
            if (!a && !b) return true;
            if (!a || !b) return false;
            return a.id === b.id && a.type === b.type && a.season === b.season && a.epNumber === b.epNumber && a.title === b.title;
        }

        function updateShellTitle() {
            if (model.mode === 'games') {
                document.title = 'Horion';
                return;
            }

            if (model.currentTvView === 'sports') {
                document.title = 'Live Sports - Horion TV';
                return;
            }

            if (model.currentTvView === 'youtube') {
                document.title = 'YouTube - Horion TV';
                return;
            }

            if (model.currentTvView === 'details' && model.currentTvDetails && model.currentTvDetails.title) {
                document.title = `${model.currentTvDetails.title} - Horion TV`;
                return;
            }

            document.title = 'Horion TV';
        }

        function parseRouteFromUrl() {
            const url = new URL(window.location.href);
            const typeParam = (url.searchParams.get('type') || '').toLowerCase();
            const pageParam = (url.searchParams.get('page') || '').toLowerCase();

            // Legacy fallback for existing links that still use mode/games/tv.
            const legacyModeParam = (url.searchParams.get('mode') || '').toLowerCase();
            const legacyGamesParam = (url.searchParams.get('games') || '').toLowerCase();
            const legacyTvParam = (url.searchParams.get('tv') || '').toLowerCase();

            let mode = validModes.has(typeParam) ? typeParam : null;
            let gamesView = 'home';
            let gamesPage = null;
            let tvView = 'home';

            // Support shorthand links like ?page=sports or ?page=gnmath without an explicit type.
            if (!mode && pageParam) {
                const isGamesPage = validGamesViews.has(pageParam) || specialGamesViews.has(pageParam);
                const isTvPage = validTvViews.has(pageParam);

                if (isTvPage && !isGamesPage) {
                    mode = 'tv';
                } else if (isGamesPage && !isTvPage) {
                    mode = 'games';
                }
            }

            if (mode) {
                if (mode === 'games') {
                    if ((validGamesViews.has(pageParam) || specialGamesViews.has(pageParam))) {
                        gamesView = pageParam;
                        gamesPage = null;
                    } else if (pageParam) {
                        gamesView = 'featured';
                        gamesPage = pageParam;
                    } else {
                        gamesView = 'home';
                        gamesPage = null;
                    }
                } else {
                    tvView = validTvViews.has(pageParam) ? pageParam : 'home';
                }
            } else {
                mode = validModes.has(legacyModeParam) ? legacyModeParam : 'games';
                gamesView = (validGamesViews.has(legacyGamesParam) || specialGamesViews.has(legacyGamesParam)) ? legacyGamesParam : 'home';
                gamesPage = null;
                tvView = validTvViews.has(legacyTvParam) ? legacyTvParam : 'home';
            }

            const tvIdParam = url.searchParams.get('tvId');
            const tvTypeParam = (url.searchParams.get('tvType') || '').toLowerCase();
            const tvSeasonParam = url.searchParams.get('tvSeason');
            const tvEpParam = url.searchParams.get('tvEpisode');

            let tvDetails = normalizeTvDetails({
                id: tvIdParam,
                type: tvTypeParam,
                season: tvSeasonParam,
                epNumber: tvEpParam
            });

            if (!(mode === 'tv' && tvView === 'details')) {
                tvDetails = null;
            }

            return {
                mode,
                gamesView,
                gamesPage,
                tvView,
                tvDetails
            };
        }

        function hasExplicitRouteInUrl() {
            const url = new URL(window.location.href);
            return (
                url.searchParams.has('type') ||
                url.searchParams.has('page') ||
                url.searchParams.has('mode') ||
                url.searchParams.has('games') ||
                url.searchParams.has('tv')
            );
        }

        function getRefreshSafeGamesView(view) {
            return view === 'gnmath' ? 'home' : resolveGamesView(view);
        }

        function getRefreshSafeTvView(view) {
            if (view === 'youtube') return 'home';
            return validTvViews.has(view) ? view : 'home';
        }

        function saveRouteSnapshot() {
            try {
                const safeGamesView = getRefreshSafeGamesView(model.currentGamesView);
                const safeTvView = getRefreshSafeTvView(model.currentTvView);
                const payload = {
                    mode: model.mode,
                    gamesView: safeGamesView,
                    gamesPage: safeGamesView === 'featured' ? (model.currentGamesPage || null) : null,
                    tvView: safeTvView,
                    tvDetails: safeTvView === 'details' ? (model.currentTvDetails || null) : null
                };
                localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(payload));
            } catch (err) {
                // Ignore storage quota/private-mode issues.
            }
        }

        function loadRouteSnapshot() {
            try {
                const raw = localStorage.getItem(ROUTE_STORAGE_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return null;

                const mode = validModes.has(parsed.mode) ? parsed.mode : null;
                if (!mode) return null;

                const gamesView = getRefreshSafeGamesView(parsed.gamesView);
                const gamesPage = gamesView === 'featured' && typeof parsed.gamesPage === 'string'
                    ? parsed.gamesPage.trim() || null
                    : null;
                const tvView = getRefreshSafeTvView(parsed.tvView);
                let tvDetails = tvView === 'details' ? normalizeTvDetails(parsed.tvDetails) : null;
                if (tvView === 'details' && !tvDetails) {
                    tvDetails = null;
                }

                return { mode, gamesView, gamesPage, tvView, tvDetails };
            } catch (err) {
                return null;
            }
        }

        function syncUrlWithState(push) {
            const url = new URL(window.location.href);
            const routeGamesView = getRefreshSafeGamesView(model.currentGamesView);
            const routeGamesPage = routeGamesView === 'featured' ? (String(model.currentGamesPage || '').trim() || null) : null;
            const routeTvView = getRefreshSafeTvView(model.currentTvView);

            url.searchParams.set('type', model.mode);
            if (model.mode === 'games') {
                url.searchParams.set('page', routeGamesPage || routeGamesView);
            } else {
                url.searchParams.set('page', routeTvView);
            }

            // Remove old dual-view params so URL only reflects the active side.
            url.searchParams.delete('mode');
            url.searchParams.delete('games');
            url.searchParams.delete('tv');

            if (model.mode === 'tv' && routeTvView === 'details' && model.currentTvDetails) {
                url.searchParams.set('tvId', String(model.currentTvDetails.id));
                url.searchParams.set('tvType', model.currentTvDetails.type);
                if (model.currentTvDetails.season) {
                    url.searchParams.set('tvSeason', String(model.currentTvDetails.season));
                } else {
                    url.searchParams.delete('tvSeason');
                }
                if (model.currentTvDetails.epNumber) {
                    url.searchParams.set('tvEpisode', String(model.currentTvDetails.epNumber));
                } else {
                    url.searchParams.delete('tvEpisode');
                }
            } else {
                url.searchParams.delete('tvId');
                url.searchParams.delete('tvType');
                url.searchParams.delete('tvSeason');
                url.searchParams.delete('tvEpisode');
            }

            const currentUrl = window.location.href;
            const nextUrl = url.toString();
            if (currentUrl === nextUrl) return;

            const statePayload = {
                mode: model.mode,
                gamesView: model.currentGamesView,
                gamesPage: model.currentGamesView === 'featured' ? model.currentGamesPage : null,
                tvView: model.currentTvView,
                tvDetails: model.currentTvDetails
            };

            // Avoid pushState frequency errors during rapid view switching.
            const now = Date.now();
            const usePush = Boolean(push) && now - lastHistoryPushAt > 180;

            try {
                if (usePush) {
                    history.pushState(statePayload, '', url);
                    lastHistoryPushAt = now;
                } else {
                    history.replaceState(statePayload, '', url);
                }
                saveRouteSnapshot();
            } catch (err) {
                try {
                    history.replaceState(statePayload, '', url);
                    saveRouteSnapshot();
                } catch (replaceErr) {
                    console.warn('Failed to sync URL state.', replaceErr || err);
                }
            }
        }

        function applyRouteState(route) {
            isApplyingRoute = true;
            model.mode = route.mode;
            model.currentGamesView = route.gamesView;
            model.currentGamesPage = route.gamesPage || null;
            model.currentTvView = route.tvView;
            model.currentTvDetails = route.tvDetails || null;

            document.body.setAttribute('data-mode', model.mode);
            syncTrackTransform(false);
            updateModeDock();
            updateActivePane();
            setTrackSettled(true);

            if (model.mode === 'games') {
                navigateGames(model.currentGamesView, model.currentGamesPage);
            } else {
                navigateTv(model.currentTvView, model.currentTvDetails);
            }

            updateShellTitle();

            isApplyingRoute = false;
            syncUrlWithState(false);
        }

        function withFrame(frameId, callback) {
            const frame = document.getElementById(frameId);
            if (!frame || !frame.contentWindow) return false;
            try {
                callback(frame.contentWindow, frame.contentDocument);
                return true;
            } catch (err) {
                console.warn('Frame bridge failed for', frameId, err);
                return false;
            }
        }

        function resolveGamesView(view) {
            return (validGamesViews.has(view) || specialGamesViews.has(view)) ? view : 'home';
        }

        function normalizeGamesStateView(view) {
            return launchOnlyGamesViews.has(view) ? 'home' : resolveGamesView(view);
        }

        function normalizeTvStateView(view) {
            if (launchOnlyTvViews.has(view)) return 'home';
            return validTvViews.has(view) ? view : 'home';
        }

        function resolveTvNavigation(view, param) {
            let resolvedView = validTvViews.has(view) ? view : 'home';
            let resolvedDetails = null;

            if (resolvedView === 'details') {
                resolvedDetails = normalizeTvDetails(param) || normalizeTvDetails(model.currentTvDetails);
                if (!resolvedDetails) {
                    resolvedView = 'home';
                }
            }

            return {
                view: resolvedView,
                details: resolvedDetails
            };
        }

        function updateModeDock() {
            const chips = document.querySelectorAll('.mode-chip');
            chips.forEach(chip => {
                const active = chip.dataset.modeTarget === model.mode;
                chip.classList.toggle('active', active);
                chip.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        }

        function updateActivePane() {
            document.querySelectorAll('.mode-pane[data-mode-pane]').forEach(pane => {
                const isActive = pane.dataset.modePane === model.mode;
                pane.classList.toggle('active', isActive);
            });
        }

        function getTrackTransformForMode(mode) {
            return mode === 'tv' ? 'translateX(-50%)' : 'translateX(0)';
        }

        function getExpectedTrackTransform() {
            return getTrackTransformForMode(model.mode);
        }

        function syncTrackTransform(animate = false, modeOverride = null) {
            const track = document.getElementById('switch-track');
            if (!track) return;

            if (animate) {
                track.classList.add('animate');
            } else if (!switchTrackTimer && track.classList.contains('animate')) {
                track.classList.remove('animate');
            }

            const modeToUse = modeOverride || model.mode;
            track.style.transform = getTrackTransformForMode(modeToUse);
        }

        function setTrackSettled(settled) {
            const track = document.getElementById('switch-track');
            if (!track) return;
            track.classList.toggle('settled', Boolean(settled));
        }

        function armTrackSettle(expectedMode) {
            const track = document.getElementById('switch-track');
            if (!track) {
                setTrackSettled(true);
                return;
            }

            if (switchTrackTransitionHandler) {
                track.removeEventListener('transitionend', switchTrackTransitionHandler);
                switchTrackTransitionHandler = null;
            }

            if (switchTrackTimer) {
                clearTimeout(switchTrackTimer);
            }

            switchTrackTransitionHandler = (event) => {
                if (event.propertyName !== 'transform') return;
                track.removeEventListener('transitionend', switchTrackTransitionHandler);
                switchTrackTransitionHandler = null;

                if (model.mode === expectedMode) {
                    syncTrackTransform(false, expectedMode);
                    setTrackSettled(true);
                }

                if (switchTrackTimer) {
                    clearTimeout(switchTrackTimer);
                    switchTrackTimer = null;
                }
            };

            track.addEventListener('transitionend', switchTrackTransitionHandler);

            // Fallback in case transitionend is skipped during rapid switching.
            switchTrackTimer = setTimeout(() => {
                if (switchTrackTransitionHandler) {
                    track.removeEventListener('transitionend', switchTrackTransitionHandler);
                    switchTrackTransitionHandler = null;
                }

                if (model.mode === expectedMode) {
                    syncTrackTransform(false, expectedMode);
                    setTrackSettled(true);
                }

                switchTrackTimer = null;
            }, 320);
        }

        function enforceShellLayoutIntegrity() {
            const root = document.documentElement;
            if (root.getAttribute('dir') !== 'ltr') {
                root.setAttribute('dir', 'ltr');
            }

            if (document.body) {
                if (document.body.style.direction !== 'ltr') {
                    document.body.style.direction = 'ltr';
                }
                if (document.body.getAttribute('data-mode') !== model.mode) {
                    document.body.setAttribute('data-mode', model.mode);
                }
            }

            const track = document.getElementById('switch-track');
            if (track) {
                const expected = getExpectedTrackTransform();
                if (track.style.transform !== expected) {
                    syncTrackTransform(false);
                } else if (!switchTrackTimer && track.classList.contains('animate')) {
                    track.classList.remove('animate');
                }
                if (!switchTrackTimer && !track.classList.contains('settled')) {
                    setTrackSettled(true);
                }
            }

            updateModeDock();
            updateActivePane();
        }

        function loadEmbeddedApps() {
            frameState.gamesLoaded = false;
            frameState.tvLoaded = false;
            frameState.pendingGamesView = null;
            frameState.pendingTvNavigation = null;
            document.getElementById('games-frame').srcdoc = GAMES_APP_HTML;
            document.getElementById('tv-frame').srcdoc = TV_APP_HTML;
        }

        function navigateGames(view, pageId = null) {
            const safeView = resolveGamesView(view);
            const normalizedStateView = normalizeGamesStateView(safeView);
            const normalizedPageId = safeView === 'featured' && typeof pageId === 'string'
                ? pageId.trim() || null
                : null;
            model.currentGamesView = normalizedStateView;
            model.currentGamesPage = safeView === 'featured' ? normalizedPageId : null;

            if (!frameState.gamesLoaded) {
                frameState.pendingGamesView = {
                    view: safeView,
                    pageId: model.currentGamesPage
                };
                window.onGamesViewChange(normalizedStateView, model.currentGamesPage);
                updateShellTitle();
                return;
            }

            const didNavigate = withFrame('games-frame', (win, doc) => {
                if (safeView === 'gnmath' && typeof win.openGNMath === 'function') {
                    win.openGNMath();
                    return;
                }
                if (typeof win.switchView === 'function') {
                    if (safeView === 'featured' && model.currentGamesPage && typeof win.openFeaturedGameByRouteId === 'function') {
                        win.openFeaturedGameByRouteId(model.currentGamesPage, { updateUrl: false });
                        return;
                    }
                    win.switchView(safeView);
                    return;
                }
                if (typeof win.router === 'function') {
                    win.router(safeView);
                    return;
                }
                const target = doc.getElementById(`view-${safeView}`);
                if (!target) return;
                doc.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
                target.classList.add('active');
            });

            if (!didNavigate) {
                frameState.pendingGamesView = {
                    view: safeView,
                    pageId: model.currentGamesPage
                };
            }

            window.onGamesViewChange(normalizedStateView, model.currentGamesPage);
            updateShellTitle();
        }

        function navigateTv(view, param) {
            const resolved = resolveTvNavigation(view, param);
            const safeView = resolved.view;
            const safeDetails = resolved.details;
            const normalizedStateView = normalizeTvStateView(safeView);

            model.currentTvView = normalizedStateView;
            model.currentTvDetails = normalizedStateView === 'details' ? safeDetails : null;

            if (!frameState.tvLoaded) {
                frameState.pendingTvNavigation = {
                    view: safeView,
                    details: safeDetails
                };
                window.onTvViewChange(normalizedStateView, model.currentTvDetails);
                updateShellTitle();
                return;
            }

            const didNavigate = withFrame('tv-frame', (win, doc) => {
                if (safeView === 'youtube' && typeof win.launchYoutubeTool === 'function') {
                    win.launchYoutubeTool();
                    return;
                }
                if (safeView === 'sports' && typeof win.launchSportsTool === 'function') {
                    win.launchSportsTool();
                    return;
                }
                if (typeof win.router === 'function') {
                    if (safeView === 'details' && safeDetails) {
                        win.router(safeView, safeDetails);
                    } else {
                        win.router(safeView);
                    }
                    return;
                }
                const target = doc.getElementById(`view-${safeView}`);
                if (!target) return;
                doc.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
                target.classList.add('active');
            });

            if (!didNavigate) {
                frameState.pendingTvNavigation = {
                    view: safeView,
                    details: safeDetails
                };
            }

            window.onTvViewChange(normalizedStateView, model.currentTvDetails);
            updateShellTitle();
        }

        window.onGamesViewChange = function (view, pageId) {
            const normalizedView = normalizeGamesStateView(view);
            if (!(validGamesViews.has(normalizedView) || specialGamesViews.has(normalizedView))) return;
            const normalizedPageId = normalizedView === 'featured' && typeof pageId === 'string'
                ? pageId.trim() || null
            : null;
            if (!frameState.gamesLoaded && !isApplyingRoute) {
                // Ignore child-app boot defaults that would overwrite an explicit route like gnmath.
                if (normalizedView === 'home' && model.currentGamesView !== 'home') {
                    return;
                }
                model.currentGamesView = normalizedView;
                model.currentGamesPage = normalizedView === 'featured' ? normalizedPageId : null;
                return;
            }
            const changed = model.currentGamesView !== normalizedView;
            const pageChanged = (model.currentGamesPage || null) !== (normalizedView === 'featured' ? normalizedPageId : null);
            model.currentGamesView = normalizedView;
            model.currentGamesPage = normalizedView === 'featured' ? normalizedPageId : null;
            if (!isApplyingRoute && model.mode === 'games') {
                const route = parseRouteFromUrl();
                const urlOutOfSync =
                    route.mode !== 'games' ||
                    route.gamesView !== normalizedView ||
                    ((route.gamesPage || null) !== (normalizedView === 'featured' ? normalizedPageId : null));
                if (changed || pageChanged || urlOutOfSync) {
                    syncUrlWithState(true);
                }
            }
            updateShellTitle();
        };

        window.onGamesFeaturedPageChange = function (pageId) {
            const normalizedPageId = typeof pageId === 'string' ? pageId.trim() : '';
            const nextPageId = normalizedPageId || null;
            const previousPageId = model.currentGamesPage || null;

            // Keep currentGamesPage in lockstep with game-details routing.
            model.currentGamesPage = nextPageId;

            if (!isApplyingRoute && model.mode === 'games') {
                const route = parseRouteFromUrl();
                const routePage = route.mode === 'games' ? (route.gamesPage || null) : null;
                const pageChanged = previousPageId !== nextPageId;
                const urlOutOfSync = routePage !== nextPageId;

                if (pageChanged || urlOutOfSync) {
                    syncUrlWithState(true);
                }
            }
        };

        window.onTvViewChange = function (view, param) {
            const normalizedView = normalizeTvStateView(view);
            if (!validTvViews.has(normalizedView)) return;

            if (!frameState.tvLoaded && !isApplyingRoute) {
                // Ignore child-app boot defaults that would overwrite explicit routes like sports/youtube.
                if (normalizedView === 'home' && model.currentTvView !== 'home') {
                    return;
                }
                model.currentTvView = normalizedView;
                if (normalizedView === 'details') {
                    model.currentTvDetails = normalizeTvDetails(param) || model.currentTvDetails;
                } else {
                    model.currentTvDetails = null;
                }
                return;
            }

            const previousView = model.currentTvView;
            const previousDetails = model.currentTvDetails;

            model.currentTvView = normalizedView;

            if (normalizedView === 'details') {
                model.currentTvDetails = normalizeTvDetails(param) || model.currentTvDetails;
            } else {
                model.currentTvDetails = null;
            }

            const changed = previousView !== model.currentTvView || !areTvDetailsEqual(previousDetails, model.currentTvDetails);
            if (!isApplyingRoute && model.mode === 'tv') {
                const route = parseRouteFromUrl();
                const urlOutOfSync =
                    route.mode !== 'tv' ||
                    route.tvView !== model.currentTvView ||
                    !areTvDetailsEqual(route.tvDetails, model.currentTvDetails);
                if (changed || urlOutOfSync) {
                    syncUrlWithState(true);
                }
            }
            updateShellTitle();
        };

        function switchMode(targetMode, shouldPush = true) {
            if (!validModes.has(targetMode)) return;
            if (targetMode === model.mode) return;

            const fromMode = model.mode;

            setTrackSettled(false);
            syncTrackTransform(false, fromMode);
            armTrackSettle(targetMode);

            model.mode = targetMode;
            document.body.setAttribute('data-mode', targetMode);
            updateModeDock();
            updateActivePane();

            // Start on a fresh frame so reverse transitions (TV -> Games) animate consistently.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    syncTrackTransform(true, targetMode);
                });
            });

            if (targetMode === 'games') {
                navigateGames(model.currentGamesView, model.currentGamesPage);
            } else {
                navigateTv(model.currentTvView, model.currentTvDetails);
            }

            updateShellTitle();

            if (!isApplyingRoute && shouldPush) {
                syncUrlWithState(true);
            }
        }

        window.switchMode = switchMode;

        function wireEvents() {
            document.querySelectorAll('.mode-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    switchMode(chip.dataset.modeTarget);
                });
            });

            const gamesFrame = document.getElementById('games-frame');
            if (gamesFrame) {
                gamesFrame.addEventListener('load', () => {
                    syncClearCacheToEmbeddedFrames();
                    frameState.gamesLoaded = true;
                    const pendingGamesView = frameState.pendingGamesView;
                    frameState.pendingGamesView = null;
                    if (pendingGamesView && typeof pendingGamesView === 'object') {
                        navigateGames(pendingGamesView.view || model.currentGamesView, pendingGamesView.pageId || null);
                    } else {
                        navigateGames(model.currentGamesView, model.currentGamesPage);
                    }
                });
            }

            const tvFrame = document.getElementById('tv-frame');
            if (tvFrame) {
                tvFrame.addEventListener('load', () => {
                    syncClearCacheToEmbeddedFrames();
                    frameState.tvLoaded = true;
                    const pendingTvNavigation = frameState.pendingTvNavigation;
                    frameState.pendingTvNavigation = null;
                    if (pendingTvNavigation) {
                        navigateTv(pendingTvNavigation.view, pendingTvNavigation.details);
                    } else {
                        navigateTv(model.currentTvView, model.currentTvDetails);
                    }
                });
            }
        }

        function init() {
            const initialRoute = parseRouteFromUrl();
            const shouldUseStoredRoute = !hasExplicitRouteInUrl();
            const storedRoute = shouldUseStoredRoute ? loadRouteSnapshot() : null;
            const resolvedInitialRoute = storedRoute || initialRoute;
            model.mode = resolvedInitialRoute.mode;
            model.currentGamesView = resolvedInitialRoute.gamesView;
            model.currentGamesPage = resolvedInitialRoute.gamesPage || null;
            model.currentTvView = resolvedInitialRoute.tvView;
            model.currentTvDetails = resolvedInitialRoute.tvDetails;

            document.body.setAttribute('data-mode', model.mode);
            syncTrackTransform(false);
            updateShellTitle();
            updateModeDock();
            updateActivePane();
            setTrackSettled(true);
            wireEvents();
            loadEmbeddedApps();
            syncClearCacheToEmbeddedFrames();
            syncUrlWithState(false);
            saveRouteSnapshot();
            showAnnouncementModalIfNeeded();

            window.addEventListener('popstate', () => {
                const route = parseRouteFromUrl();
                applyRouteState(route);
            });

            // Recover shell/nav sync when browser tab focus returns after heavy switching.
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) return;
                enforceShellLayoutIntegrity();

                if (model.mode === 'games') {
                    navigateGames(model.currentGamesView, model.currentGamesPage);
                } else {
                    navigateTv(model.currentTvView, model.currentTvDetails);
                }
            });

            setInterval(enforceShellLayoutIntegrity, 1200);
        }

        init();