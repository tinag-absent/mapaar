// ── Bookmark helper (shared across detail pages) ──────────────────────────
var BookmarkSystem = (function() {
  var KEY = 'kaishoku_bookmarks';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch(e) { return []; }
  }
  function save(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }
  function isBookmarked(type, id) { return load().some(function(b){ return b._type===type && b.id===id; }); }

  function toggle(type, id, name) {
    var bms = load();
    var idx = bms.findIndex(function(b){ return b._type===type && b.id===id; });
    if (idx >= 0) bms.splice(idx, 1);
    else bms.unshift({ _type:type, id:id, name:name, savedAt:Date.now() });
    save(bms);
    updateBtn(type, id);
  }

  function updateBtn(type, id) {
    var saved = isBookmarked(type, id);
    document.querySelectorAll('.detail-bm-btn[data-bm-type="'+type+'"][data-bm-id="'+id+'"]')
      .forEach(function(btn) {
        btn.classList.toggle('saved', saved);
        btn.querySelector('.bm-star-char').textContent = saved ? '★' : '☆';
        btn.querySelector('.bm-label').textContent     = saved ? 'ブックマーク解除' : 'ブックマーク';
        btn.title = saved ? 'ブックマーク解除' : 'ブックマークに追加';
      });
  }

  function render(type, id, name) {
    var saved = isBookmarked(type, id);
    var btn = document.createElement('button');
    btn.className    = 'detail-bm-btn' + (saved ? ' saved' : '');
    btn.title        = saved ? 'ブックマーク解除' : 'ブックマークに追加';
    btn.setAttribute('data-bm-type', type);
    btn.setAttribute('data-bm-id',   id);
    btn.innerHTML    = '<span class="bm-star-char">' + (saved?'★':'☆') + '</span>'
                     + '<span class="bm-label">'     + (saved?'ブックマーク解除':'ブックマーク') + '</span>';
    btn.addEventListener('click', function(){ toggle(type, id, name); });
    return btn;
  }

  return { toggle:toggle, isBookmarked:isBookmarked, render:render };
})();
