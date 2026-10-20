(function () {
  'use strict';
  const key = 'buildbrief-analytics-excluded';
  const url = new URL(location.href);
  const values = url.searchParams.getAll('analytics');
  const action = values.length === 1 && ['off', 'on'].includes(values[0]) ? values[0] : '';
  const automatic = navigator.webdriver === true || url.hostname !== 'buildbrief.moon0sik.cloud';
  let excluded = automatic || action === 'off';
  try {
    if (action === 'off') localStorage.setItem(key, '1');
    if (action === 'on') localStorage.removeItem(key);
    excluded = localStorage.getItem(key) === '1' || excluded;
  } catch {
    excluded = true;
  }
  if (action) {
    url.searchParams.delete('analytics');
    try { history.replaceState(history.state, '', url.href); } catch {}
  }
  if (excluded) {
    // The provider injects its script at the end of body; this synchronous head policy must precede it.
    const policy = document.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "script-src 'self'; connect-src 'none'";
    document.head.appendChild(policy);
  }
  document.documentElement.dataset.analyticsExcluded = String(excluded);
  function showStatus() {
    const status = document.getElementById('analytics-preference-status');
    const exclude = document.getElementById('analytics-exclude');
    const include = document.getElementById('analytics-include');
    if (status) status.textContent = excluded ? '현재 접속은 방문·성능 통계에서 제외하고 있어요.' : '일반 사용자 방문·성능 통계를 수집하고 있어요.';
    if (exclude) exclude.hidden = excluded;
    if (include) include.hidden = !excluded || automatic;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showStatus, { once: true });
  else showStatus();
})();
