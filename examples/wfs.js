goog.require('ol.Map');
goog.require('ol.View2D');
goog.require('ol.layer.Tile');
goog.require('ol.layer.Vector');
goog.require('ol.source.OSM');
goog.require('ol.source.WFSServer');


var map = new ol.Map({
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    }),
    new ol.layer.Vector({
      source: new ol.source.WFSServer({
        method : 'get',
        url: 'http://suite.opengeo.org/geoserver/wfs',
        wfsOptions: {
          featureNS: 'http://census.gov',
          featureType: 'states',
          projection: 'EPSG:4326'
        },
        wfsWriteGetFeatureOptions: {
          geometryName: 'the_geom',
          featureNS: 'usa',
          featurePrefix: '', // FIXME
          featureTypes: ['states']
        }
      })
    })
  ],
  renderer: 'canvas',
  target: 'map',
  view: new ol.View2D({
    center: [-10997148, 4569099],
    zoom: 4
  })
});
