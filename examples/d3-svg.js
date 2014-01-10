// NOCOMPILE
// this example uses d3 for which we don't have an externs file.
goog.require('ol');
goog.require('ol.Map');
goog.require('ol.View2D');
goog.require('ol.extent');
goog.require('ol.layer.Element');
goog.require('ol.layer.Tile');
goog.require('ol.proj');
goog.require('ol.source.Element');
goog.require('ol.source.Stamen');


var map = new ol.Map({
  layers: [
    new ol.layer.Tile({
      source: new ol.source.Stamen({
        layer: 'watercolor'
      })
    })
  ],
  renderer: 'dom',
  target: 'map',
  view: new ol.View2D({
    center: ol.proj.transform([-97, 38], 'EPSG:4326', 'EPSG:3857'),
    zoom: 4
  })
});


/**
 * Load the topojson data and create an ol.layer.Image for that data.
 */
d3.json('data/us.json', function(error, us) {
  var features = topojson.feature(us, us.objects.counties);

  var svgNS = 'http://www.w3.org/2000/svg';
  var svgElement = document.createElementNS(svgNS, 'svg');
  var svgSelection = d3.select(svgElement);
  svgSelection.append('path')
      .attr('stroke', 'black')
      .attr('fill', 'none');

  var d3Projection = d3.geo.mercator().scale(1).translate([0, 0]);
  var d3Path = d3.geo.path().projection(d3Projection);

  var pixelBounds = d3Path.bounds(features);
  var pixelBoundsWidth = pixelBounds[1][0] - pixelBounds[0][0];
  var pixelBoundsHeight = pixelBounds[1][1] - pixelBounds[0][1];

  var geoBounds = d3.geo.bounds(features);

  /**
   * This function uses d3 to render the topojson features to a canvas.
   * @param {ol.Coordinate} center Center.
   * @param {number} resolution Resolution.
   * @param {number} rotation Rotation.
   * @param {ol.Size} size Size.
   * @param {ol.proj.Projection} projection Projection.
   * @return {Element}
   */
  var elementFunction = function(center, resolution, rotation,
      size, projection) {

    var geoBoundsLeftBottom = ol.proj.transform(
        geoBounds[0], 'EPSG:4326', projection);
    var geoBoundsRightTop = ol.proj.transform(
        geoBounds[1], 'EPSG:4326', projection);
    var geoBoundsWidth = geoBoundsRightTop[0] - geoBoundsLeftBottom[0];
    if (geoBoundsWidth < 0) {
      geoBoundsWidth += ol.extent.getWidth(projection.getExtent());
    }
    var geoBoundsHeight = geoBoundsRightTop[1] - geoBoundsLeftBottom[1];

    var widthResolution = geoBoundsWidth / pixelBoundsWidth;
    var heightResolution = geoBoundsHeight / pixelBoundsHeight;
    var r = Math.max(widthResolution, heightResolution);
    var scale = r / resolution;

    var epsg4326Center = ol.proj.transform(center, projection, 'EPSG:4326');
    d3Projection
        .scale(scale)
        .center(epsg4326Center)
        .translate([size[0] / 2, size[1] / 2]);

    svgSelection.attr('width', size[0]).attr('height', size[1]);

    d3Path = d3Path.projection(d3Projection);
    svgSelection.select('path')
        .attr('d', d3Path(features));

    return svgElement;

  };

  var layer = new ol.layer.Element({
    source: new ol.source.Element({
      elementFunction: elementFunction,
      projection: 'EPSG:3857'
    })
  });
  map.addLayer(layer);
});
