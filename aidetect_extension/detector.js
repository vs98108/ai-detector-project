/*
 * Heuristic detector for AI-generated text. This module exposes a global
 * function `detectBlocks` that scans the DOM for large text containers and
 * assigns an AI-likeness score based on features such as sentence length,
 * vocabulary diversity, punctuation variety, stop word ratio, repetition,
 * and character entropy. Blocks with scores above a threshold are returned
 * with their bounding rectangles and labels.
 */

(function() {
  // Clamp a value to the [0,1] range
  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  // Compute repetition measure for 3-word phrases
  function repetition(ws) {
    const n = 3;
    const map = new Map();
    for (let i = 0; i <= ws.length - n; i++) {
      const k = ws.slice(i, i + n).join(" ");
      map.set(k, (map.get(k) || 0) + 1);
    }
    const reps = [...map.values()].filter(v => v > 1);
    const total = [...map.values()].reduce((a, b) => a + b, 0) || 1;
    return reps.reduce((a, b) => a + b, 0) / total;
  }

  // Estimate character-level entropy of a string
  function charEntropy(t) {
    const m = new Map();
    for (const c of t) {
      m.set(c, (m.get(c) || 0) + 1);
    }
    const n = t.length || 1;
    let H = 0;
    for (const v of m.values()) {
      const p = v / n;
      H -= p * Math.log2(p);
    }
    return H;
  }

  // Compute a heuristic AI-likeness score for a block of text
  function aiScore(t) {
    const words = t.toLowerCase().match(/[a-z'][a-z']*/g) || [];
    const sents = t.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const types = new Set(words);
    const len = words.length || 1;

    const typeToken = types.size / len;
    const avgSent = words.length / (sents.length || 1);
    const punctVar = (t.match(/[,:;()]/g) || []).length / len;
    const stop = (t.match(/\b(the|of|and|to|in|that|is|with|as|for|on|it|this|by|from)\b/g) || []).length / len;
    const repet = repetition(words);
    const entropy = charEntropy(t);

    const z =
      clamp01((avgSent - 18) / 12) * 0.25 +
      clamp01(0.25 - typeToken) * 0.25 +
      clamp01(stop - 0.12) * 0.15 +
      clamp01(0.10 - punctVar) * 0.10 +
      clamp01(repet - 0.07) * 0.15 +
      clamp01(0.65 - Math.abs(entropy - 3.9)) * 0.10;
    return z;
  }

  // Scan the page for candidate text blocks and compute AI scores
  window.detectBlocks = function() {
    const MIN_CHARS = 400;
    const selectors = [
      "article",
      "main",
      "p",
      "div[role='article']",
      ".content",
      ".post",
      ".entry",
      ".markdown",
      ".ProseMirror"
    ];
    const candidates = [...document.querySelectorAll(selectors.join(","))].filter((el) => {
      const text = (el.innerText || "").trim();
      return text.length >= MIN_CHARS;
    });

    return candidates
      .map((el) => {
        const txt = el.innerText.replace(/\s+/g, " ").trim();
        const score = aiScore(txt);
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left,
          y: rect.top,
          w: rect.width,
          h: rect.height,
          score,
          label: score >= 0.6 ? "AI?" : "Low"
        };
      })
      .filter((b) => b.score >= 0.5);
  };
})();
