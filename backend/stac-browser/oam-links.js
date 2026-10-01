// Editor and tile links for raster items in STAC Browser (hotosm/openaerialmap#323).
//
// STAC Browser merges window.STAC_BROWSER_CONFIG into its config with
// Object.assign, so a function set here is picked up as the preprocessSTAC
// hook. The hook runs on every STAC object loaded from the API; for items
// with a raster data asset it appends three links, which STAC Browser lists
// under "Additional resources" and opens raw in a new tab:
//
//   id-editor  Open in iD, via openstreetmap.org/edit with a custom background
//   josm       Open in JOSM, via Remote Control on 127.0.0.1:8111
//   xyz        the XYZ tile template for QGIS and other clients (copy the link)
//
// Titles are what the user sees, so they say what the link does.
//
// The tile URL is the TiTiler-pgSTAC endpoint the OAM Browse page uses, with
// the same render parameters (renders.browse), so both entry points give the
// same imagery.
(function () {
  var cfg = window.STAC_BROWSER_CONFIG;
  var OAM_RELS = ["id-editor", "josm", "xyz"];

  function titilerUrl() {
    if (cfg.oamTitilerUrl) return cfg.oamTitilerUrl.replace(/\/+$/, "");
    return String(cfg.catalogUrl || "").replace(/\/+$/, "").replace(/\/stac$/, "/raster");
  }

  function dataAssetName(item) {
    var browse = item.properties && item.properties.renders && item.properties.renders.browse;
    if (browse && browse.assets && browse.assets.length) return browse.assets[0];
    var assets = item.assets || {};
    if (assets.visual) return "visual";
    for (var key in assets) {
      var roles = assets[key].roles || [];
      if (roles.indexOf("data") !== -1) return key;
    }
    return null;
  }

  function isRaster(asset) {
    var type = String((asset && asset.type) || "");
    return /tiff|cog|geotiff|image\//i.test(type);
  }

  // Mirror backend/global-mosaic/scripts/gen_coverage_vector.py:_build_render_query
  // and frontend/src/browse/components/ImageCard.tsx:tmsTemplate.
  function renderQuery(item) {
    var browse = (item.properties && item.properties.renders && item.properties.renders.browse) || {};
    var parts = [];
    (browse.bidx || []).forEach(function (b) { parts.push("bidx=" + parseInt(b, 10)); });
    (browse.rescale || []).forEach(function (pair) {
      parts.push("rescale=" + encodeURIComponent(pair[0] + "," + pair[1]));
    });
    if (browse.colormap_name) parts.push("colormap_name=" + encodeURIComponent(String(browse.colormap_name)));
    if (browse.colormap) parts.push("colormap=" + encodeURIComponent(JSON.stringify(browse.colormap)));
    if (browse.nodata !== undefined && browse.nodata !== null) {
      parts.push("nodata=" + encodeURIComponent(String(browse.nodata)));
    }
    return parts.length ? parts.join("&") : "nodata=0";
  }

  function tileTemplate(item, asset) {
    return titilerUrl() + "/collections/" + encodeURIComponent(item.collection) +
      "/items/" + encodeURIComponent(item.id) +
      "/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=" + encodeURIComponent(asset) +
      "&" + renderQuery(item);
  }

  function center(item) {
    var b = item.bbox;
    if (!b || b.length < 4) return null;
    return { lon: (b[0] + b[2]) / 2, lat: (b[1] + b[3]) / 2 };
  }

  function addLinks(item) {
    if (!item || item.type !== "Feature" || !item.collection || !Array.isArray(item.links)) return item;
    if (item.links.some(function (l) { return OAM_RELS.indexOf(l.rel) !== -1; })) return item;
    var asset = dataAssetName(item);
    if (!asset || !isRaster(item.assets[asset])) return item;

    var tiles = tileTemplate(item, asset);
    var title = "OAM - " + (item.properties.title || item.id);
    var c = center(item);
    var b = item.bbox;
    // JOSM bounds are minlat,minlon,maxlat,maxlon; they stop JOSM requesting
    // tiles outside the footprint, since a link cannot zoom the map first.
    var bounds = b && b.length >= 4 ? "&bounds=" + [b[1], b[0], b[3], b[2]].join(",") : "";
    var links = [
      {
        rel: "xyz",
        href: tiles,
        type: "image/png",
        title: "XYZ tile URL (copy link address, add as XYZ layer in QGIS)"
      },
      {
        rel: "josm",
        href: "http://127.0.0.1:8111/imagery?type=tms&max_zoom=22" + bounds + "&title=" +
          encodeURIComponent(title) + "&url=" + encodeURIComponent(tiles),
        type: "text/html",
        title: "Open in JOSM (needs JOSM running with Remote Control)"
      }
    ];
    if (c) {
      links.push({
        rel: "id-editor",
        href: "https://www.openstreetmap.org/edit?editor=id#map=16/" + c.lat + "/" + c.lon +
          "&background=" + encodeURIComponent("custom:" + tiles),
        type: "text/html",
        title: "Open in iD"
      });
    }
    // STAC Browser only shows `title` on its own Link objects (stac-js), so
    // build ours with the class the item's existing links use.
    var Link = item.links.length ? item.links[0].constructor : null;
    item.links = item.links.concat(links.map(function (l) {
      return Link && Link.length >= 1 ? new Link(l, item) : l;
    }));
    return item;
  }

  var previous = cfg.preprocessSTAC;
  cfg.preprocessSTAC = function (stac, state, getters) {
    if (typeof previous === "function") stac = previous(stac, state, getters);
    try { return addLinks(stac); } catch (e) { return stac; }
  };
})();
