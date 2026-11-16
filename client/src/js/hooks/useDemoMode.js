/**
 * Whether the site is the portfolio demo, read once from GET /api/demo and kept for the whole session
 * of the page. No Redux slice: it is a fact about the server that never changes while the page lives.
 *
 * Until the answer arrives, and when it cannot be read, the site behaves as the real store: the demo
 * banner and the demo checkout appear only on a positive answer. The server is what enforces the demo
 * (it refuses real customer data and uploads), so this only chooses what to show.
 */
import { useState, useEffect } from 'react';
import { getDemoInfo } from '../services/demoService';

const NOT_DEMO = { demo: false, identities: [] };

let answer = null;   // the settled answer, once known
let pending = null;  // the request in flight

/** Reads the answer once per page load; a failed read is forgotten so the next mount can try again. */
function readDemoInfo() {
  if (answer) return Promise.resolve(answer);
  if (!pending) {
    pending = getDemoInfo()
      .then((info) => {
        answer = { demo: info?.demo === true, identities: Array.isArray(info?.identities) ? info.identities : [] };
        return answer;
      })
      .catch(() => {
        pending = null;
        return NOT_DEMO;
      });
  }
  return pending;
}

/** Forgets the stored answer. Used by the tests only. */
export function resetDemoModeForTests() {
  answer = null;
  pending = null;
}

/** Returns { demo, identities }: { demo: false } until the server says otherwise. */
export function useDemoMode() {
  const [info, setInfo] = useState(answer || NOT_DEMO);

  useEffect(() => {
    let cancelled = false;
    readDemoInfo().then((next) => { if (!cancelled) setInfo(next); });
    return () => { cancelled = true; };
  }, []);

  return info;
}
