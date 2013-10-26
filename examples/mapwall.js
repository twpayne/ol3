goog.require('ol.Map');
goog.require('ol.RendererHint');
goog.require('ol.View2D');
goog.require('ol.ViewHint');
goog.require('ol.control');
goog.require('ol.layer.Tile');
goog.require('ol.proj');
goog.require('ol.proj.EPSG3857');
goog.require('ol.source.BingMaps');
goog.require('spline');


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
    })
  ],
  renderer: ol.RendererHint.WEBGL,
  target: 'map',
  view: new ol.View2D({
    center: [0, 0],
    zoom: 2
  })
});

var waypoints = {
  "points":
    [
      { "time":0.0, "lat":47.688648, "long":9.187088, "angle":0, "zoom":10 },
      { "time":3.0, "lat":46.599885, "long":-1.764145, "angle":0, "zoom":10 },
      { "time":12.4, "lat":29.947253, "long":-83.668975, "angle":0, "zoom":10 },
      { "time":21.7, "lat":25.126901, "long":-79.957921, "angle":0, "zoom":10 },
      { "time":31.1, "lat":24.713522, "long":-81.080605, "angle":0, "zoom":10 },
      { "time":40.4, "lat":24.579384, "long":-81.674736, "angle":0, "zoom":10 },
      { "time":49.8, "lat":24.572638, "long":-81.699177, "angle":0, "zoom":10 },
      { "time":59.2, "lat":25.124044, "long":-81.085170, "angle":0, "zoom":10 },
      { "time":68.6, "lat":25.769284, "long":-80.273521, "angle":0, "zoom":10 },
      { "time":82.6, "lat":25.798763, "long":-80.236978, "angle":0, "zoom":10 },
      { "time":87.2, "lat":25.775158, "long":-80.141784, "angle":0, "zoom":10 },
      { "time":90.5, "lat":25.815258, "long":-80.121655, "angle":0, "zoom":10 },
      { "time":97.0, "lat":25.818243, "long":-80.021854, "angle":0, "zoom":10 }
    ]
};


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
    angles.push(point['angle']);
    zooms.push(point['zoom']);
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
var data = transpose(waypoints);
var latF = spline.makeInterpolator({time: data.times, ref: data.lats});
var lngF = spline.makeInterpolator({time: data.times, ref: data.lngs});
var angleF = spline.makeInterpolator({time: data.times, ref: data.angles});
var zoomF = spline.makeInterpolator({time: data.times, ref: data.zooms});


/**
 * @param {ol.Map} map Map.
 * @param {?ol.FrameState} frameState Frame state.
 * @return {boolean} Animate.
 */
var animate = function(map, frameState) {
  if (frameState.time - start > duration) {
    return false;
  } else if (!goog.isNull(frameState)) {
    var lat = latF(frameState.time - start);
    var lng = lngF(frameState.time - start);
    var zoom = zoomF(frameState.time - start);
    var rotation = angleF(frameState.time - start);
    var center = ol.proj.transform([lng, lat], 'EPSG:4326', 'EPSG:3857');
    var resolution = 2 * ol.proj.EPSG3857.HALF_SIZE /
        (ol.DEFAULT_TILE_SIZE * Math.pow(2, zoom));
    frameState.animate = true;
    frameState.view2DState.center = center;
    frameState.view2DState.resolution = resolution;
    frameState.view2DState.rotation = Math.PI * rotation / 180;
    frameState.viewHints[ol.ViewHint.ANIMATING] += 1;
  }
  return true;
};

map.beforeRender(animate);
