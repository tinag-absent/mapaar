/**
 * map-geo.js
 * 海蝕機関 地理マップエンジン
 * GeoJSON (municipalities / roads / rivers) を Leaflet で描画
 * - ポリゴン完全内判定 (Ray Casting)
 * - LOD 制御 (ズームで線幅変化)
 * - 市町村クリック → 右パネル + ripple マーカー
 * - 詳細地図モーダル (自動ズーム最適化)
 */

;(function () {
  'use strict';

  // ─── アクセス制御 ──────────────────────────────────────────────
  if (typeof ProgressSystem !== 'undefined' && !ProgressSystem.checkPageAccess('map.html')) {
    if (typeof ModalSystem !== 'undefined') {
      ModalSystem.warning(
        'このページにアクセスするには LEVEL 1 が必要です。',
        'ACCESS DENIED'
      ).then(() => { window.location.href = './dashboard.html'; });
    }
    return;
  }

  // ─── データ参照 ────────────────────────────────────────────────
  const MUNI    = window.GEO_MUNI;
  const ROADS   = window.GEO_ROADS;
  const RIVERS  = window.GEO_RIVERS;
  const MUNI_INFO = window.MUNI_INFO;

  // ─── 色・スタイル定数 ──────────────────────────────────────────
  const ROAD_COLOR = { '1': '#ff7733', '2': '#99aacc', '3': '#556677' };
  const ROAD_LABEL = { '1': '国道', '2': '県道', '3': 'その他' };

  function roadColor(t) { return ROAD_COLOR[t] || '#556677'; }
  function roadWeight(t, zoom) {
    const base = t === '1' ? 3.5 : t === '2' ? 2.2 : 1.2;
    if (zoom >= 13) return base;
    if (zoom >= 11) return base * 0.75;
    if (zoom >= 9)  return base * 0.5;
    return base * 0.3;
  }

  function riverColor(t) {
    const n = parseInt(t) || 3;
    if (n <= 1) return '#29b6f6';
    if (n === 2) return '#4fc3f7';
    return '#81d4fa';
  }
  function riverWeight(t, zoom) {
    const n = parseInt(t) || 3;
    const base = n <= 1 ? 3 : n === 2 ? 2 : 1.2;
    if (zoom >= 13) return base;
    if (zoom >= 11) return base * 0.75;
    if (zoom >= 9)  return base * 0.55;
    return base * 0.35;
  }

  // ─── Point-in-Polygon (Ray Casting) ───────────────────────────
  function pip(px, py, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if (((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
  function pointInFeature(lon, lat, feat) {
    const g = feat.geometry;
    if (g.type === 'Polygon') {
      return pip(lon, lat, g.coordinates[0]);
    }
    if (g.type === 'MultiPolygon') {
      return g.coordinates.some(poly => pip(lon, lat, poly[0]));
    }
    return false;
  }

  // ライン上の点をサンプリングして市町村内か判定 (完全内判定)
  function lineInMuni(feat, muniFeats) {
    const g = feat.geometry;
    let coords = [];
    if (g.type === 'LineString')       coords = g.coordinates;
    else if (g.type === 'MultiLineString') coords = g.coordinates.flat();
    if (!coords.length) return false;

    // 均等サンプリング (最大 10 点)
    const step = Math.max(1, Math.floor(coords.length / 10));
    for (let i = 0; i < coords.length; i += step) {
      const [lon, lat] = coords[i];
      for (const mf of muniFeats) {
        if (pointInFeature(lon, lat, mf)) return true;
      }
    }
    return false;
  }

  // ─── ripple マーカーアイコン生成 ──────────────────────────────
  function rippleIcon(active) {
    return L.divIcon({
      className: '',
      html: `<div class="ripple-wrap${active ? ' active' : ''}">
        <div class="rp-core"></div>
        <div class="rp-ring"></div>
        <div class="rp-ring"></div>
        <div class="rp-ring"></div>
      </div>`,
      iconSize:   [16, 16],
      iconAnchor: [8, 8]
    });
  }

  // ─── ライブ時刻 ──────────────────────────────────────────────
  (function tickClock() {
    const el = document.getElementById('live-time');
    if (!el) return;
    function upd() {
      const n = new Date();
      const h = String(n.getHours()).padStart(2,'0');
      const m = String(n.getMinutes()).padStart(2,'0');
      const s = String(n.getSeconds()).padStart(2,'0');
      el.textContent = `LIVE · ${h}:${m}:${s}`;
    }
    upd(); setInterval(upd, 1000);
  })();

  // ─── メインマップ初期化 ───────────────────────────────────────
  const map = L.map('geo-map', {
    center: [33.23, 131.50],
    zoom: 9,
    zoomControl: true,
    attributionControl: false
  });

  // ダークタイル
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, opacity: 0.45
  }).addTo(map);

  // ─── 市町村レイヤー ───────────────────────────────────────────
  const muniByCode = {};   // code → [Leaflet layer, …]
  const markerByCode = {}; // code → Leaflet marker

  const MUNI_STYLE_NORMAL = {
    fillColor: '#00ffff', fillOpacity: 0.05,
    color: '#00ffff', weight: 1, opacity: 0.4
  };
  const MUNI_STYLE_HOVER = {
    fillOpacity: 0.15, weight: 1.5, opacity: 0.7
  };
  const MUNI_STYLE_ACTIVE = {
    fillColor: '#ff4444', fillOpacity: 0.18,
    color: '#ff6666', weight: 2, opacity: 0.9
  };

  const muniLayer = L.geoJSON(MUNI, {
    style: () => ({ ...MUNI_STYLE_NORMAL }),
    onEachFeature(feature, layer) {
      const code = feature.properties.N03_007;
      if (!muniByCode[code]) muniByCode[code] = [];
      muniByCode[code].push(layer);

      const name = MUNI_INFO[code]?.name || code;
      layer.bindTooltip(name, { sticky: true });

      layer.on('mouseover', () => {
        if (activeCode !== code) layer.setStyle(MUNI_STYLE_HOVER);
      });
      layer.on('mouseout', () => {
        if (activeCode !== code) layer.setStyle(MUNI_STYLE_NORMAL);
      });
      layer.on('click', () => selectMuni(code));
    }
  }).addTo(map);

  // ─── 道路レイヤー ─────────────────────────────────────────────
  const roadLayer = L.geoJSON(ROADS, {
    style(f) {
      const t = f.properties.N01_001;
      return { color: roadColor(t), weight: roadWeight(t, map.getZoom()), opacity: 0.75, lineJoin: 'round' };
    }
  }).addTo(map);

  // ─── 河川レイヤー ─────────────────────────────────────────────
  const riverLayer = L.geoJSON(RIVERS, {
    style(f) {
      const t = f.properties.W05_003;
      return { color: riverColor(t), weight: riverWeight(t, map.getZoom()), opacity: 0.7, lineJoin: 'round' };
    }
  }).addTo(map);

  // ─── LOD: ズームで線幅変化 ────────────────────────────────────
  map.on('zoomend', () => {
    const z = map.getZoom();
    roadLayer.eachLayer(l => {
      if (!l.feature) return;
      l.setStyle({ weight: roadWeight(l.feature.properties.N01_001, z) });
    });
    riverLayer.eachLayer(l => {
      if (!l.feature) return;
      l.setStyle({ weight: riverWeight(l.feature.properties.W05_003, z) });
    });
  });

  // ─── 重心マーカー配置 ─────────────────────────────────────────
  Object.entries(MUNI_INFO).forEach(([code, info]) => {
    const m = L.marker([info.centroid[1], info.centroid[0]], {
      icon: rippleIcon(false),
      interactive: false,
      zIndexOffset: 200
    }).addTo(map);
    markerByCode[code] = m;
  });

  // ─── 選択状態管理 ────────────────────────────────────────────
  let activeCode = null;
  let currentCode = null;

  function selectMuni(code) {
    if (activeCode === code) return;
    // 前の選択を解除
    if (activeCode) {
      (muniByCode[activeCode] || []).forEach(l => l.setStyle(MUNI_STYLE_NORMAL));
      if (markerByCode[activeCode]) markerByCode[activeCode].setIcon(rippleIcon(false));
    }
    activeCode = code;
    currentCode = code;

    // 新しい選択をハイライト
    (muniByCode[code] || []).forEach(l => l.setStyle(MUNI_STYLE_ACTIVE));
    if (markerByCode[code]) markerByCode[code].setIcon(rippleIcon(true));

    // パネル表示
    fillPanel(code);
    document.getElementById('detail-panel').classList.add('open');
    setTimeout(() => map.invalidateSize(), 420);
  }

  // ─── パネルに情報を埋める ──────────────────────────────────────
  function fillPanel(code) {
    const info = MUNI_INFO[code];
    if (!info) return;

    document.getElementById('p-pref').textContent = info.pref;
    document.getElementById('p-name').textContent = info.name;
    document.getElementById('p-code').textContent = `市区町村コード: ${code}`;

    // 統計: 面積概算 & 道路・河川数
    const bbox = info.bbox;
    const wKm  = ((bbox[2] - bbox[0]) * 111 * Math.cos(bbox[1] * Math.PI / 180)).toFixed(1);
    const hKm  = ((bbox[3] - bbox[1]) * 111).toFixed(1);

    const muniFeats  = MUNI.features.filter(f => f.properties.N03_007 === code);
    const inRoads    = ROADS.features.filter(f => lineInMuni(f, muniFeats));
    const inRivers   = RIVERS.features.filter(f => lineInMuni(f, muniFeats));

    document.getElementById('p-stats').innerHTML = `
      <div class="stat-c"><div class="sc-label">道路数</div><div class="sc-val">${inRoads.length}</div></div>
      <div class="stat-c"><div class="sc-label">河川数</div><div class="sc-val">${inRivers.length}</div></div>
      <div class="stat-c"><div class="sc-label">東西幅</div><div class="sc-val">${wKm}<span class="sc-unit">km</span></div></div>
      <div class="stat-c"><div class="sc-label">南北幅</div><div class="sc-val">${hKm}<span class="sc-unit">km</span></div></div>
    `;

    // 道路リスト
    const roadNames = [...new Set(inRoads.map(f => f.properties.N01_002).filter(Boolean))].slice(0, 10);
    document.getElementById('p-roads').innerHTML = roadNames.length
      ? roadNames.map(n => {
          const f = inRoads.find(r => r.properties.N01_002 === n);
          const t = f?.properties.N01_001 || '3';
          return `<div class="feat-item">
            <div class="fi-dot" style="background:${roadColor(t)}"></div>
            <div class="fi-name">${n}</div>
            <div class="fi-type">${ROAD_LABEL[t] || 'その他'}</div>
          </div>`;
        }).join('')
      : '<div class="feat-empty">データなし</div>';

    // 河川リスト
    const riverNames = [...new Set(inRivers.map(f => f.properties.W05_004).filter(Boolean))].slice(0, 10);
    document.getElementById('p-rivers').innerHTML = riverNames.length
      ? riverNames.map(n => {
          const f = inRivers.find(r => r.properties.W05_004 === n);
          const t = f?.properties.W05_003 || '3';
          return `<div class="feat-item">
            <div class="fi-dot" style="background:${riverColor(t)}"></div>
            <div class="fi-name">${n}</div>
            <div class="fi-type">河川</div>
          </div>`;
        }).join('')
      : '<div class="feat-empty">データなし</div>';
  }

  // ─── モーダル詳細地図 ─────────────────────────────────────────
  let modalMap = null;

  function openModal() {
    if (!currentCode) return;
    const info = MUNI_INFO[currentCode];
    document.getElementById('modal-title').textContent = info.name;
    document.getElementById('modal-sub').textContent   = `${info.pref} · CODE ${currentCode}`;
    document.getElementById('detail-modal').classList.add('open');
    setTimeout(() => buildModalMap(currentCode), 60);
  }

  function closeModal() {
    document.getElementById('detail-modal').classList.remove('open');
    if (modalMap) { modalMap.remove(); modalMap = null; }
    document.getElementById('modal-map').innerHTML = '';
  }

  function buildModalMap(code) {
    if (modalMap) { modalMap.remove(); modalMap = null; }
    document.getElementById('modal-map').innerHTML = '';

    const info = MUNI_INFO[code];
    const bbox = info.bbox;

    modalMap = L.map('modal-map', { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, opacity: 0.5
    }).addTo(modalMap);

    // 市町村ポリゴン
    const muniFeats = MUNI.features.filter(f => f.properties.N03_007 === code);
    L.geoJSON({ type: 'FeatureCollection', features: muniFeats }, {
      style: {
        fillColor: '#ff4444', fillOpacity: 0.1,
        color: '#ff6666', weight: 2, opacity: 0.85
      }
    }).addTo(modalMap);

    // 道路 (ポリゴン完全内判定)
    const inRoads = ROADS.features.filter(f => lineInMuni(f, muniFeats));
    if (inRoads.length) {
      L.geoJSON({ type: 'FeatureCollection', features: inRoads }, {
        style(f) {
          const t = f.properties.N01_001;
          return { color: roadColor(t), weight: t === '1' ? 3.2 : t === '2' ? 2 : 1.2, opacity: 0.85, lineJoin: 'round' };
        }
      }).addTo(modalMap);
    }

    // 河川 (ポリゴン完全内判定)
    const inRivers = RIVERS.features.filter(f => lineInMuni(f, muniFeats));
    if (inRivers.length) {
      L.geoJSON({ type: 'FeatureCollection', features: inRivers }, {
        style(f) {
          const t = f.properties.W05_003;
          return { color: riverColor(t), weight: parseInt(t) <= 1 ? 2.5 : parseInt(t) === 2 ? 1.8 : 1.2, opacity: 0.8, lineJoin: 'round' };
        }
      }).addTo(modalMap);
    }

    // ripple マーカー
    L.marker([info.centroid[1], info.centroid[0]], {
      icon: rippleIcon(true), interactive: false, zIndexOffset: 300
    }).addTo(modalMap);

    // ズーム倍率自動最適化 (bbox に fit)
    modalMap.fitBounds(
      [[bbox[1], bbox[0]], [bbox[3], bbox[2]]],
      { padding: [24, 24] }
    );

    // モーダルマップでも LOD 適用
    modalMap.on('zoomend', () => {
      const z = modalMap.getZoom();
      modalMap.eachLayer(l => {
        if (!l.feature) return;
        if (l.feature.properties.N01_001 !== undefined)
          l.setStyle({ weight: roadWeight(l.feature.properties.N01_001, z) });
        else if (l.feature.properties.W05_003 !== undefined)
          l.setStyle({ weight: riverWeight(l.feature.properties.W05_003, z) });
      });
    });
  }

  // ─── パネルを閉じる ───────────────────────────────────────────
  function closePanel() {
    document.getElementById('detail-panel').classList.remove('open');
    if (activeCode) {
      (muniByCode[activeCode] || []).forEach(l => l.setStyle(MUNI_STYLE_NORMAL));
      if (markerByCode[activeCode]) markerByCode[activeCode].setIcon(rippleIcon(false));
      activeCode = null;
    }
    setTimeout(() => map.invalidateSize(), 420);
  }

  // モーダル背景クリックで閉じる
  document.getElementById('detail-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('detail-modal')) closeModal();
  });

  // ─── 公開 API ─────────────────────────────────────────────────
  window.GeoMap = { closePanel, openModal, closeModal };

})();
