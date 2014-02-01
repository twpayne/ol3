goog.require('ol.Attribution');
goog.require('ol.Collection');
goog.require('ol.Map');
goog.require('ol.RendererHint');
goog.require('ol.View2D');
goog.require('ol.feature');
goog.require('ol.geom.GeometryType');
goog.require('ol.layer.Tile');
goog.require('ol.layer.Vector');
goog.require('ol.proj');
goog.require('ol.source.KML');
goog.require('ol.source.OSM');
goog.require('ol.source.State');
goog.require('ol.style.Icon');
goog.require('ol.style.Stroke');
goog.require('ol.style.Style');


var projection = ol.proj.get('EPSG:3857');

var routeSource = new ol.source.KML({
  reprojectTo: projection,
  url: 'xa2011.kml'
});

var layers = new ol.Collection([
  new ol.layer.Tile({
    source: new ol.source.OSM({
      attributions: [
        new ol.Attribution({
          html: 'All maps &copy; ' +
              '<a href="http://www.opencyclemap.org/">OpenCycleMap</a>'
        }),
        ol.source.OSM.DATA_ATTRIBUTION
      ],
      url: 'http://{a-c}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png'
    })
  }),
  new ol.layer.Vector({
    source: routeSource,
    styleFunction: function(feature, resolution) {
      if (feature.getGeometry().getType() == ol.geom.GeometryType.POINT) {
        return null;
      } else {
        return ol.feature.defaultStyleFunction(feature, resolution);
      }
    }
  })
]);

var view2D = new ol.View2D();


var map = new ol.Map({
  layers: layers,
  renderer: ol.RendererHint.CANVAS,
  target: 'map',
  view: view2D
});


var fitSource;
if (document.location.search === '') {
  fitSource = routeSource;
} else {
  var day = +document.location.search.substr(1) - 1;
  var daySource = new ol.source.KML({
    reprojectTo: projection,
    url: 'Jul' + (17 + day) + '.kml'
  });
  var dayStyle = [new ol.style.Style({
    stroke: new ol.style.Stroke({
      color: '#000',
      width: 3
    })
  })];
  layers.push(new ol.layer.Vector({
    source: daySource,
    styleFunction: function(feature, resolution) {
      return dayStyle;
    }
  }));
  var walkStyle = [new ol.style.Style({
    image: new ol.style.Icon({
      src: 'walk.png'
    })
  })];
  layers.push(new ol.layer.Vector({
    source: new ol.source.KML({
      reprojectTo: projection,
      url: 'Walk' + (17 + day) + '.kml'
    }),
    styleFunction: function(feature, resolution) {
      return walkStyle;
    }
  }));
  var flyStyle = [new ol.style.Style({
    image: new ol.style.Icon({
      src: 'fly.png'
    })
  })];
  layers.push(new ol.layer.Vector({
    source: new ol.source.KML({
      reprojectTo: projection,
      url: 'Fly' + (17 + day) + '.kml'
    }),
    styleFunction: function(feature, resolution) {
      return flyStyle;
    }
  }));
  var aStyle = [new ol.style.Style({
    image: new ol.style.Icon({
      src: 'a.png'
    })
  })];
  layers.push(new ol.layer.Vector({
    source: new ol.source.KML({
      reprojectTo: projection,
      url: 'A' + (17 + day) + '.kml'
    }),
    styleFunction: function(feature, resolution) {
      return aStyle;
    }
  }));
  var bStyle = [new ol.style.Style({
    image: new ol.style.Icon({
      src: 'b.png'
    })
  })];
  layers.push(new ol.layer.Vector({
    source: new ol.source.KML({
      reprojectTo: projection,
      url: 'B' + (17 + day) + '.kml'
    }),
    styleFunction: function(feature, resolution) {
      return bStyle;
    }
  }));
  fitSource = daySource;
}

fitSource.once('change', function() {
  if (fitSource.getState() == ol.source.State.READY) {
    view2D.fitExtent(fitSource.getExtent(), map.getSize());
  }
});
