goog.require('goog.debug.Console');
goog.require('goog.debug.Logger');
goog.require('goog.debug.Logger.Level');
goog.require('ol.Coordinate');
goog.require('ol.Map');
goog.require('ol.RendererHint');
goog.require('ol.View2D');
goog.require('ol.animation');
goog.require('ol.control.MousePosition');
goog.require('ol.interaction.Keyboard');
goog.require('ol.layer.TileLayer');
goog.require('ol.source.MapQuestOpenAerial');


if (goog.DEBUG) {
  goog.debug.Console.autoInstall();
  goog.debug.Logger.getLogger('ol').setLevel(goog.debug.Logger.Level.INFO);
}


var LONDON = ol.Projection.transformWithCodes(
    new ol.Coordinate(-0.12755, 51.507222), 'EPSG:4326', 'EPSG:3857');
var MOSCOW = ol.Projection.transformWithCodes(
    new ol.Coordinate(37.6178, 55.7517), 'EPSG:4326', 'EPSG:3857');

var layer = new ol.layer.TileLayer({
  source: new ol.source.MapQuestOpenAerial()
});

var view = new ol.View2D({
  center: new ol.Coordinate(0, 0),
  zoom: 1
});

var domMap = new ol.Map({
  layers: new ol.Collection([layer]),
  renderer: ol.RendererHint.DOM,
  target: 'domMap',
  view: view
});

domMap.getControls().push(new ol.control.MousePosition({
  coordinateFormat: ol.Coordinate.toStringHDMS,
  projection: ol.Projection.getFromCode('EPSG:4326'),
  target: document.getElementById('domMousePosition'),
  undefinedHtml: '&nbsp;'
}));

var webglMap = new ol.Map({
  renderer: ol.RendererHint.WEBGL,
  target: 'webglMap'
});
if (webglMap !== null) {
  webglMap.bindTo('layers', domMap);
  webglMap.bindTo('view', domMap);
}

webglMap.getControls().push(new ol.control.MousePosition({
  coordinateFormat: ol.Coordinate.toStringHDMS,
  projection: ol.Projection.getFromCode('EPSG:4326'),
  target: document.getElementById('webglMousePosition'),
  undefinedHtml: '&nbsp;'
}));

var keyboardInteraction = new ol.interaction.Keyboard();
keyboardInteraction.addCallback('0', function() {
  layer.setBrightness(0);
  layer.setContrast(1);
  layer.setHue(0);
  layer.setSaturation(1);
  layer.setOpacity(1);
  layer.setVisible(true);
});
keyboardInteraction.addCallback('b', function() {
  layer.setBrightness(layer.getBrightness() - 0.1);
});
keyboardInteraction.addCallback('B', function() {
  layer.setBrightness(layer.getBrightness() + 0.1);
});
keyboardInteraction.addCallback('c', function() {
  layer.setContrast(layer.getContrast() - 0.1);
});
keyboardInteraction.addCallback('C', function() {
  // contrast is unbounded, but for this example we clamp to 3
  layer.setContrast(Math.min(3, layer.getContrast() + 0.1));
});
keyboardInteraction.addCallback('h', function() {
  layer.setHue(layer.getHue() - (Math.PI / 5));
});
keyboardInteraction.addCallback('H', function() {
  layer.setHue(layer.getHue() + (Math.PI / 5));
});
keyboardInteraction.addCallback('j', function() {
  var bounce = ol.animation.createBounce(2 * view.getResolution());
  domMap.addPreRenderFunction(bounce);
  webglMap.addPreRenderFunction(bounce);
});
keyboardInteraction.addCallback('l', function() {
  var panFrom = ol.animation.createPanFrom(view.getCenter());
  domMap.addPreRenderFunction(panFrom);
  webglMap.addPreRenderFunction(panFrom);
  view.setCenter(LONDON);
});
keyboardInteraction.addCallback('L', function() {
  var start = Date.now();
  var duration = 5000;
  var bounce = ol.animation.createBounce(
      2 * view.getResolution(), duration, start);
  var panFrom = ol.animation.createPanFrom(view.getCenter(), duration, start);
  var spin = ol.animation.createSpin(duration, 2, start);
  var preRenderFunctions = [bounce, panFrom, spin];
  domMap.addPreRenderFunctions(preRenderFunctions);
  webglMap.addPreRenderFunctions(preRenderFunctions);
  view.setCenter(LONDON);
});
keyboardInteraction.addCallback('m', function() {
  var panFrom = ol.animation.createPanFrom(view.getCenter(), 1000);
  domMap.addPreRenderFunction(panFrom);
  webglMap.addPreRenderFunction(panFrom);
  view.setCenter(MOSCOW);
});
keyboardInteraction.addCallback('M', function() {
  var start = Date.now();
  var duration = 5000;
  var bounce = ol.animation.createBounce(
      2 * view.getResolution(), duration, start);
  var panFrom = ol.animation.createPanFrom(view.getCenter(), duration, start);
  var spin = ol.animation.createSpin(duration, -2, start);
  var preRenderFunctions = [bounce, panFrom, spin];
  domMap.addPreRenderFunctions(preRenderFunctions);
  webglMap.addPreRenderFunctions(preRenderFunctions);
  view.setCenter(MOSCOW);
});
keyboardInteraction.addCallback('o', function() {
  layer.setOpacity(layer.getOpacity() - 0.1);
});
keyboardInteraction.addCallback('O', function() {
  layer.setOpacity(layer.getOpacity() + 0.1);
});
keyboardInteraction.addCallback('r', function() {
  view.setRotation(0);
});
keyboardInteraction.addCallback('s', function() {
  layer.setSaturation(layer.getSaturation() - 0.1);
});
keyboardInteraction.addCallback('S', function() {
  // saturation is unbounded, but for this example we clamp to 3
  layer.setSaturation(Math.min(3, layer.getSaturation() + 0.1));
});
keyboardInteraction.addCallback('vV', function() {
  layer.setVisible(!layer.getVisible());
});
keyboardInteraction.addCallback('x', function() {
  var spin = ol.animation.createSpin(2000, 2);
  domMap.addPreRenderFunction(spin);
  webglMap.addPreRenderFunction(spin);
});
keyboardInteraction.addCallback('X', function() {
  var spin = ol.animation.createSpin(2000, -2);
  domMap.addPreRenderFunction(spin);
  webglMap.addPreRenderFunction(spin);
});
domMap.getInteractions().push(keyboardInteraction);
