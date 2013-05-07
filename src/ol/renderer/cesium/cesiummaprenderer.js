goog.provide('ol.renderer.cesium.Map');

goog.require('goog.asserts');
goog.require('goog.debug.Logger');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('ol.Size');
goog.require('ol.layer.TileLayer');
goog.require('ol.renderer.Map');
goog.require('ol.renderer.cesium.Layer');



/**
 * @constructor
 * @extends {ol.renderer.Map}
 * @param {Element} container Container.
 * @param {ol.Map} map Map.
 */
ol.renderer.cesium.Map = function(container, map) {
  goog.base(this, container, map);

  if (goog.DEBUG) {
    /**
     * @inheritDoc
     */
    this.logger = goog.debug.Logger.getLogger(
        'ol.renderer.cesium.map.' + goog.getUid(this));
  }

  /**
   * @private
   * @type {Element}
   */
  this.canvas_ = goog.dom.createElement(goog.dom.TagName.CANVAS);
  this.canvas_.height = container.clientHeight;
  this.canvas_.width = container.clientWidth;
  this.canvas_.className = 'ol-unselectable';
  this.canvas_.oncontextmenu = function() {
    return false;
  };
  goog.dom.insertChildAt(container, this.canvas_, 0);

  /**
   * @private
   * @type {ol.Size}
   */
  this.canvasSize_ = new ol.Size(container.clientHeight, container.clientWidth);

  /**
   * @private
   * @type {Cesium.Scene}
   */
  this.scene_ = new Cesium.Scene(this.canvas_);

  var ellipsoid = Cesium.Ellipsoid.WGS84;
  var cb = new Cesium.CentralBody(ellipsoid);
  this.scene_.getPrimitives().setCentralBody(cb);

  this.scene_._screenSpaceCameraController =
      this.scene_._screenSpaceCameraController &&
      this.scene_._screenSpaceCameraController.destroy();
  this.scene_._screenSpaceCameraController = {
    update: function() {}
  };

  var that = this;
  function updateCesiumCamera() {
    var view = that.getMap().getView();
    if (typeof view === 'undefined') {
      return;
    }
    view = view.getView3D();

    var center = view.getCenter();
    var centerCartesian3 = new Cesium.Cartesian3(
        center[0], center[1], center[2]);

    var direction = view.getDirection();
    var directionCartesian3 = new Cesium.Cartesian3(
        direction[0], direction[1], direction[2]);

    var up = view.getUp();
    var upCartesian3 = new Cesium.Cartesian3(
        up[0], up[1], up[2]);

    var right = view.getRight();
    var rightCartesian3 = new Cesium.Cartesian3(
        right[0], right[1], right[2]);

    var camera = that.scene_.getCamera();

    Cesium.Cartesian3.clone(centerCartesian3, camera.position);
    Cesium.Cartesian3.clone(directionCartesian3, camera.direction);
    Cesium.Cartesian3.clone(upCartesian3, camera.up);
    Cesium.Cartesian3.clone(rightCartesian3, camera.right);
  }

  function tick() {
    that.scene_.initializeFrame();
    updateCesiumCamera();
    that.scene_.render();
    Cesium.requestAnimationFrame(tick);
  }
  tick();
};
goog.inherits(ol.renderer.cesium.Map, ol.renderer.Map);


/**
 * @inheritDoc
 */
ol.renderer.cesium.Map.prototype.getCanvas = function() {
  return this.canvas_;
};


/**
 * @return {Cesium.Scene} Cesium's scene.
 */
ol.renderer.cesium.Map.prototype.getScene = function() {
  return this.scene_;
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Map.prototype.createLayerRenderer = function(layer) {
  if (layer instanceof ol.layer.TileLayer) {
    var layerRenderer = new ol.renderer.cesium.Layer(this, layer);

    var cb = this.scene_.getPrimitives().getCentralBody();
    cb.getImageryLayers().add(layerRenderer.getImageryLayer());

    return layerRenderer;
  } else {
    goog.asserts.assert(false);
    return null;
  }
};


/**
 * @param {?ol.FrameState} frameState Frame state.
 * @private
 */
ol.renderer.cesium.Map.prototype.createLayerRenderers_ = function(frameState) {
  var layersArray = frameState.layersArray;
  var i, ii, layer;
  for (i = 0, ii = layersArray.length; i < ii; ++i) {
    layer = layersArray[i];
    // getLayerRenderer creates a layer renderer for layer if
    // we don't have one already.
    this.getLayerRenderer(layer);
  }
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Map.prototype.renderFrame = function(frameState) {
  if (!goog.isNull(frameState)) {
    this.calculateMatrices2D(frameState);
    this.createLayerRenderers_(frameState);
    this.scheduleRemoveUnusedLayerRenderers(frameState);

    var size = frameState.size;
    if (!this.canvasSize_.equals(size)) {
      this.canvas_.width = size.width;
      this.canvas_.height = size.height;
      this.canvasSize_ = size;
      var frustum = this.scene_.getCamera().frustum;
      frustum.aspectRatio = size.width / size.height;
    }
  }
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Map.prototype.removeLayerRenderer = function(layerRenderer) {
  var cb = this.scene_.getPrimitives().getCentralBody();
  cb.getImageryLayers().remove(layerRenderer.getImageryLayer(), false);
};


/**
 * @inheritDoc
 */
ol.renderer.cesium.Map.prototype.disposeInternal = function() {
  this.scene_ = this.scene_ && this.scene_.destroy();
  goog.base(this, 'disposeInternal');
};
