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


/**
 * @const {number}
 */
var ZOOM_OFFSET = -3;


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
    center: ol.proj.transform([9.187088, 47.688648], 'EPSG:4326', 'EPSG:3857'),
    zoom: 17 + ZOOM_OFFSET
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
    angles.push(point['angle']);
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


goog.net.XhrIo.send('waypoints.json', function(event) {
  var x = /** @type {goog.net.XhrIo} */ (event.target);
  var waypoints = x.getResponseJson();

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

});
