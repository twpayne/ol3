goog.require('goog.Uri.QueryData');
goog.require('goog.net.WebSocket');
goog.require('goog.events.EventHandler');
goog.require('ol.Map');
goog.require('ol.RendererHint');
goog.require('ol.View2D');
goog.require('ol.ViewHint');
goog.require('ol.control');
goog.require('ol.layer.Tile');
goog.require('ol.proj');
goog.require('ol.proj.EPSG3857');
goog.require('ol.source.BingMaps');
goog.require('ol.source.OSM');
goog.require('ol.source.TileDebug');
goog.require('spline');


/**
 * @const {number}
 */
var ZOOM_OFFSET = -1;

var Z0 = 1;
var R0 = 2 * ol.proj.EPSG3857.HALF_SIZE / (ol.DEFAULT_TILE_SIZE * Math.pow(2, Z0));


var query = goog.global.location.search.substring(1);
var queryData = new goog.Uri.QueryData(query);
var x = Number(queryData.get('x', 0));
var y = Number(queryData.get('y', 0));
var d = Number(queryData.get('d', 0.04));
var n = Number(queryData.get('n', 1));
var nominalResolution = 256 / 0.04; // Nexus 7
var deviceResolution = (n * 256) / d;

var osmLayer = new ol.layer.Tile({
  source: new ol.source.OSM()
});

var tileDebugLayer = new ol.layer.Tile({
  source: new ol.source.TileDebug({
    projection: 'EPSG:3857',
    tileGrid: new ol.tilegrid.XYZ({
      maxZoom: 22
    })
  })
});

var map = new ol.Map({
  controls: ol.control.defaults({
    attribution: false,
    zoom: false
  }),
  layers: [
    new ol.layer.Tile({
      preload: Infinity,
      source: new ol.source.BingMaps({
        key: 'Ak-dzM4wZjSqTlzveKz5u0d4IQ4bRzVI309GxmkgSVr1ewS6iPSrOvOKhA-CJlm3',
        style: 'Aerial'
      })
    }),
    osmLayer,
    tileDebugLayer
  ],
  renderer: ol.RendererHint.WEBGL,
  target: 'map',
  view: new ol.View2D({
    center: [0, 0],
    resolution: nominalResolution / deviceResolution,
    zoom: 1
  })
});


var transpose = function(waypoints) {
  var points = waypoints['points'];
  var n = points.length;
  var times = [];
  var lats = [];
  var lngs = [];
  var angles = [];
  var zooms = [];
  var i;
  for (i = 0; i < n; ++i) {
    var point = points[i];
    times.push(1000 * point['time']);
    lats.push(point['lat']);
    lngs.push(point['long']);
    angles.push(Math.PI * point['angle'] / 180);
    zooms.push(point['zoom'] + ZOOM_OFFSET);
  };
  return {
    times: times,
    lats: lats,
    lngs: lngs,
    angles: angles,
    zooms: zooms
  };
};

var start = goog.now();
var duration = (2 * 60 + 15) * 1000;
var animate = goog.nullFunction();

goog.net.XhrIo.send('waypoints.json', function(event) {
  var xhrio = /** @type {goog.net.XhrIo} */ (event.target);
  var waypoints = xhrio.getResponseJson();

  var data = transpose(waypoints);
  var latF = spline.makeInterpolator({time: data.times, ref: data.lats});
  var lngF = spline.makeInterpolator({time: data.times, ref: data.lngs});
  var angleF = spline.makeInterpolator({time: data.times, ref: data.angles});
  var zoomF = spline.makeInterpolator({time: data.times, ref: data.zooms});

  animate = function(map, frameState) {
    if (frameState.time - start > duration) {
      return false;
    } else if (!goog.isNull(frameState)) {
      var lat = latF(frameState.time - start);
      var lng = lngF(frameState.time - start);
      var zoom = zoomF(frameState.time - start);
      var rotation = -angleF(frameState.time - start);
      var center = ol.proj.transform([lng, lat], 'EPSG:4326', 'EPSG:3857');
      var resolution = 2 * ol.proj.EPSG3857.HALF_SIZE /
          (ol.DEFAULT_TILE_SIZE * Math.pow(2, zoom));
      var dXi = resolution * x * nominalResolution;
      var dYi = resolution * y * nominalResolution;
      center[0] += dXi * Math.cos(rotation) - dYi * Math.sin(rotation);
      center[1] += dXi * Math.sin(rotation) + dYi * Math.cos(rotation);
      frameState.animate = true;
      frameState.view2DState.center = center;
      frameState.view2DState.resolution = resolution * nominalResolution / deviceResolution;
      frameState.view2DState.rotation = rotation;
      frameState.viewHints[ol.ViewHint.ANIMATING] += 1;
    }
    return true;
  };

});

var ws = new goog.net.WebSocket();
ws.open('ws://134.34.14.49:8080/ws');
var eh = new goog.events.EventHandler();
eh.listen(ws, goog.net.WebSocket.EventType.MESSAGE, function(event) {
    osmLayer.setVisible(false);
    tileDebugLayer.setVisible(false);
    start = goog.now();
    map.beforeRender(animate);
}, false, this);
