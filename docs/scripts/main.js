let debug = false;
    let lsDebugGrid = false;
    let lsOverlayGrid = false;
    let lsTileDebugEnabled = false;
    let lsTileDebugBorders = true;
    let lsTileDebugZ = 3;
    let lsTileDebugOpacity = 1;
    let cayoTileDebugEnabled = false;
    let cayoTileDebugBorders = true;
    let cayoTileDebugZ = 7;
    let cayoTileDebugOpacity = 1;
    let tileDebugPanelVisible = false;
    let activeShapeId = null;
    let activeTool = null;
    let editScope = "none"; // none | global | single
    let scopedEditLayerId = null;
    let lastRmbStamp = 0;
    let isRightMouseDown = false;
    let isMiddleMouseDown = false;
    let middlePanLastPoint = null;
    let tileDebugHotkeyBuffer = "";
    const TILE_DEBUG_STORAGE_KEY = "polyzonecreator.tileDebug.v2";
    const LS_TILE_DEBUG_DEFAULTS = { enabled: false, borders: true, z: 3, opacity: 1 };
    const CAYO_TILE_DEBUG_DEFAULTS = { enabled: false, borders: true, z: 7, opacity: 1 };

    const COORD_PRECISION = 2;
    const CIRCLE_RADIUS_SCALE = 1.5;
    const mapMinZoom = 0;
    const mapMaxZoom = 7;
    const mapMaxResolution = 0.25;
    const mapMinResolution = Math.pow(2, mapMaxZoom) * mapMaxResolution;
    const mapCenterLat = -5525;
    const mapCenterLng = 3755;
    const gtaOffset = 0.66;
    const worldBounds = [[-10240, 0], [0, 8192]];
    const lsBounds = [[-8192, 0], [0, 8192]];
    const worldMinLat = worldBounds[0][0];
    const worldMaxLat = worldBounds[1][0];
    const worldMinLng = worldBounds[0][1];
    const worldMaxLng = worldBounds[1][1];
    const cayoBounds = [
      [mapCenterLat + (-6150 * gtaOffset), mapCenterLng + (3700 * gtaOffset)],
      [mapCenterLat + (-4150 * gtaOffset), mapCenterLng + (5700 * gtaOffset)],
    ];
    const cayoMapConfig = {
      maxZoom: 6,
      image: [10000, 10000],
      topLeft: [3700, -4150],
      bottomRight: [5700, -6150],
      tileSize: 128,
      tileScaleFactor: 0.5,
    };
    const cayoTileRanges = {
      2: { xMin: 0, xMax: 0, yMin: 0, yMax: 0 },
      4: { xMin: 0, xMax: 2, yMin: 0, yMax: 2 },
      5: { xMin: 0, xMax: 4, yMin: 0, yMax: 4 },
      6: { xMin: 0, xMax: 9, yMin: 0, yMax: 9 },
      7: { xMin: 0, xMax: 19, yMin: 0, yMax: 19 },
    };
    const cayoTileExtensions = {
      2: "png",
      4: "png",
      5: "jpg",
      6: "jpg",
      7: "jpg",
    };
    const cayoTileSourceZoom = {
      2: 0,
      4: 1,
      5: 3,
      6: 4,
      7: 5,
    };
    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
    function normalizeCayoDebugZ(z) {
      const allowed = Object.keys(cayoTileRanges).map((k) => Number(k)).sort((a, b) => a - b);
      if (!allowed.length) return CAYO_TILE_DEBUG_DEFAULTS.z;
      if (allowed.includes(z)) return z;
      return allowed[allowed.length - 1];
    }
    function saveTileDebugSettings() {
      try {
        localStorage.setItem(TILE_DEBUG_STORAGE_KEY, JSON.stringify({
          panelVisible: tileDebugPanelVisible,
          ls: {
            enabled: lsTileDebugEnabled,
            borders: lsTileDebugBorders,
            z: lsTileDebugZ,
            opacity: lsTileDebugOpacity,
          },
          cayo: {
            enabled: cayoTileDebugEnabled,
            borders: cayoTileDebugBorders,
            z: cayoTileDebugZ,
            opacity: cayoTileDebugOpacity,
          },
        }));
      } catch (e) {
        void e;
      }
    }
    function loadTileDebugSettings() {
      try {
        const raw = localStorage.getItem(TILE_DEBUG_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        tileDebugPanelVisible = !!parsed?.panelVisible;
        if (parsed?.ls) {
          lsTileDebugEnabled = !!parsed.ls.enabled;
          lsTileDebugBorders = parsed.ls.borders !== false;
          lsTileDebugZ = clamp(Number(parsed.ls.z) || LS_TILE_DEBUG_DEFAULTS.z, mapMinZoom, mapMaxZoom);
          lsTileDebugOpacity = clamp(Number(parsed.ls.opacity) || LS_TILE_DEBUG_DEFAULTS.opacity, 0.1, 1);
        }
        if (parsed?.cayo) {
          cayoTileDebugEnabled = !!parsed.cayo.enabled;
          cayoTileDebugBorders = parsed.cayo.borders !== false;
          cayoTileDebugZ = normalizeCayoDebugZ(Number(parsed.cayo.z) || CAYO_TILE_DEBUG_DEFAULTS.z);
          cayoTileDebugOpacity = clamp(Number(parsed.cayo.opacity) || CAYO_TILE_DEBUG_DEFAULTS.opacity, 0.1, 1);
        }
      } catch (e) {
        void e;
      }
    }
    loadTileDebugSettings();
    const defaultZoneNames = {
      polygon: "многоугольник хуй пойми для чего (вот бы имена давать)",
      rectangle: "прямоугольник хуй пойми для чего (вот бы имена давать)",
      circle: "круг хуй пойми для чего (вот бы имена давать)",
      marker: "маркер хуй пойми для чего (вот бы имена давать)",
    };
    const zonePathStyle = {
      color: "#c4a9ff",
      weight: 3,
      opacity: 0.95,
      fillColor: "#7e5ff0",
      fillOpacity: 0.28,
    };
    const zonePointIcon = L.divIcon({
      className: "zone-point-icon",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -7],
    });

    function gid(id) { return document.getElementById(id); }
    function getDefaultZoneName(type) {
      return defaultZoneNames[type] || "zone_maaximgl";
    }

    function gtaToLatLng(x, y) {
      return [mapCenterLat + (y * gtaOffset), mapCenterLng + (x * gtaOffset)];
    }

    function getCayoSourceZoom(z) {
      return cayoTileSourceZoom[z] !== undefined ? cayoTileSourceZoom[z] : z;
    }
    function getLegacyCayoTileBounds(z, x, y) {
      const zoomFactor = Math.pow(2, z - cayoMapConfig.maxZoom);
      const totalPxX = cayoMapConfig.image[0] * cayoMapConfig.tileScaleFactor * zoomFactor;
      const totalPxY = cayoMapConfig.image[1] * cayoMapConfig.tileScaleFactor * zoomFactor;

      const pxLeft = x * cayoMapConfig.tileSize;
      const pxRight = (x + 1) * cayoMapConfig.tileSize;
      const pxTop = y * cayoMapConfig.tileSize;
      const pxBottom = (y + 1) * cayoMapConfig.tileSize;

      const spanX = cayoMapConfig.topLeft[0] - cayoMapConfig.bottomRight[0];
      const spanY = cayoMapConfig.topLeft[1] - cayoMapConfig.bottomRight[1];

      const gtaLeft = cayoMapConfig.topLeft[0] - (spanX * (pxLeft / totalPxX));
      const gtaRight = cayoMapConfig.topLeft[0] - (spanX * (pxRight / totalPxX));
      const gtaTop = cayoMapConfig.topLeft[1] - (spanY * (pxTop / totalPxY));
      const gtaBottom = cayoMapConfig.topLeft[1] - (spanY * (pxBottom / totalPxY));

      const nw = gtaToLatLng(gtaLeft, gtaTop);
      const se = gtaToLatLng(gtaRight, gtaBottom);
      return [[se[0], nw[1]], [nw[0], se[1]]];
    }
    let cayoReferenceFrameBounds = null;
    function getCayoReferenceFrameBounds() {
      if (cayoReferenceFrameBounds) return cayoReferenceFrameBounds;

      const refZoom = cayoTileRanges[7] ? 7 : Math.max(...Object.keys(cayoTileRanges).map((k) => Number(k)));
      const range = cayoTileRanges[refZoom];
      if (!range) return cayoBounds;

      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (let tx = range.xMin; tx <= range.xMax; tx++) {
        for (let ty = range.yMin; ty <= range.yMax; ty++) {
          const b = getLegacyCayoTileBounds(getCayoSourceZoom(refZoom), tx, ty);
          minLat = Math.min(minLat, b[0][0]);
          maxLat = Math.max(maxLat, b[1][0]);
          minLng = Math.min(minLng, b[0][1]);
          maxLng = Math.max(maxLng, b[1][1]);
        }
      }
      if (!Number.isFinite(minLat) || !Number.isFinite(maxLat) || !Number.isFinite(minLng) || !Number.isFinite(maxLng)) {
        return cayoBounds;
      }
      cayoReferenceFrameBounds = [[minLat, minLng], [maxLat, maxLng]];
      return cayoReferenceFrameBounds;
    }
    function getLsDisplayBounds() {
      const cayoFrame = getCayoReferenceFrameBounds();
      const rawMinLat = Math.min(lsBounds[0][0], cayoFrame[0][0]);
      const gridStep = 1024; // keep LS debug/overlay ending on full grid cells
      const alignedMinLat = worldMinLat + (Math.floor((rawMinLat - worldMinLat) / gridStep) * gridStep);
      return [[alignedMinLat, lsBounds[0][1]], [lsBounds[1][0], lsBounds[1][1]]];
    }
    function getCayoTileBounds(z, x, y) {
      if (z === 2 || z === 4) {
        const range = cayoTileRanges[z];
        const frame = getCayoReferenceFrameBounds();
        if (!range) return frame;

        const cols = range.xMax - range.xMin + 1;
        const rows = range.yMax - range.yMin + 1;
        const frameMinLat = frame[0][0];
        const frameMaxLat = frame[1][0];
        const frameMinLng = frame[0][1];
        const frameMaxLng = frame[1][1];
        const latStep = (frameMaxLat - frameMinLat) / rows;
        const lngStep = (frameMaxLng - frameMinLng) / cols;

        const xi = x - range.xMin;
        const yi = y - range.yMin;
        const minLng = frameMinLng + (xi * lngStep);
        const maxLng = frameMinLng + ((xi + 1) * lngStep);
        const maxLat = frameMaxLat - (yi * latStep);
        const minLat = frameMaxLat - ((yi + 1) * latStep);
        return [[minLat, minLng], [maxLat, maxLng]];
      }
      return getLegacyCayoTileBounds(getCayoSourceZoom(z), x, y);
    }
    function getCayoTileUrl(z, x, y) {
      const ext = cayoTileExtensions[z] || "jpg";
      return `ui/map/tiles/cayoperico/${z}/${x}/${y}.${ext}`;
    }
    function getCayoCoverageBounds(zoomLevel) {
      const range = cayoTileRanges[zoomLevel];
      if (!range) return cayoBounds;

      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;

      for (let x = range.xMin; x <= range.xMax; x++) {
        for (let y = range.yMin; y <= range.yMax; y++) {
          const b = getCayoTileBounds(zoomLevel, x, y);
          minLat = Math.min(minLat, b[0][0]);
          maxLat = Math.max(maxLat, b[1][0]);
          minLng = Math.min(minLng, b[0][1]);
          maxLng = Math.max(maxLng, b[1][1]);
        }
      }

      if (!Number.isFinite(minLat) || !Number.isFinite(maxLat) || !Number.isFinite(minLng) || !Number.isFinite(maxLng)) {
        return cayoBounds;
      }
      return [[minLat, minLng], [maxLat, maxLng]];
    }

    const ui = {
      submenuTitle: gid("submenuTitle"),
      cursorCoordBar: gid("cursorCoordBar"),
      drawMeasureBubble: gid("drawMeasureBubble"),
      project: gid("project"),
      shapeSub: gid("shapeSub"),
      shapes: gid("shapes"),
      actions: gid("panelActions"),
      output: gid("panelOutput"),
      settings: gid("panelSettings"),
      gridControls: gid("gridControls"),
    };

    const crs = L.CRS.Simple;
    crs.scale = (z) => Math.pow(2, z) / mapMinResolution;

    const base = L.tileLayer("ui/map/tiles/lossantos/{z}/{x}/{y}.png", {
      minZoom: mapMinZoom,
      maxZoom: mapMaxZoom,
      noWrap: true,
      tms: true,
      bounds: worldBounds,
    });

    const cayoRenderBaseZoom = 7;
    const initialMapZoom = 3;
    const cayoSatelliteLayersByZoom = {};
    function getCayoZoomForLsZoom(lsZoom) {
      if (lsZoom >= 7) return 7;
      if (lsZoom >= 6) return 6;
      if (lsZoom >= 5) return 5;
      if (lsZoom >= 4) return 4;
      return 2;
    }
    function buildCayoRenderLayer(zoomLevel) {
      const layer = L.featureGroup();
      const range = cayoTileRanges[zoomLevel];
      if (!range) return layer;

      for (let x = range.xMin; x <= range.xMax; x++) {
        for (let y = range.yMin; y <= range.yMax; y++) {
          const bounds = getCayoTileBounds(zoomLevel, x, y);
          const url = getCayoTileUrl(zoomLevel, x, y);
          L.imageOverlay(url, bounds, { opacity: 1, interactive: false }).addTo(layer);
        }
      }

      return layer;
    }
    function getCayoSatelliteLayerForZoom(zoomLevel) {
      if (!cayoSatelliteLayersByZoom[zoomLevel]) {
        cayoSatelliteLayersByZoom[zoomLevel] = buildCayoRenderLayer(zoomLevel);
      }
      return cayoSatelliteLayersByZoom[zoomLevel];
    }

    function bringLayerToFront(layer) {
      if (!layer) return;
      if (typeof layer.bringToFront === "function") {
        layer.bringToFront();
        return;
      }
      if (typeof layer.eachLayer === "function") {
        layer.eachLayer((child) => {
          if (child && typeof child.bringToFront === "function") child.bringToFront();
        });
      }
    }

    let cayoSatelliteLayer = getCayoSatelliteLayerForZoom(getCayoZoomForLsZoom(initialMapZoom));

    const map = new L.Map("map1", {
      maxZoom: mapMaxZoom,
      minZoom: mapMinZoom,
      zoomControl: false,
      attributionControl: false,
      layers: [base, cayoSatelliteLayer],
      crs: crs,
      center: [mapCenterLat, mapCenterLng],
      zoom: initialMapZoom,
    });
    const overlayGridLayer = L.layerGroup();
    const debugGridLayer = L.layerGroup();
    const cayoTileDebugLayer = L.layerGroup();
    let lsTileDebugLayer = null;
    const lsTileDebugBorderLayer = L.layerGroup();
    function getActiveCayoZoom() {
      return getCayoZoomForLsZoom(map.getZoom());
    }
    function ensureCayoSatelliteLayer() {
      const targetZoom = getActiveCayoZoom();
      const targetLayer = getCayoSatelliteLayerForZoom(targetZoom);
      if (cayoSatelliteLayer && cayoSatelliteLayer !== targetLayer) {
        map.removeLayer(cayoSatelliteLayer);
      }
      cayoSatelliteLayer = targetLayer;
      return cayoSatelliteLayer;
    }

    L.Draw.Circle = L.Draw.SimpleShape.extend({
      statics: { TYPE: "circle" },
      options: {
        shapeOptions: {
          stroke: true, color: "#3388ff", weight: 4, opacity: 0.5, fill: true, fillColor: null, fillOpacity: 0.2, clickable: true,
        },
        showRadius: true, metric: true, feet: true, nautic: false,
      },
      initialize: function (m, o) {
        this.type = L.Draw.Circle.TYPE;
        this._initialLabelText = L.drawLocal.draw.handlers.circle.tooltip.start;
        L.Draw.SimpleShape.prototype.initialize.call(this, m, o);
      },
      _drawShape: function (latlng) {
        const out = latlngToGTA(latlng);
        const inn = latlngToGTA(this._startLatLng);
        const dist = Math.hypot(inn[0] - out[0], inn[1] - out[1]);
        if (!this._shape) {
          this._shape = new L.Circle(this._startLatLng, dist, this.options.shapeOptions);
          this._map.addLayer(this._shape);
        } else {
          this._shape.setRadius(dist);
        }
      },
      _fireCreatedEvent: function () {
        const c = new L.Circle(this._startLatLng, this._shape.getRadius(), this.options.shapeOptions);
        L.Draw.SimpleShape.prototype._fireCreatedEvent.call(this, c);
      },
    });

    L.Edit.CircleMarker = L.Edit.Circle.extend({
      _resize: function (latlng) {
        const out = latlngToGTA(latlng);
        const inn = latlngToGTA(this._startLatLng);
        const dist = Math.hypot(inn[0] - out[0], inn[1] - out[1]);
        this._shape.setRadius(dist);
        this._map.fire(L.Draw.Event.EDITRESIZE, { layer: this._shape });
      },
    });
    function isPrimaryMouseButtonEvent(evt) {
      const oe = (evt && evt.originalEvent) || evt;
      if (!oe) return true;
      const eventType = typeof oe.type === "string" ? oe.type : "";
      if (eventType.startsWith("touch")) return true;
      if (typeof oe.buttons === "number" && oe.buttons !== 0) return (oe.buttons & 1) === 1;
      if (typeof oe.which === "number" && oe.which !== 0) return oe.which === 1;
      if (typeof oe.button === "number") {
        if (oe.button === 0) return true;
        if (oe.button === 1 && (typeof oe.which !== "number" || oe.which === 1)) return true; // legacy left button
        return false;
      }
      return true;
    }
    const originalPolylineEndPoint = L.Draw.Polyline.prototype._endPoint;
    L.Draw.Polyline.prototype._endPoint = function (x, y, evt) {
      if (!isPrimaryMouseButtonEvent(evt)) {
        if (typeof this._enableNewMarkers === "function") this._enableNewMarkers();
        this._disableMarkers = false;
        this._mouseDownOrigin = null;
        this._clickHandled = null;
        this._touchHandled = null;
        return;
      }
      return originalPolylineEndPoint.call(this, x, y, evt);
    };
    const originalSimpleShapeMouseDown = L.Draw.SimpleShape.prototype._onMouseDown;
    const originalSimpleShapeMouseUp = L.Draw.SimpleShape.prototype._onMouseUp;
    L.Draw.SimpleShape.prototype._onMouseDown = function (evt) {
      if (!isPrimaryMouseButtonEvent(evt)) return;
      return originalSimpleShapeMouseDown.call(this, evt);
    };
    L.Draw.SimpleShape.prototype._onMouseUp = function (evt) {
      if (!isPrimaryMouseButtonEvent(evt)) return;
      return originalSimpleShapeMouseUp.call(this, evt);
    };

    const editableLayers = L.featureGroup();
    map.addLayer(editableLayers);
    const drawControl = new L.Control.Draw({
      position: "topright",
      draw: {
        polyline: false,
        circlemarker: false,
        polygon: { shapeOptions: zonePathStyle },
        rectangle: { shapeOptions: zonePathStyle },
        circle: { shapeOptions: zonePathStyle },
        marker: { icon: zonePointIcon },
      },
      edit: { featureGroup: editableLayers },
    });
    map.addControl(drawControl);

    const drawHandlers = {
      polygon: new L.Draw.Polygon(map, drawControl.options.draw.polygon),
      circle: new L.Draw.Circle(map, drawControl.options.draw.circle),
      rectangle: new L.Draw.Rectangle(map, drawControl.options.draw.rectangle),
      marker: new L.Draw.Marker(map, drawControl.options.draw.marker),
    };
    const editHandlers = {
      edit: new L.EditToolbar.Edit(map, { featureGroup: editableLayers }),
      remove: new L.EditToolbar.Delete(map, { featureGroup: editableLayers }),
    };
    function isCreateToolActive() {
      return !!activeTool && Object.prototype.hasOwnProperty.call(drawHandlers, activeTool);
    }
    function syncMapDraggingState() {
      if (!map.dragging) return;
      if (isRightMouseDown || (isCreateToolActive() && !isMiddleMouseDown)) {
        if (map.dragging.enabled()) map.dragging.disable();
      } else if (!map.dragging.enabled()) {
        map.dragging.enable();
      }
    }
    function consumeMouseEvent(e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    }

    function applyZoneStyle(layer) {
      if (!layer) return;
      if (layer instanceof L.Marker && !(layer instanceof L.CircleMarker)) {
        layer.setIcon(zonePointIcon);
        return;
      }
      if (layer instanceof L.Path) {
        layer.setStyle(zonePathStyle);
      }
    }

    function clearSingleLayerEdit() {
      editableLayers.getLayers().forEach((l) => {
        if (l.editing && l.editing.enabled && l.editing.enabled()) {
          l.editing.disable();
        }
      });
      if (editScope === "single") {
        editScope = "none";
        scopedEditLayerId = null;
      }
    }

    function clearGlobalEdit(commitChanges = true) {
      if (editHandlers.edit.enabled()) {
        if (commitChanges) editHandlers.edit.save();
        editHandlers.edit.disable();
      }
      if (editScope === "global") {
        editScope = "none";
        scopedEditLayerId = null;
      }
    }

    function disableAllTools(commitChanges = true) {
      if (commitChanges) {
        if (editHandlers.edit.enabled()) editHandlers.edit.save();
        if (editHandlers.remove.enabled() && typeof editHandlers.remove.save === "function") editHandlers.remove.save();
      }
      Object.values(drawHandlers).forEach((h) => h.disable());
      editHandlers.remove.disable();
      clearGlobalEdit(false);
      clearSingleLayerEdit();
      editScope = "none";
      scopedEditLayerId = null;
      syncMapDraggingState();
    }

    function activateTool(toolName) {
      if (activeTool === toolName) {
        disableAllTools();
        activeTool = null;
        refreshActions();
        return;
      }
      disableAllTools();
      const h = drawHandlers[toolName] || editHandlers[toolName];
      if (!h) return;
      h.enable();
      activeTool = toolName;
      syncMapDraggingState();
      refreshActions();
    }

    function toggleGlobalEdit() {
      if (editScope === "global") {
        clearGlobalEdit(true);
        refresh();
        return;
      }
      disableAllTools(true);
      clearSingleLayerEdit();
      editHandlers.edit.enable();
      editScope = "global";
      scopedEditLayerId = null;
      refresh();
    }

    function toggleScopedEdit(layerId) {
      const layer = getLayerById(layerId);
      if (!layer) return;

      if (editScope === "single" && scopedEditLayerId === layerId) {
        clearSingleLayerEdit();
        refresh();
        return;
      }

      disableAllTools(true);
      clearGlobalEdit(false);
      clearSingleLayerEdit();

      if (layer.editing && typeof layer.editing.enable === "function") {
        layer.editing.enable();
        editScope = "single";
        scopedEditLayerId = layerId;
      }
      refresh();
    }

    function latlngToGTA(ll) {
      return [
        Number(((ll.lng - mapCenterLng) / gtaOffset).toFixed(COORD_PRECISION)),
        Number(((ll.lat - mapCenterLat) / gtaOffset).toFixed(COORD_PRECISION)),
      ];
    }
    function getRoundedCircleRadius(radius) {
      return Number((Number(radius) || 0).toFixed(COORD_PRECISION));
    }
    function formatRoundedCircleRadius(radius) {
      return getRoundedCircleRadius(radius).toFixed(COORD_PRECISION);
    }
    function getRoundedCircleRadiusGTA(circle) {
      return getRoundedCircleRadius((circle?.getRadius?.() || 0) * CIRCLE_RADIUS_SCALE);
    }
    function formatRoundedCircleRadiusGTA(circle) {
      return getRoundedCircleRadiusGTA(circle).toFixed(COORD_PRECISION);
    }
    function updateCursorCoordBar(latlng) {
      if (!ui.cursorCoordBar || !latlng) return;
      const p = latlngToGTA(latlng);
      ui.cursorCoordBar.textContent = `X: ${p[0].toFixed(COORD_PRECISION)} | Y: ${p[1].toFixed(COORD_PRECISION)}`;
    }
    function hideDrawMeasureBubble() {
      if (!ui.drawMeasureBubble) return;
      ui.drawMeasureBubble.classList.add("hidden");
    }
    function showDrawMeasureBubble(clientX, clientY, text) {
      if (!ui.drawMeasureBubble) return;
      ui.drawMeasureBubble.textContent = text;
      ui.drawMeasureBubble.style.left = `${clientX}px`;
      ui.drawMeasureBubble.style.top = `${clientY}px`;
      ui.drawMeasureBubble.classList.remove("hidden");
    }
    function updateDrawMeasureBubble(e) {
      if (!ui.drawMeasureBubble || !e || !e.latlng || !e.originalEvent) return;

      if (activeTool === "circle") {
        const handler = drawHandlers.circle;
        const shape = handler && handler._shape;
        if (handler && handler._isDrawing && shape) {
          showDrawMeasureBubble(e.originalEvent.clientX, e.originalEvent.clientY, `R: ${formatRoundedCircleRadius(shape.getRadius())}`);
          return;
        }
      }

      if (activeTool === "rectangle") {
        const handler = drawHandlers.rectangle;
        const shape = handler && handler._shape;
        if (handler && handler._isDrawing && shape && typeof shape.getBounds === "function") {
          const b = shape.getBounds();
          const sw = latlngToGTA(b.getSouthWest());
          const ne = latlngToGTA(b.getNorthEast());
          const area = Math.abs((ne[0] - sw[0]) * (ne[1] - sw[1]));
          showDrawMeasureBubble(e.originalEvent.clientX, e.originalEvent.clientY, `A: ${area.toFixed(COORD_PRECISION)}`);
          return;
        }
      }

      hideDrawMeasureBubble();
    }

    function buildGrid(layer, options) {
      const bounds = options.bounds || worldBounds;
      const minLat = bounds[0][0];
      const maxLat = bounds[1][0];
      const minLng = bounds[0][1];
      const maxLng = bounds[1][1];
      const lineStep = options.lineStep;
      const labelStep = options.labelStep || lineStep;
      const originLat = Number.isFinite(options.originLat) ? options.originLat : minLat;
      const originLng = Number.isFinite(options.originLng) ? options.originLng : minLng;
      const snapStart = (min, step, origin) => origin + (Math.ceil((min - origin) / step) * step);
      layer.clearLayers();

      for (let lng = snapStart(minLng, lineStep, originLng); lng <= maxLng + 1e-6; lng += lineStep) {
        L.polyline([[minLat, lng], [maxLat, lng]], {
          color: options.color,
          weight: options.weight,
          opacity: options.opacity,
          interactive: false,
        }).addTo(layer);
      }

      for (let lat = snapStart(minLat, lineStep, originLat); lat <= maxLat + 1e-6; lat += lineStep) {
        L.polyline([[lat, minLng], [lat, maxLng]], {
          color: options.color,
          weight: options.weight,
          opacity: options.opacity,
          interactive: false,
        }).addTo(layer);
      }

      if (!options.withLabels) return;

      for (let lat = snapStart(minLat, labelStep, originLat); lat <= maxLat + 1e-6; lat += labelStep) {
        for (let lng = snapStart(minLng, labelStep, originLng); lng <= maxLng + 1e-6; lng += labelStep) {
          const gta = latlngToGTA({ lat, lng });
          L.marker([lat, lng], {
            interactive: false,
            icon: L.divIcon({
              className: "dbg-label",
              html: `${gta[0]}, ${gta[1]}`,
              iconSize: [1, 1],
              iconAnchor: [-2, -2],
            }),
          }).addTo(layer);
        }
      }
    }

    function setDebugGrid() {
      buildGrid(debugGridLayer, {
        bounds: getLsDisplayBounds(),
        lineStep: 1024,
        labelStep: 1024,
        originLat: worldMinLat,
        originLng: worldMinLng,
        color: "#b38bff",
        weight: 1,
        opacity: 0.5,
        withLabels: true,
      });
      if (lsDebugGrid) map.addLayer(debugGridLayer);
      else map.removeLayer(debugGridLayer);
      debug = lsDebugGrid;
    }

    function setOverlay() {
      buildGrid(overlayGridLayer, {
        bounds: getLsDisplayBounds(),
        lineStep: 512,
        originLat: worldMinLat,
        originLng: worldMinLng,
        color: "#7f5be3",
        weight: 1,
        opacity: 0.35,
        withLabels: false,
      });
      if (lsOverlayGrid) map.addLayer(overlayGridLayer);
      else map.removeLayer(overlayGridLayer);
    }

    function setCayoLayers() {
      if (cayoTileDebugEnabled) {
        if (cayoSatelliteLayer) map.removeLayer(cayoSatelliteLayer);
        map.addLayer(cayoTileDebugLayer);
        bringLayerToFront(cayoTileDebugLayer);
        return;
      }
      const activeLayer = ensureCayoSatelliteLayer();
      map.addLayer(activeLayer);
      map.removeLayer(cayoTileDebugLayer);
      bringLayerToFront(activeLayer);
    }

    function rebuildLsTileDebugLayer() {
      if (lsTileDebugLayer) map.removeLayer(lsTileDebugLayer);
      lsTileDebugLayer = L.tileLayer("ui/map/tiles/lossantos/{z}/{x}/{y}.png", {
        minZoom: mapMinZoom,
        maxZoom: mapMaxZoom,
        minNativeZoom: lsTileDebugZ,
        maxNativeZoom: lsTileDebugZ,
        noWrap: true,
        tms: true,
        bounds: worldBounds,
        opacity: lsTileDebugOpacity,
      });
      renderLsTileDebugBorderGrid();
    }

    function renderLsTileDebugBorderGrid() {
      lsTileDebugBorderLayer.clearLayers();
      const tilesPerSide = Math.pow(2, lsTileDebugZ);
      if (!Number.isFinite(tilesPerSide) || tilesPerSide <= 0) return;

      const step = (lsBounds[1][1] - lsBounds[0][1]) / tilesPerSide;
      buildGrid(lsTileDebugBorderLayer, {
        bounds: lsBounds,
        lineStep: step,
        color: "#ff2f2f",
        weight: 1,
        opacity: 0.9,
        withLabels: false,
      });
    }

    function setBaseLayer() {
      if (lsTileDebugEnabled) {
        map.removeLayer(base);
        if (!lsTileDebugLayer) rebuildLsTileDebugLayer();
        map.addLayer(lsTileDebugLayer);
        if (lsTileDebugBorders) map.addLayer(lsTileDebugBorderLayer);
        else map.removeLayer(lsTileDebugBorderLayer);
      } else {
        map.removeLayer(lsTileDebugBorderLayer);
        if (lsTileDebugLayer) map.removeLayer(lsTileDebugLayer);
        map.addLayer(base);
      }

      if (lsTileDebugEnabled && lsTileDebugLayer) bringLayerToFront(lsTileDebugLayer);
      if (lsTileDebugEnabled && lsTileDebugBorders) bringLayerToFront(lsTileDebugBorderLayer);
      if (cayoTileDebugEnabled) bringLayerToFront(cayoTileDebugLayer);
      else bringLayerToFront(cayoSatelliteLayer);
    }

    function renderCayoTileDebugLayer() {
      cayoTileDebugLayer.clearLayers();
      if (!cayoTileDebugEnabled) return;
      const range = cayoTileRanges[cayoTileDebugZ];
      if (!range) return;

      for (let x = range.xMin; x <= range.xMax; x++) {
        for (let y = range.yMin; y <= range.yMax; y++) {
          const bounds = getCayoTileBounds(cayoTileDebugZ, x, y);
          const url = getCayoTileUrl(cayoTileDebugZ, x, y);

          L.imageOverlay(url, bounds, {
            opacity: cayoTileDebugOpacity,
            interactive: false,
          }).addTo(cayoTileDebugLayer);

          if (cayoTileDebugBorders) {
            L.rectangle(bounds, {
              color: "#ff2f2f",
              weight: 1,
              opacity: 0.9,
              fill: false,
              interactive: false,
            }).addTo(cayoTileDebugLayer);
          }
        }
      }
    }

    function updateCayoTileDebugInfo() {
      const statusEl = gid("tileDebugStatus");
      if (!statusEl) return;
      const range = cayoTileRanges[cayoTileDebugZ];
      if (!range) {
        statusEl.textContent = "No range";
        return;
      }
      const cols = range.xMax - range.xMin + 1;
      const rows = range.yMax - range.yMin + 1;
      const mapZoom = Number(map.getZoom());
      const mapZoomLabel = Number.isFinite(mapZoom) ? mapZoom.toFixed(COORD_PRECISION) : "--";
      const currentCayoLod = getActiveCayoZoom();
      statusEl.textContent = `selected z${cayoTileDebugZ} | current z${currentCayoLod} (map z${mapZoomLabel}) | x ${range.xMin}-${range.xMax} | y ${range.yMin}-${range.yMax} | ${cols * rows} tiles`;
    }

    function updateLsTileDebugInfo() {
      const statusEl = gid("lsTileDebugStatus");
      if (!statusEl) return;
      const tiles = Math.pow(2, lsTileDebugZ);
      const mapZoom = Number(map.getZoom());
      const mapZoomLabel = Number.isFinite(mapZoom) ? mapZoom.toFixed(COORD_PRECISION) : "--";
      statusEl.textContent = `selected z${lsTileDebugZ} | current map z${mapZoomLabel} | ${tiles}x${tiles} tiles | TMS`;
    }
    function setTileDebugPanelVisibility(visible) {
      tileDebugPanelVisible = !!visible;
      const panel = gid("tileDebugPanel");
      if (panel) panel.classList.toggle("hidden", !tileDebugPanelVisible);
      saveTileDebugSettings();
    }
    function syncTileDebugPanelControls() {
      const lsEnable = gid("lsTileDebugEnable");
      const lsZ = gid("lsTileDebugZ");
      const lsBorders = gid("lsTileDebugBorders");
      const lsOpacity = gid("lsTileDebugOpacity");
      const cEnable = gid("tileDebugEnable");
      const cZ = gid("tileDebugZ");
      const cBorders = gid("tileDebugBorders");
      const cOpacity = gid("tileDebugOpacity");

      if (lsEnable) lsEnable.checked = lsTileDebugEnabled;
      if (lsZ) lsZ.value = String(lsTileDebugZ);
      if (lsBorders) lsBorders.checked = lsTileDebugBorders;
      if (lsOpacity) lsOpacity.value = String(lsTileDebugOpacity);
      if (cEnable) cEnable.checked = cayoTileDebugEnabled;
      if (cZ) cZ.value = String(cayoTileDebugZ);
      if (cBorders) cBorders.checked = cayoTileDebugBorders;
      if (cOpacity) cOpacity.value = String(cayoTileDebugOpacity);

      updateLsTileDebugInfo();
      updateCayoTileDebugInfo();
    }
    function applyLsTileDebugSettings() {
      rebuildLsTileDebugLayer();
      setBaseLayer();
      syncTileDebugPanelControls();
      saveTileDebugSettings();
    }
    function applyCayoTileDebugSettings(refreshDebugGrid = false) {
      if (refreshDebugGrid) setDebugGrid();
      renderCayoTileDebugLayer();
      setCayoLayers();
      setBaseLayer();
      syncTileDebugPanelControls();
      saveTileDebugSettings();
    }
    function resetTileDebugSettings() {
      lsTileDebugEnabled = LS_TILE_DEBUG_DEFAULTS.enabled;
      lsTileDebugBorders = LS_TILE_DEBUG_DEFAULTS.borders;
      lsTileDebugZ = LS_TILE_DEBUG_DEFAULTS.z;
      lsTileDebugOpacity = LS_TILE_DEBUG_DEFAULTS.opacity;
      cayoTileDebugEnabled = CAYO_TILE_DEBUG_DEFAULTS.enabled;
      cayoTileDebugBorders = CAYO_TILE_DEBUG_DEFAULTS.borders;
      cayoTileDebugZ = CAYO_TILE_DEBUG_DEFAULTS.z;
      cayoTileDebugOpacity = CAYO_TILE_DEBUG_DEFAULTS.opacity;
      applyLsTileDebugSettings();
      applyCayoTileDebugSettings(true);
    }

    function setupTileDebugPanel() {
      const panel = document.createElement("div");
      panel.id = "tileDebugPanel";
      panel.innerHTML = `
        <div class="tile-debug-head">
          <div class="tile-debug-title">Tile Debug</div>
          <div class="tile-debug-head-actions">
            <button id="tileDebugReset" type="button">Reset</button>
            <button id="tileDebugClose" type="button">Hide</button>
          </div>
        </div>
        <div class="tile-debug-subtitle">LS Island</div>
        <label class="tile-debug-row">
          <span>Enable</span>
          <input id="lsTileDebugEnable" type="checkbox" />
        </label>
        <label class="tile-debug-row">
          <span>LOD</span>
          <select id="lsTileDebugZ">
            <option value="0">z0</option>
            <option value="1">z1</option>
            <option value="2">z2</option>
            <option value="3" selected>z3</option>
            <option value="4">z4</option>
            <option value="5">z5</option>
            <option value="6">z6</option>
            <option value="7">z7</option>
          </select>
        </label>
        <label class="tile-debug-row">
          <span>Red Border</span>
          <input id="lsTileDebugBorders" type="checkbox" checked />
        </label>
        <label class="tile-debug-row">
          <span>Opacity</span>
          <input id="lsTileDebugOpacity" type="range" min="0.1" max="1" step="0.05" value="1" />
        </label>
        <div id="lsTileDebugStatus" class="tile-debug-status"></div>

        <div class="tile-debug-subtitle">Cayo Perico</div>
        <label class="tile-debug-row">
          <span>Enable</span>
          <input id="tileDebugEnable" type="checkbox" />
        </label>
        <label class="tile-debug-row">
          <span>LOD</span>
          <select id="tileDebugZ">
            <option value="2">z2</option>
            <option value="4">z4</option>
            <option value="5">z5</option>
            <option value="6">z6</option>
            <option value="7" selected>z7</option>
          </select>
        </label>
        <label class="tile-debug-row">
          <span>Red Border</span>
          <input id="tileDebugBorders" type="checkbox" checked />
        </label>
        <label class="tile-debug-row">
          <span>Opacity</span>
          <input id="tileDebugOpacity" type="range" min="0.1" max="1" step="0.05" value="1" />
        </label>
        <div id="tileDebugStatus" class="tile-debug-status"></div>
      `;
      document.body.appendChild(panel);
      setTileDebugPanelVisibility(tileDebugPanelVisible);

      gid("lsTileDebugEnable").addEventListener("change", (e) => {
        lsTileDebugEnabled = !!e.target.checked;
        applyLsTileDebugSettings();
      });

      gid("lsTileDebugZ").addEventListener("change", (e) => {
        lsTileDebugZ = Number(e.target.value);
        applyLsTileDebugSettings();
      });

      gid("lsTileDebugBorders").addEventListener("change", (e) => {
        lsTileDebugBorders = !!e.target.checked;
        applyLsTileDebugSettings();
      });

      gid("lsTileDebugOpacity").addEventListener("input", (e) => {
        lsTileDebugOpacity = clamp(Number(e.target.value), 0.1, 1);
        applyLsTileDebugSettings();
      });

      gid("tileDebugEnable").addEventListener("change", (e) => {
        cayoTileDebugEnabled = !!e.target.checked;
        applyCayoTileDebugSettings();
      });

      gid("tileDebugZ").addEventListener("change", (e) => {
        cayoTileDebugZ = normalizeCayoDebugZ(Number(e.target.value));
        applyCayoTileDebugSettings(true);
      });

      gid("tileDebugBorders").addEventListener("change", (e) => {
        cayoTileDebugBorders = !!e.target.checked;
        applyCayoTileDebugSettings();
      });

      gid("tileDebugOpacity").addEventListener("input", (e) => {
        cayoTileDebugOpacity = clamp(Number(e.target.value), 0.1, 1);
        applyCayoTileDebugSettings();
      });

      gid("tileDebugClose").addEventListener("click", () => setTileDebugPanelVisibility(false));
      gid("tileDebugReset").addEventListener("click", () => resetTileDebugSettings());

      syncTileDebugPanelControls();
    }
    function isTypingContextActive() {
      const ae = document.activeElement;
      if (!ae) return false;
      if (ae.isContentEditable) return true;
      const tag = (ae.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      return false;
    }
    function getTileDebugSecret() {
      // Stored obfuscated (xor with key 23)
      return [122, 118, 118, 111, 126, 122, 112, 123].map((n) => String.fromCharCode(n ^ 23)).join("");
    }
    function handleTileDebugSecretKey(evt) {
      const secret = getTileDebugSecret();
      if (isTypingContextActive()) {
        tileDebugHotkeyBuffer = "";
        return;
      }
      const code = String(evt?.code || "");
      if (!code.startsWith("Key")) {
        tileDebugHotkeyBuffer = "";
        return;
      }
      const letter = code.slice(3).toLowerCase();
      if (!/^[a-z]$/.test(letter)) {
        tileDebugHotkeyBuffer = "";
        return;
      }
      tileDebugHotkeyBuffer = (tileDebugHotkeyBuffer + letter).slice(-secret.length);
      if (tileDebugHotkeyBuffer !== secret) return;
      tileDebugHotkeyBuffer = "";
      const panel = gid("tileDebugPanel");
      if (!panel) return;
      panel.classList.toggle("hidden");
    }

    function getLayerNameFromPopup(l) {
      const c = l.getPopup()?.getContent() || "";
      const m = c.match(/--Name:\s*(.*?)\s*\|/);
      return m ? m[1] : "";
    }

    function getLayerName(l, fallback) {
      return l.options.zoneName || getLayerNameFromPopup(l) || fallback;
    }

    function getShapeLatLngs(l) {
      const a = l.getLatLngs();
      return Array.isArray(a[0]) ? a[0] : a;
    }

    function parseShape(name, points) {
      let p = "--Name: " + name + " | " + new Date().toDateString();
      p += "\nPolyZone:Create({\n";
      points.forEach((pt, i) => p += " vector2(" + pt[0] + ", " + pt[1] + ")" + (i < points.length - 1 ? "," : "") + "\n");
      p += '}, {\n name="' + name + '",' + (debug ? "\n debugGrid=true," : "") + "\n --minZ=0,\n --maxZ=800\n})\n\n";
      return p;
    }

    function parseCircle(name, center, radius) {
      return "--Name: " + name + " | " + new Date().toDateString() +
        "\nCircleZone:Create(vector2(" + center[0] + ", " + center[1] + "), " + radius + ", {\n name=\"" + name + "\"," +
        (debug ? "\n debugPoly=true," : "") + "\n})\n\n";
    }
    function buildLuaPreviewText() {
      const lines = [];
      editableLayers.getLayers().forEach((l) => {
        if (l instanceof L.Circle) {
          lines.push(parseCircle(getLayerName(l, getDefaultZoneName("circle")), latlngToGTA(l.getLatLng()), formatRoundedCircleRadiusGTA(l)));
        } else if (l instanceof L.Polygon) {
          const pts = [];
          getShapeLatLngs(l).forEach((x) => pts.push(latlngToGTA(x)));
          lines.push(parseShape(getLayerName(l, getDefaultZoneName("polygon")), pts));
        }
      });
      return lines.join("\n") || "-- No polygon/circle zones yet";
    }
    function spawnRmbTroll(pageX, pageY) {
      const img = document.createElement("img");
      img.src = "assets/ui/trollface.svg";
      img.width = 64;
      img.height = 64;
      img.alt = "trollface";
      img.className = "troll";
      img.style.position = "absolute";
      img.style.left = pageX + "px";
      img.style.top = pageY + "px";
      img.style.zIndex = "3000";
      img.style.mixBlendMode = "difference";
      img.style.filter = "invert(1)";
      img.style.pointerEvents = "none";
      document.body.appendChild(img);
    }
    function handleMapRightClickDomEvent(e) {
      const now = Date.now();
      if (now - lastRmbStamp < 80) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
        return false;
      }
      lastRmbStamp = now;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      spawnRmbTroll(e.pageX ?? e.clientX ?? 0, e.pageY ?? e.clientY ?? 0);
      return false;
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function copyZoneText(encoded) {
      const txt = decodeURIComponent(encoded);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(txt);
        return;
      }
      const ta = document.createElement("textarea");
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }

    function closeZonePopup(layerId) {
      const l = getLayerById(layerId);
      if (l) l.closePopup();
    }
    function flattenLatLngs(latlngs) {
      if (!Array.isArray(latlngs)) return [];
      if (latlngs.length === 0) return [];
      if (Array.isArray(latlngs[0])) return latlngs.flatMap((x) => flattenLatLngs(x));
      return latlngs;
    }
    function getLayerEditBounds(layer) {
      if (!layer) return null;
      if (layer instanceof L.Circle) return layer.getBounds();
      if (layer instanceof L.Marker && !(layer instanceof L.CircleMarker)) {
        const p = layer.getLatLng();
        return L.latLngBounds([p, p]);
      }
      if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
        const pts = flattenLatLngs(layer.getLatLngs());
        if (!pts.length) return null;
        const b = L.latLngBounds([pts[0], pts[0]]);
        pts.forEach((pt) => b.extend(pt));
        return b;
      }
      if (typeof layer.getBounds === "function") return layer.getBounds();
      if (typeof layer.getLatLng === "function") {
        const p = layer.getLatLng();
        return L.latLngBounds([p, p]);
      }
      return null;
    }
    function focusZoneForEdit(layer) {
      // Camera auto-movement is disabled by design.
      void layer;
    }
    function editZoneFromPopup(layerId) {
      const l = getLayerById(layerId);
      if (!l) return;
      setActiveLayer(l);
      toggleScopedEdit(layerId);
      focusZoneForEdit(l);
    }
    function deleteZoneFromPopup(layerId) {
      const l = getLayerById(layerId);
      if (!l) return;
      editableLayers.removeLayer(l);
      if (activeShapeId === layerId) activeShapeId = null;
      if (scopedEditLayerId === layerId) {
        editScope = "none";
        scopedEditLayerId = null;
      }
      refresh();
    }

    function getLayerAnchor(layer) {
      if (!layer) return map.getCenter();
      if (typeof layer.getBounds === "function") return layer.getBounds().getCenter();
      if (typeof layer.getLatLng === "function") return layer.getLatLng();
      return map.getCenter();
    }

    function openZoneNamePopup(layer, fallbackName, currentValue, onSubmit, onCancel) {
      const anchor = getLayerAnchor(layer);
      const popup = L.popup({
        closeButton: false,
        autoClose: true,
        closeOnClick: false,
        className: "name-popup-shell",
        minWidth: 320,
        maxWidth: 320,
      }).setLatLng(anchor);

      const wrap = document.createElement("div");
      wrap.className = "name-popup";

      const title = document.createElement("h4");
      title.className = "name-popup-title";
      title.textContent = "Zone Name";
      wrap.appendChild(title);

      const input = document.createElement("input");
      input.className = "name-popup-input";
      input.type = "text";
      input.placeholder = "enter name";
      input.value = currentValue || "";
      wrap.appendChild(input);

      const actions = document.createElement("div");
      actions.className = "name-popup-actions";

      const applyBtn = btn("Apply", () => {
        const val = input.value.trim() || fallbackName;
        map.closePopup(popup);
        onSubmit(val);
      });
      const cancelBtn = btn("Cancel", () => {
        map.closePopup(popup);
        if (typeof onCancel === "function") onCancel();
      });

      actions.appendChild(applyBtn);
      actions.appendChild(cancelBtn);
      wrap.appendChild(actions);

      popup.setContent(wrap);
      popup.openOn(map);

      setTimeout(() => {
        input.focus();
        input.select();
      }, 0);

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          applyBtn.click();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancelBtn.click();
        }
      });
    }

    function zonePopupHtml(luaText, layerId) {
      const encoded = encodeURIComponent(luaText);
      const isEditActive = editScope === "global" || (editScope === "single" && scopedEditLayerId === layerId);
      return "<div class='zone-popup'>" +
        "<div class='zone-popup-head'>" +
          "<div class='zone-popup-left'>" +
            "<button type='button' class='zone-popup-copy' onclick=\"copyZoneText('" + encoded + "')\">Copy</button>" +
            "<button type='button' class='zone-popup-copy" + (isEditActive ? " active" : "") + "' onclick=\"editZoneFromPopup(" + layerId + ")\">Edit</button>" +
            "<button type='button' class='zone-popup-copy zone-popup-danger' onclick=\"deleteZoneFromPopup(" + layerId + ")\">Delete</button>" +
          "</div>" +
          "<button type='button' class='zone-popup-close' onclick=\"closeZonePopup(" + layerId + ")\">&times;</button>" +
        "</div>" +
        "<pre class='zone-popup-code'>" + escapeHtml(luaText) + "</pre>" +
        "</div>";
    }

    function bindMarkerPopup(l) {
      l.bindPopup("GTA Position: " + latlngToGTA(l.getLatLng()) + ", latlng: " + l.getLatLng());
    }

    function bindCirclePopup(l, fallback) {
      const n = getLayerName(l, fallback);
      l.options.zoneName = n;
      const html = zonePopupHtml(parseCircle(n, latlngToGTA(l.getLatLng()), formatRoundedCircleRadiusGTA(l)), l._leaflet_id);
      if (l.getPopup()) l.setPopupContent(html);
      else l.bindPopup(html, { minWidth: 600, maxWidth: 600, className: "zone-popup-shell", closeButton: false });
    }

    function bindPolygonPopup(l, fallback) {
      const n = getLayerName(l, fallback);
      const pts = [];
      l.options.zoneName = n;
      getShapeLatLngs(l).forEach((x) => pts.push(latlngToGTA(x)));
      const html = zonePopupHtml(parseShape(n, pts), l._leaflet_id);
      if (l.getPopup()) l.setPopupContent(html);
      else l.bindPopup(html, { minWidth: 600, maxWidth: 600, className: "zone-popup-shell", closeButton: false });
    }

    function syncZonePopups() {
      editableLayers.getLayers().forEach((l) => {
        if (l instanceof L.Circle) bindCirclePopup(l, getDefaultZoneName("circle"));
        else if (l instanceof L.Polygon) bindPolygonPopup(l, getDefaultZoneName("polygon"));
      });
    }

    function serializeLayer(l) {
      if (l instanceof L.Marker && !(l instanceof L.CircleMarker)) {
        const p = l.getLatLng();
        return { type: "marker", latlng: [Math.round(p.lat), Math.round(p.lng)] };
      }
      if (l instanceof L.Circle) {
        const c = l.getLatLng();
        return { type: "circle", name: getLayerName(l, "circlezone"), center: [Math.round(c.lat), Math.round(c.lng)], radius: l.getRadius() };
      }
      if (l instanceof L.Polygon) {
        return { type: "polygon", name: getLayerName(l, "polyzone"), latlngs: getShapeLatLngs(l).map((p) => [Math.round(p.lat), Math.round(p.lng)]) };
      }
      return null;
    }

    function createLayerFromJson(s) {
      if (!s || !s.type) return null;
      if (s.type === "marker" && Array.isArray(s.latlng)) {
        const l = L.marker(s.latlng);
        applyZoneStyle(l);
        bindMarkerPopup(l);
        return l;
      }
      if (s.type === "circle" && Array.isArray(s.center) && typeof s.radius === "number") {
        const l = new L.Circle(s.center, s.radius);
        applyZoneStyle(l);
        l.options.zoneName = s.name || getDefaultZoneName("circle");
        bindCirclePopup(l, getDefaultZoneName("circle"));
        return l;
      }
      if (s.type === "polygon" && Array.isArray(s.latlngs)) {
        const l = L.polygon(s.latlngs);
        applyZoneStyle(l);
        l.options.zoneName = s.name || getDefaultZoneName("polygon");
        bindPolygonPopup(l, getDefaultZoneName("polygon"));
        return l;
      }
      return null;
    }

    function clearLayer() {
      editableLayers.getLayers().forEach((l) => editableLayers.removeLayer(l));
      document.querySelectorAll(".troll").forEach((el) => el.remove());
      activeShapeId = null;
      editScope = "none";
      scopedEditLayerId = null;
      refresh();
    }

    function exportJson() {
      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        shapes: editableLayers.getLayers().map(serializeLayer).filter(Boolean),
      };
      const pretty = JSON.stringify(data, null, 2)
        .replace(/\[\n\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?),\n\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\n\s*\]/g, "[$1, $2]");
      const b = new Blob([pretty], { type: "application/json" });
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = "polyzones.json";
      a.click();
      URL.revokeObjectURL(u);
    }

    function triggerJsonImport() {
      const i = gid("jsonFileInput");
      i.value = "";
      i.click();
    }
    function exportLua() {
      const txt = buildLuaPreviewText();
      const b = new Blob([txt], { type: "text/plain;charset=utf-8" });
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = "polyzones.lua";
      a.click();
      URL.revokeObjectURL(u);
    }
    function triggerLuaImport() {
      const i = gid("luaFileInput");
      i.value = "";
      i.click();
    }
    function importLuaText(text) {
      const shapes = [];

      const circleRe = /CircleZone:Create\(\s*vector2\(\s*([\-0-9.]+)\s*,\s*([\-0-9.]+)\s*\)\s*,\s*([\-0-9.]+)\s*,\s*\{([\s\S]*?)\}\s*\)/g;
      let m;
      while ((m = circleRe.exec(text)) !== null) {
        const x = Number(m[1]);
        const y = Number(m[2]);
        const r = Number(m[3]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(r)) continue;
        const nameMatch = m[4].match(/name\s*=\s*"([^"]+)"/);
        shapes.push({
          type: "circle",
          name: nameMatch ? nameMatch[1] : getDefaultZoneName("circle"),
          center: gtaToLatLng(x, y),
          radius: r / CIRCLE_RADIUS_SCALE,
        });
      }

      const polyRe = /PolyZone:Create\(\s*\{([\s\S]*?)\}\s*,\s*\{([\s\S]*?)\}\s*\)/g;
      while ((m = polyRe.exec(text)) !== null) {
        const pts = [];
        const pointRe = /vector2\(\s*([\-0-9.]+)\s*,\s*([\-0-9.]+)\s*\)/g;
        let p;
        while ((p = pointRe.exec(m[1])) !== null) {
          const x = Number(p[1]);
          const y = Number(p[2]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          pts.push(gtaToLatLng(x, y));
        }
        if (pts.length < 3) continue;
        const nameMatch = m[2].match(/name\s*=\s*"([^"]+)"/);
        shapes.push({
          type: "polygon",
          name: nameMatch ? nameMatch[1] : getDefaultZoneName("polygon"),
          latlngs: pts,
        });
      }

      clearLayer();
      shapes.forEach((s) => {
        const l = createLayerFromJson(s);
        if (l) {
          attachLayerEvents(l);
          editableLayers.addLayer(l);
        }
      });
      if (editableLayers.getLayers().length) setActiveLayer(editableLayers.getLayers()[0]);
      refresh();
    }
    function handleLuaImport(e) {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (x) => {
        try {
          importLuaText(String(x.target.result || ""));
        } catch (err) {
          alert("Invalid LUA: " + err.message);
        }
      };
      r.readAsText(f);
    }

    function handleJsonImport(e) {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = (x) => {
        try {
          const parsed = JSON.parse(x.target.result);
          const shapes = Array.isArray(parsed) ? parsed : parsed.shapes;
          if (!Array.isArray(shapes)) throw new Error("Invalid JSON format");
          clearLayer();
          shapes.forEach((s) => {
            const l = createLayerFromJson(s);
            if (l) {
              attachLayerEvents(l);
              editableLayers.addLayer(l);
            }
          });
          refresh();
        } catch (err) {
          alert("Failed to import JSON: " + err.message);
        }
      };
      r.readAsText(f);
    }

    function getLayerById(id) {
      return editableLayers.getLayers().find((l) => l._leaflet_id === Number(id)) || null;
    }

    function row(label, value) {
      const r = document.createElement("div");
      r.className = "row";
      r.innerHTML = "<div class='l'>" + label + "</div><div class='v'>" + value + "</div>";
      return r;
    }

    function setActiveLayer(l) {
      activeShapeId = l ? l._leaflet_id : null;
      if (l?.openPopup) l.openPopup();
      refresh();
    }

    function layerSummary(l) {
      if (l instanceof L.Marker && !(l instanceof L.CircleMarker)) {
        const p = latlngToGTA(l.getLatLng());
        return { id: l._leaflet_id, type: "Marker", name: "marker", meta: p[0] + ", " + p[1] };
      }
      if (l instanceof L.Circle) {
        return { id: l._leaflet_id, type: "Circle", name: getLayerName(l, getDefaultZoneName("circle")), meta: "R: " + formatRoundedCircleRadiusGTA(l) };
      }
      return { id: l._leaflet_id, type: "Poly", name: getLayerName(l, getDefaultZoneName("polygon")), meta: getShapeLatLngs(l).length + " pts" };
    }

    function refreshProject() {
      ui.project.innerHTML = "";
      let totalZones = 0;
      let arbitraryZones = 0;
      let triangleZones = 0;
      let radialZones = 0;

      editableLayers.getLayers().forEach((l) => {
        if (l instanceof L.Circle) {
          totalZones += 1;
          radialZones += 1;
          return;
        }
        if (l instanceof L.Polygon) {
          totalZones += 1;
          const pts = getShapeLatLngs(l).length;
          if (pts === 3) triangleZones += 1;
          else arbitraryZones += 1;
        }
      });

      ui.project.appendChild(row("Total Zones", String(totalZones)));
      ui.project.appendChild(row("Freeform", String(arbitraryZones)));
      ui.project.appendChild(row("Triangular", String(triangleZones)));
      ui.project.appendChild(row("Radial", String(radialZones)));
    }

    function refreshSelection() {
      const l = activeShapeId ? getLayerById(activeShapeId) : null;
      ui.selection.innerHTML = "";
      if (!l) {
        ui.selSub.textContent = "Selection: None";
        ui.selection.appendChild(row("State", "No selected shape"));
        return;
      }

      if (l instanceof L.Marker && !(l instanceof L.CircleMarker)) {
        const p = latlngToGTA(l.getLatLng());
        ui.selSub.textContent = "Selection: Marker";
        ui.selection.appendChild(row("Type", "Marker"));
        ui.selection.appendChild(row("X", String(p[0])));
        ui.selection.appendChild(row("Y", String(p[1])));
        return;
      }

      if (l instanceof L.Circle) {
        const p = latlngToGTA(l.getLatLng());
        ui.selSub.textContent = "Selection: Circle";
        ui.selection.appendChild(row("Type", "Circle"));
        ui.selection.appendChild(row("Name", getLayerName(l, getDefaultZoneName("circle"))));
        ui.selection.appendChild(row("Center", p[0] + ", " + p[1]));
        ui.selection.appendChild(row("Radius", formatRoundedCircleRadiusGTA(l)));
        return;
      }

      ui.selSub.textContent = "Selection: Poly";
      ui.selection.appendChild(row("Type", "Poly"));
      ui.selection.appendChild(row("Name", getLayerName(l, getDefaultZoneName("polygon"))));
      ui.selection.appendChild(row("Points", String(getShapeLatLngs(l).length)));
    }

    function refreshShapes() {
      ui.shapes.innerHTML = "";
      const header = document.createElement("div");
      header.className = "thead";
      header.innerHTML = "<div class='cell'>Type</div><div class='cell'>Name</div><div class='cellr'>Meta</div>";
      ui.shapes.appendChild(header);

      const all = editableLayers.getLayers();
      ui.shapeSub.textContent = "Shapes: " + all.length;
      all.forEach((l) => {
        const s = layerSummary(l);
        const r = document.createElement("div");
        r.className = "trow" + (s.id === activeShapeId ? " active" : "");
        r.innerHTML = "<div class='cell'>" + s.type + "</div><div class='cell'>" + s.name + "</div><div class='cellr'>" + s.meta + "</div>";
        r.onclick = () => setActiveLayer(l);
        ui.shapes.appendChild(r);
      });
    }

    function refreshActions() {
      ui.actions.innerHTML = "";
      const split = document.createElement("div");
      split.className = "actions-split";

      const tools = document.createElement("section");
      tools.className = "card";
      tools.innerHTML = "<strong>Create</strong>";

      const build = document.createElement("div");
      build.className = "acts-col";
      build.appendChild(btn("Poly (Free)", () => activateTool("polygon"), activeTool === "polygon"));
      build.appendChild(btn("Circle", () => activateTool("circle"), activeTool === "circle"));
      build.appendChild(btn("Rectangle", () => activateTool("rectangle"), activeTool === "rectangle"));
      tools.appendChild(build);

      split.appendChild(tools);

      const card = document.createElement("section");
      card.className = "card";
      card.innerHTML = "<strong>Manage</strong>";

      const acts = document.createElement("div");
      acts.className = "acts";
      acts.appendChild(btn("Edit Zone", () => toggleGlobalEdit(), editScope === "global"));
      acts.appendChild(btn("Delete Mode", () => activateTool("remove"), activeTool === "remove"));

      acts.appendChild(btn("Rename Selected", () => {
        const l = activeShapeId ? getLayerById(activeShapeId) : null;
        if (!l || l instanceof L.Marker) return;
        const fallback = l instanceof L.Circle ? getDefaultZoneName("circle") : getDefaultZoneName("polygon");
        const old = getLayerName(l, fallback);
        openZoneNamePopup(l, fallback, old, (name) => {
          l.options.zoneName = name;
          if (l instanceof L.Circle) bindCirclePopup(l, getDefaultZoneName("circle"));
          else bindPolygonPopup(l, getDefaultZoneName("polygon"));
          refresh();
        });
      }));

      acts.appendChild(btn("Delete Selected", () => {
        const l = activeShapeId ? getLayerById(activeShapeId) : null;
        if (!l) return;
        editableLayers.removeLayer(l);
        if (scopedEditLayerId === l._leaflet_id) {
          editScope = "none";
          scopedEditLayerId = null;
        }
        activeShapeId = null;
        refresh();
      }));

      card.appendChild(acts);
      split.appendChild(card);
      ui.actions.appendChild(split);
    }

    function refreshOutput() {
      ui.output.innerHTML = "";
      const card = document.createElement("section");
      card.className = "card";
      const head = document.createElement("div");
      head.className = "card-head";
      const title = document.createElement("strong");
      title.textContent = "Lua Preview";
      const copyBtn = btn("Copy", () => {
        out.select();
        document.execCommand("copy");
      });
      head.appendChild(title);
      head.appendChild(copyBtn);
      card.appendChild(head);

      const out = document.createElement("textarea");
      out.className = "out";
      out.readOnly = true;

      out.value = buildLuaPreviewText();
      card.appendChild(out);
      ui.output.appendChild(card);
    }

    function refreshSettings() {
      ui.settings.innerHTML = "";
    }
    function refreshGridControls() {
      if (!ui.gridControls) return;
      ui.gridControls.innerHTML = "";
      const dbgBtn = btn("Debug", () => { lsDebugGrid = !lsDebugGrid; setDebugGrid(); refresh(); });
      const ovlBtn = btn("Overlay", () => { lsOverlayGrid = !lsOverlayGrid; setOverlay(); refresh(); });
      dbgBtn.classList.toggle("active", lsDebugGrid);
      ovlBtn.classList.toggle("active", lsOverlayGrid);
      ui.gridControls.appendChild(dbgBtn);
      ui.gridControls.appendChild(ovlBtn);
    }

    function refreshNav() {
      ui.submenuTitle.textContent = "PolyZone Creator";
    }

    function refresh() {
      syncZonePopups();
      refreshProject();
      refreshShapes();
      refreshActions();
      refreshOutput();
      refreshSettings();
      refreshGridControls();
      refreshNav();
    }

    function attachLayerEvents(l) {
      l.on("click", () => setActiveLayer(l));
    }

    function btn(text, cb, isActive = false) {
      const b = document.createElement("button");
      b.className = "sbtn";
      if (isActive) b.classList.add("active");
      b.type = "button";
      b.textContent = text;
      b.onclick = cb;
      return b;
    }

    gid("expJson").onclick = exportJson;
    gid("impJson").onclick = triggerJsonImport;
    gid("expLua").onclick = exportLua;
    gid("impLua").onclick = triggerLuaImport;
    gid("clrAll").onclick = clearLayer;

    map.on(L.Draw.Event.CREATED, (e) => {
      const t = e.layerType;
      const l = e.layer;
      applyZoneStyle(l);
      let fallback = "";
      if (t === "marker") {
        bindMarkerPopup(l);
      } else if (t === "circle") {
        fallback = getDefaultZoneName("circle");
        l.options.zoneName = fallback;
        bindCirclePopup(l, fallback);
      } else {
        const fallbackType = t === "rectangle" ? "rectangle" : "polygon";
        fallback = getDefaultZoneName(fallbackType);
        l.options.zoneName = fallback;
        bindPolygonPopup(l, fallback);
      }
      attachLayerEvents(l);
      editableLayers.addLayer(l);
      setActiveLayer(l);
      if (t !== "marker") {
        openZoneNamePopup(l, fallback, "", (name) => {
          l.options.zoneName = name;
          if (t === "circle") bindCirclePopup(l, getDefaultZoneName("circle"));
          else bindPolygonPopup(l, t === "rectangle" ? getDefaultZoneName("rectangle") : getDefaultZoneName("polygon"));
          refresh();
        }, () => {
          editableLayers.removeLayer(l);
          if (activeShapeId === l._leaflet_id) activeShapeId = null;
          refresh();
        });
      }
    });

    map.on(L.Draw.Event.EDITED, (e) => {
      e.layers.eachLayer((l) => {
        if (l instanceof L.Marker) bindMarkerPopup(l);
        else if (l instanceof L.Circle) bindCirclePopup(l, getDefaultZoneName("circle"));
        else bindPolygonPopup(l, getDefaultZoneName("polygon"));
      });
      refresh();
    });
    map.on(L.Draw.Event.EDITVERTEX, () => {
      refresh();
    });
    map.on(L.Draw.Event.EDITMOVE, () => {
      refresh();
    });
    map.on(L.Draw.Event.EDITRESIZE, () => {
      refresh();
    });

    map.on(L.Draw.Event.DELETED, () => {
      if (activeShapeId && !getLayerById(activeShapeId)) activeShapeId = null;
      refresh();
    });
    map.on(L.Draw.Event.DRAWSTOP, () => {
      activeTool = null;
      syncMapDraggingState();
      hideDrawMeasureBubble();
      refreshActions();
    });
    map.on(L.Draw.Event.EDITSTOP, () => {
      if (editScope === "global") {
        editScope = "none";
        scopedEditLayerId = null;
      }
      refreshActions();
      refresh();
    });
    map.on(L.Draw.Event.DELETESTOP, () => {
      activeTool = null;
      syncMapDraggingState();
      refreshActions();
      refresh();
    });
    map.on("zoomend", () => {
      if (cayoTileDebugEnabled) return;
      setCayoLayers();
      if (lsOverlayGrid) setOverlay();
      updateLsTileDebugInfo();
      updateCayoTileDebugInfo();
    });
    map.on("mousemove", (e) => updateCursorCoordBar(e.latlng));
    map.on("mousemove", (e) => updateDrawMeasureBubble(e));
    map.on("mouseout", () => {
      if (ui.cursorCoordBar) ui.cursorCoordBar.textContent = "X: -- | Y: --";
      hideDrawMeasureBubble();
    });
    editableLayers.on("layeradd", (e) => attachLayerEvents(e.layer));

    document.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
    document.addEventListener("mousedown", (e) => {
      if (!isCreateToolActive()) return;
      if (e.button === 2) consumeMouseEvent(e);
    }, true);
    document.addEventListener("mouseup", (e) => {
      if (!isCreateToolActive()) return;
      if (e.button === 2) consumeMouseEvent(e);
    }, true);
    document.addEventListener("click", (e) => {
      if (!isCreateToolActive()) return;
      if (e.button === 2) consumeMouseEvent(e);
    }, true);
    document.addEventListener("auxclick", (e) => {
      if (!isCreateToolActive()) return;
      if (e.button === 2) consumeMouseEvent(e);
    }, true);
    document.addEventListener("keydown", (e) => {
      const k = (e.key || "").toLowerCase();
      handleTileDebugSecretKey(e);
      if (
        k === "f12" ||
        (e.ctrlKey && e.shiftKey && (k === "i" || k === "j" || k === "c")) ||
        (e.ctrlKey && k === "u")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    const mapContainer = map.getContainer();
    mapContainer.addEventListener("contextmenu", handleMapRightClickDomEvent, true);
    mapContainer.addEventListener("mousedown", (e) => {
      if (isCreateToolActive() && e.button === 1) {
        isMiddleMouseDown = true;
        middlePanLastPoint = { x: e.clientX, y: e.clientY };
        syncMapDraggingState();
        e.preventDefault();
        return;
      }
      if (isCreateToolActive() && e.button !== 0) {
        consumeMouseEvent(e);
        return;
      }
      if (e.button === 2) {
        isRightMouseDown = true;
        syncMapDraggingState();
        handleMapRightClickDomEvent(e);
      }
    }, true);
    mapContainer.addEventListener("mouseup", (e) => {
      if (isCreateToolActive() && e.button === 1) {
        isMiddleMouseDown = false;
        middlePanLastPoint = null;
        syncMapDraggingState();
        e.preventDefault();
        return;
      }
      if (isCreateToolActive() && e.button !== 0) {
        consumeMouseEvent(e);
        return;
      }
      if (e.button === 2) {
        isRightMouseDown = false;
        syncMapDraggingState();
        consumeMouseEvent(e);
      }
    }, true);
    mapContainer.addEventListener("click", (e) => {
      if (isCreateToolActive() && e.button !== 0) {
        consumeMouseEvent(e);
        return;
      }
      if (e.button === 2) {
        consumeMouseEvent(e);
      }
    }, true);
    mapContainer.addEventListener("auxclick", (e) => {
      if (isCreateToolActive()) consumeMouseEvent(e);
    }, true);
    mapContainer.addEventListener("mousemove", (e) => {
      if (isCreateToolActive() && isMiddleMouseDown) {
        if (middlePanLastPoint) {
          const dx = e.clientX - middlePanLastPoint.x;
          const dy = e.clientY - middlePanLastPoint.y;
          if (dx !== 0 || dy !== 0) map.panBy([-dx, -dy], { animate: false });
        }
        middlePanLastPoint = { x: e.clientX, y: e.clientY };
        consumeMouseEvent(e);
        return;
      }
      if (!isRightMouseDown) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    }, true);
    mapContainer.addEventListener("mouseleave", () => {
      isRightMouseDown = false;
      isMiddleMouseDown = false;
      middlePanLastPoint = null;
      syncMapDraggingState();
    }, true);
    setInterval(() => {
      document.querySelectorAll(".troll").forEach((el) => el.remove());
    }, 700);

    setOverlay();
    setDebugGrid();
    setupTileDebugPanel();
    renderCayoTileDebugLayer();
    setBaseLayer();
    setCayoLayers();
    refresh();
