goog.require('ol.Map');
goog.require('ol.RendererHint');
goog.require('ol.View2D');
goog.require('ol.ViewHint');
goog.require('ol.control');
goog.require('ol.layer.Tile');
goog.require('ol.proj');
goog.require('ol.proj.EPSG3857');
goog.require('ol.source.BingMaps');


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

var start = goog.now();
var duration = (2 * 60 + 15) * 1000;


/**
 * @param {number} time Time.
 * @return {number} Latitude in degrees.
 */
var latF = function(time) {
  return 47.689931;
};


/**
 * @param {number} time Time.
 * @return {number} Longitude in degrees.
 */
var lngF = function(time) {
  return 9.188445;
};


/**
 * @param {number} time Time.
 * @return {number} Zoom.
 */
var zoomF = function(time) {
  return 2 + (time - start) / 10000;
};


/**
 * @param {number} time Time.
 * @return {number} Rotation in degrees.
 */
var rotationF = function(time) {
  return (time - start) / 1000;
};


/**
 * @param {ol.Map} map Map.
 * @param {?ol.FrameState} frameState Frame state.
 * @return {boolean} Animate.
 */
var animate = function(map, frameState) {
  if (frameState.time - start > duration) {
    return false;
  } else if (!goog.isNull(frameState)) {
    var lat = latF(frameState.time);
    var lng = lngF(frameState.time);
    var zoom = zoomF(frameState.time);
    var rotation = rotationF(frameState.time);
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
