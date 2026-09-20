/* Optional first-party integration. No vendor code loads before consent. */
(function () {
  'use strict';
  var config = window.VAULTTAIL_ANALYTICS || {};
  var gaId = /^G-[A-Z0-9]{5,20}$/.test(config.ga4MeasurementId || '') ? config.ga4MeasurementId : '';
  var clarityId = /^[a-z0-9]{5,30}$/.test(config.clarityProjectId || '') ? config.clarityProjectId : '';
  var enabled = Boolean(gaId || clarityId);
  var key = 'vaulttail_analytics_consent_v1';
  var state = null;
  var started = false;
  var banner;
  var previousFocus;
  var scrollSeen = new Set();
  var allowed = new Set(['store_click', 'demo_open', 'demo_play_click', 'gallery_select', 'setup_start', 'setup_folders_selected', 'setup_drive_selected', 'setup_complete', 'setup_backup_demo', 'faq_open', 'support_click', 'scroll_depth']);

  function readChoice() {
    try {
      var value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value && ['granted', 'denied'].includes(value.value) && Date.now() - value.updated < 180 * 86400000) return value.value;
    } catch (_) { /* The site also works when browser storage is disabled. */ }
    return null;
  }
  function cleanLocation() {
    var url = new URL(location.href);
    var clean = new URL(url.origin + url.pathname);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (name) {
      var value = url.searchParams.get(name);
      if (value && /^[a-zA-Z0-9_. -]{1,100}$/.test(value)) clean.searchParams.set(name, value);
    });
    return clean.href;
  }
  function cleanReferrer() {
    try { var url = new URL(document.referrer); return url.origin + url.pathname; }
    catch (_) { return ''; }
  }
  function loadScript(id, url) {
    if (document.getElementById(id)) return;
    var script = document.createElement('script');
    script.id = id; script.async = true; script.src = url;
    document.head.appendChild(script);
  }
  function start() {
    if (!enabled || state !== 'granted' || started) return;
    started = true;
    if (gaId) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window['ga-disable-' + gaId] = false;
      window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      window.gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      window.gtag('js', new Date());
      window.gtag('config', gaId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: cleanLocation(),
        page_referrer: cleanReferrer()
      });
      window.gtag('event', 'page_view', { page_location: cleanLocation(), page_referrer: cleanReferrer(), page_title: document.title });
      loadScript('vaulttail-ga4', 'https://www.googletagmanager.com/gtag/js?id=' + gaId);
    }
    if (clarityId) {
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      window.clarity('consentv2', { analytics_Storage: 'granted', ad_Storage: 'denied' });
      loadScript('vaulttail-clarity', 'https://www.clarity.ms/tag/' + clarityId);
    }
  }
  function track(name, parameters) {
    if (state !== 'granted' || !started || !allowed.has(name)) return;
    var safe = {};
    ['placement', 'label', 'faq_id', 'percent_scrolled'].forEach(function (key) {
      var value = parameters && parameters[key];
      if (typeof value === 'number' || (typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value))) safe[key] = value;
    });
    if (gaId && window.gtag) window.gtag('event', name, Object.assign({ transport_type: 'beacon' }, safe));
    if (clarityId && window.clarity) window.clarity('event', name);
  }
  function clearAnalyticsCookies() {
    var domains = ['', location.hostname, '.' + location.hostname];
    var parts = location.hostname.split('.');
    if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
    document.cookie.split(';').forEach(function (item) {
      var name = item.trim().split('=')[0];
      if (!/^(_ga(?:_|$)|_clck$|_clsk$)/.test(name)) return;
      domains.forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '') + '; SameSite=Lax';
      });
    });
  }
  function choose(value) {
    var wasRunning = started;
    state = value;
    try { localStorage.setItem(key, JSON.stringify({ value: value, updated: Date.now() })); } catch (_) {}
    banner.hidden = true;
    if (value === 'granted') start();
    else if (wasRunning) {
      if (window.gtag) window.gtag('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      if (gaId) window['ga-disable-' + gaId] = true;
      if (window.clarity) window.clarity('consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
      clearAnalyticsCookies();
      // Remove already-loaded vendor code and prevent further collection.
      location.reload();
      return;
    }
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
  }
  function init() {
    if (!enabled) return;
    state = readChoice();
    banner = document.createElement('section');
    banner.className = 'analytics-banner'; banner.setAttribute('aria-label', 'Optional website analytics');
    banner.hidden = true;
    banner.innerHTML = '<div><strong>Help improve VaultTail’s website</strong><p>Allow optional usage analytics and session recordings to understand visits, clicks, and scrolling. This does not give us access to files on your computer. <a href="/website-privacy/">Website privacy</a></p></div><div class="analytics-actions"><button type="button" data-consent="denied">Reject optional</button><button type="button" data-consent="granted">Allow analytics</button></div>';
    document.body.appendChild(banner);
    banner.addEventListener('click', function (event) {
      var target = event.target.closest('[data-consent]');
      if (target) choose(target.dataset.consent);
    });
    document.documentElement.dataset.analyticsEnabled = 'true';
    document.addEventListener('click', function (event) {
      if (!(event.target instanceof Element)) return;
      var settings = event.target.closest('[data-cookie-settings]');
      if (settings) {
        previousFocus = settings; banner.hidden = false;
        banner.querySelector('button').focus(); return;
      }
      var store = event.target.closest('a[data-store-placement]');
      if (store) track('store_click', { placement: store.dataset.storePlacement });
      var button = event.target.closest('[data-analytics-event]');
      if (button && !button.disabled) track(button.dataset.analyticsEvent, { label: button.dataset.analyticsLabel });
      var contact = event.target.closest('a[href^="mailto:"]');
      if (contact) track('support_click', {});
    }, true);
    document.addEventListener('toggle', function (event) {
      var item = event.target;
      if (item instanceof HTMLDetailsElement && item.open && item.dataset.faqId) track('faq_open', { faq_id: item.dataset.faqId });
    }, true);
    var scrollQueued = false;
    document.addEventListener('scroll', function () {
      if (state !== 'granted' || scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(function () {
        scrollQueued = false;
        var height = document.documentElement.scrollHeight;
        if (height <= innerHeight) return;
        var percent = Math.min(100, (scrollY + innerHeight) / height * 100);
        [25, 50, 75, 90].forEach(function (level) {
          if (percent >= level && !scrollSeen.has(level)) {
            scrollSeen.add(level); track('scroll_depth', { percent_scrolled: level });
          }
        });
      });
    }, { passive: true });
    window.addEventListener('storage', function (event) {
      if (event.key === key && state === 'granted' && readChoice() !== 'granted') choose('denied');
    });
    if (state === 'granted') start();
    else if (!state) banner.hidden = false;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
