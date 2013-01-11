// FIXME recheck layer/map projection compatability when projection changes
// FIXME layer renderers should skip when they can't reproject
// FIXME add tilt and height?

goog.provide('ol.Map');
goog.provide('ol.MapEventType');
goog.provide('ol.MapProperty');
goog.provide('ol.RendererHint');

goog.require('goog.array');
goog.require('goog.async.AnimationDelay');
goog.require('goog.debug.Logger');
goog.require('goog.dispose');
goog.require('goog.dom');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.events');
goog.require('goog.events.BrowserEvent');
goog.require('goog.events.Event');
goog.require('goog.events.EventType');
goog.require('goog.events.KeyHandler');
goog.require('goog.events.KeyHandler.EventType');
goog.require('goog.events.MouseWheelEvent');
goog.require('goog.events.MouseWheelHandler');
goog.require('goog.events.MouseWheelHandler.EventType');
goog.require('goog.functions');
goog.require('goog.object');
goog.require('ol.BrowserFeature');
goog.require('ol.Collection');
goog.require('ol.Color');
goog.require('ol.Coordinate');
goog.require('ol.Extent');
goog.require('ol.FrameState');
goog.require('ol.MapBrowserEvent');
goog.require('ol.Object');
goog.require('ol.Pixel');
goog.require('ol.ResolutionConstraint');
goog.require('ol.RotationConstraint');
goog.require('ol.Size');
goog.require('ol.TileQueue');
goog.require('ol.TransformFunction');
goog.require('ol.View');
goog.require('ol.View2D');
goog.require('ol.View2DState');
goog.require('ol.control.Attribution');
goog.require('ol.control.Zoom');
goog.require('ol.interaction.DblClickZoom');
goog.require('ol.interaction.DragPan');
goog.require('ol.interaction.DragRotate');
goog.require('ol.interaction.DragZoom');
goog.require('ol.interaction.Interaction');
goog.require('ol.interaction.KeyboardPan');
goog.require('ol.interaction.KeyboardZoom');
goog.require('ol.interaction.MouseWheelZoom');
goog.require('ol.interaction.condition');
goog.require('ol.renderer.Layer');
goog.require('ol.renderer.Map');
goog.require('ol.renderer.dom');
goog.require('ol.renderer.dom.Map');
goog.require('ol.renderer.webgl');
goog.require('ol.renderer.webgl.Map');


/**
 * @define {boolean} Whether to enable DOM.
 */
ol.ENABLE_DOM = true;


/**
 * @define {boolean} Whether to enable WebGL.
 */
ol.ENABLE_WEBGL = true;


/**
 * @enum {string}
 */
ol.RendererHint = {
  DOM: 'dom',
  WEBGL: 'webgl'
};


/**
 * @type {Array.<ol.RendererHint>}
 */
ol.DEFAULT_RENDERER_HINTS = [
  ol.RendererHint.WEBGL,
  ol.RendererHint.DOM
];


/**
 * @enum {string}
 */
ol.MapProperty = {
  BACKGROUND_COLOR: 'backgroundColor',
  LAYERS: 'layers',
  SIZE: 'size',
  VIEW: 'view'
};



/**
 * @constructor
 * @extends {ol.Object}
 * @param {ol.MapOptions} mapOptions Map options.
 */
ol.Map = function(mapOptions) {

  goog.base(this);

  if (goog.DEBUG) {
    /**
     * @protected
     * @type {goog.debug.Logger}
     */
    this.logger = goog.debug.Logger.getLogger('ol.map.' + goog.getUid(this));
  }

  var mapOptionsInternal = ol.Map.createOptionsInternal(mapOptions);

  /**
   * @private
   * @type {goog.async.AnimationDelay}
   */
  this.animationDelay_ =
      new goog.async.AnimationDelay(this.renderFrame_, undefined, this);
  this.registerDisposable(this.animationDelay_);

  /**
   * @private
   * @type {?ol.FrameState}
   */
  this.frameState_ = null;

  /**
   * @private
   * @type {number}
   */
  this.freezeRenderingCount_ = 0;

  /**
   * @private
   * @type {boolean}
   */
  this.dirty_ = false;

  /**
   * @private
   * @type {Element}
   */
  this.target_ = mapOptionsInternal.target;

  /**
   * @private
   * @type {Element}
   */
  this.viewport_ = goog.dom.createDom(goog.dom.TagName.DIV, 'ol-viewport');
  this.viewport_.style.position = 'relative';
  this.viewport_.style.overflow = 'hidden';
  this.viewport_.style.width = '100%';
  this.viewport_.style.height = '100%';
  goog.dom.appendChild(this.target_, this.viewport_);

  /**
   * @private
   * @type {Element}
   */
  this.overlayContainer_ = goog.dom.createDom(goog.dom.TagName.DIV,
      'ol-overlaycontainer');
  goog.events.listen(this.overlayContainer_, [
    goog.events.EventType.CLICK,
    ol.BrowserFeature.HAS_TOUCH ?
        goog.events.EventType.TOUCHSTART : goog.events.EventType.MOUSEDOWN
  ], goog.events.Event.stopPropagation);
  goog.dom.appendChild(this.viewport_, this.overlayContainer_);

  var mapBrowserEventHandler = new ol.MapBrowserEventHandler(this);
  goog.events.listen(mapBrowserEventHandler, [
    ol.MapBrowserEvent.EventType.CLICK,
    ol.MapBrowserEvent.EventType.DBLCLICK,
    ol.MapBrowserEvent.EventType.DRAGSTART,
    ol.MapBrowserEvent.EventType.DRAG,
    ol.MapBrowserEvent.EventType.DRAGEND
  ], this.handleMapBrowserEvent, false, this);
  this.registerDisposable(mapBrowserEventHandler);

  // FIXME we probably shouldn't listen on document...
  var keyHandler = new goog.events.KeyHandler(document);
  goog.events.listen(keyHandler, goog.events.KeyHandler.EventType.KEY,
      this.handleBrowserEvent, false, this);
  this.registerDisposable(keyHandler);

  var mouseWheelHandler = new goog.events.MouseWheelHandler(this.viewport_);
  goog.events.listen(mouseWheelHandler,
      goog.events.MouseWheelHandler.EventType.MOUSEWHEEL,
      this.handleBrowserEvent, false, this);
  this.registerDisposable(mouseWheelHandler);

  /**
   * @type {ol.Collection}
   * @private
   */
  this.controls_ = mapOptionsInternal.controls;

  goog.events.listen(this.controls_, ol.CollectionEventType.ADD,
      this.handleControlsAdd_, false, this);
  goog.events.listen(this.controls_, ol.CollectionEventType.REMOVE,
      this.handleControlsRemove_, false, this);

  /**
   * @type {ol.Collection}
   * @private
   */
  this.interactions_ = mapOptionsInternal.interactions;

  /**
   * @type {ol.renderer.Map}
   * @private
   */
  this.renderer_ =
      new mapOptionsInternal.rendererConstructor(this.viewport_, this);
  this.registerDisposable(this.renderer_);

  /**
   * @private
   */
  this.viewportSizeMonitor_ = new goog.dom.ViewportSizeMonitor();

  goog.events.listen(this.viewportSizeMonitor_, goog.events.EventType.RESIZE,
      this.handleBrowserWindowResize, false, this);

  /**
   * @private
   * @type {Array.<ol.PreRenderFunction>}
   */
  this.preRenderFunctions_ = [];

  /**
   * @private
   * @type {Array.<ol.PostRenderFunction>}
   */
  this.postRenderFunctions_ = [];

  /**
   * @private
   * @type {function(this: ol.Map)}
   */
  this.handlePostRender_ = goog.bind(this.handlePostRender, this);

  /**
   * @private
   * @type {ol.TileQueue}
   */
  this.tileQueue_ = new ol.TileQueue(goog.bind(this.getTilePriority, this));

  this.setValues(mapOptionsInternal.values);

  this.handleBrowserWindowResize();

  this.controls_.forEach(
      /**
       * @param {ol.control.Control} control Control.
       */
      function(control) {
        control.setMap(this);
      }, this);

};
goog.inherits(ol.Map, ol.Object);


/**
 * @param {ol.PreRenderFunction} preRenderFunction Pre-render function.
 */
ol.Map.prototype.addPreRenderFunction = function(preRenderFunction) {
  this.requestRenderFrame();
  this.preRenderFunctions_.push(preRenderFunction);
};


/**
 * @param {Array.<ol.PreRenderFunction>} preRenderFunctions
 *     Pre-render functions.
 */
ol.Map.prototype.addPreRenderFunctions = function(preRenderFunctions) {
  this.requestRenderFrame();
  Array.prototype.push.apply(
      this.preRenderFunctions_, preRenderFunctions);
};


/**
 * @return {boolean} Can rotate.
 */
ol.Map.prototype.canRotate = function() {
  return this.renderer_.canRotate();
};


/**
 *
 * @inheritDoc
 */
ol.Map.prototype.disposeInternal = function() {
  goog.dom.removeNode(this.viewport_);
  goog.base(this, 'disposeInternal');
};


/**
 * Freeze rendering.
 */
ol.Map.prototype.freezeRendering = function() {
  ++this.freezeRenderingCount_;
};


/**
 * @return {ol.Color|undefined} Background color.
 */
ol.Map.prototype.getBackgroundColor = function() {
  return /** @type {ol.Color|undefined} */ (
      this.get(ol.MapProperty.BACKGROUND_COLOR));
};
goog.exportProperty(
    ol.Map.prototype,
    'getBackgroundColor',
    ol.Map.prototype.getBackgroundColor);


/**
 * @return {Element} Container.
 */
ol.Map.prototype.getTarget = function() {
  return this.target_;
};


/**
 * @return {ol.Collection} Controls.
 */
ol.Map.prototype.getControls = function() {
  return this.controls_;
};


/**
 * @param {ol.Pixel} pixel Pixel.
 * @return {ol.Coordinate} Coordinate.
 */
ol.Map.prototype.getCoordinateFromPixel = function(pixel) {
  return this.isDef() ? this.renderer_.getCoordinateFromPixel(pixel) : null;
};


/**
 * @return {ol.Collection} Interactions.
 */
ol.Map.prototype.getInteractions = function() {
  return this.interactions_;
};


/**
 * @return {ol.Collection} Layers.
 */
ol.Map.prototype.getLayers = function() {
  return /** @type {ol.Collection} */ (this.get(ol.MapProperty.LAYERS));
};


/**
 * @param {ol.Coordinate} coordinate Coordinate.
 * @return {ol.Pixel|undefined} Pixel.
 */
ol.Map.prototype.getPixelFromCoordinate = function(coordinate) {
  if (this.isDef()) {
    return this.renderer_.getPixelFromCoordinate(coordinate);
  } else {
    return undefined;
  }
};


/**
 * @return {ol.Size|undefined} Size.
 */
ol.Map.prototype.getSize = function() {
  return /** @type {ol.Size|undefined} */ (this.get(ol.MapProperty.SIZE));
};
goog.exportProperty(
    ol.Map.prototype,
    'getSize',
    ol.Map.prototype.getSize);


/**
 * @return {ol.View} View.
 */
ol.Map.prototype.getView = function() {
  return /** @type {ol.View} */ (this.get(ol.MapProperty.VIEW));
};
goog.exportProperty(
    ol.Map.prototype,
    'getView',
    ol.Map.prototype.getView);


/**
 * @return {Element} Viewport.
 */
ol.Map.prototype.getViewport = function() {
  return this.viewport_;
};


/**
 * @return {Element} The map's overlay container. Elements added to this
 * container won't let mousedown and touchstart events through to the map, so
 * clicks and gestures on an overlay don't trigger any MapBrowserEvent.
 */
ol.Map.prototype.getOverlayContainer = function() {
  return this.overlayContainer_;
};


/**
 * @param {ol.Tile} tile Tile.
 * @param {ol.Coordinate} tileCenter Tile center.
 * @param {number} tileResolution Tile resolution.
 * @return {number|undefined} Tile priority.
 */
ol.Map.prototype.getTilePriority = function(tile, tileCenter, tileResolution) {
  if (goog.isNull(this.frameState_)) {
    return undefined;
  } else {
    var center = this.frameState_.view2DState.center;
    var deltaX = tileCenter.x - center.x;
    var deltaY = tileCenter.y - center.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY) / tileResolution;
  }
};


/**
 * @param {goog.events.BrowserEvent} browserEvent Browser event.
 * @param {string=} opt_type Type.
 */
ol.Map.prototype.handleBrowserEvent = function(browserEvent, opt_type) {
  var type = opt_type || browserEvent.type;
  var mapBrowserEvent = new ol.MapBrowserEvent(type, this, browserEvent);
  this.handleMapBrowserEvent(mapBrowserEvent);
};


/**
 * @param {ol.CollectionEvent} collectionEvent Collection event.
 * @private
 */
ol.Map.prototype.handleControlsAdd_ = function(collectionEvent) {
  var control = /** @type {ol.control.Control} */ (collectionEvent.elem);
  control.setMap(this);
};


/**
 * @param {ol.CollectionEvent} collectionEvent Collection event.
 * @private
 */
ol.Map.prototype.handleControlsRemove_ = function(collectionEvent) {
  var control = /** @type {ol.control.Control} */ (collectionEvent.elem);
  control.setMap(null);
};


/**
 * @param {ol.MapBrowserEvent} mapBrowserEvent The event to handle.
 */
ol.Map.prototype.handleMapBrowserEvent = function(mapBrowserEvent) {
  var interactions = this.getInteractions();
  var interactionsArray = /** @type {Array.<ol.interaction.Interaction>} */
      (interactions.getArray());
  if (this.dispatchEvent(mapBrowserEvent) !== false) {
    for (var i = interactionsArray.length - 1; i >= 0; i--) {
      var interaction = interactionsArray[i];
      interaction.handleMapBrowserEvent(mapBrowserEvent);
      if (mapBrowserEvent.defaultPrevented) {
        break;
      }
    }
  }
};


/**
 * @protected
 */
ol.Map.prototype.handlePostRender = function() {
  this.tileQueue_.reprioritize(); // FIXME only call if needed
  this.tileQueue_.loadMoreTiles();
  goog.array.forEach(
      this.postRenderFunctions_,
      function(postRenderFunction) {
        postRenderFunction(this, this.frameState_);
      },
      this);
  this.postRenderFunctions_.length = 0;
};


/**
 * @protected
 */
ol.Map.prototype.handleBrowserWindowResize = function() {
  var size = new ol.Size(this.target_.clientWidth, this.target_.clientHeight);
  this.setSize(size);
};


/**
 * @return {boolean} Is defined.
 */
ol.Map.prototype.isDef = function() {
  var view = this.getView();
  return goog.isDef(view) && view.isDef() &&
      goog.isDefAndNotNull(this.getSize());
};


/**
 * Render.
 */
ol.Map.prototype.render = function() {
  if (this.animationDelay_.isActive()) {
    // pass
  } else if (this.freezeRenderingCount_ === 0) {
    this.animationDelay_.fire();
  } else {
    this.dirty_ = true;
  }
};


/**
 * Request that renderFrame_ be called some time in the future.
 */
ol.Map.prototype.requestRenderFrame = function() {
  if (this.freezeRenderingCount_ === 0) {
    if (!this.animationDelay_.isActive()) {
      this.animationDelay_.start();
    }
  } else {
    this.dirty_ = true;
  }
};


/**
 * @param {number} time Time.
 * @private
 */
ol.Map.prototype.renderFrame_ = function(time) {

  var i;

  if (this.freezeRenderingCount_ != 0) {
    return;
  }

  if (goog.DEBUG) {
    this.logger.info('renderFrame_');
  }

  var size = this.getSize();
  var layers = this.getLayers();
  var layersArray = goog.isDef(layers) ?
      /** @type {Array.<ol.layer.Layer>} */ (layers.getArray()) : undefined;
  var view = this.getView();
  var view2D = goog.isDef(view) ? this.getView().getView2D() : undefined;
  /** @type {?ol.FrameState} */
  var frameState = null;
  if (goog.isDef(layersArray) && goog.isDef(size) && goog.isDef(view2D) &&
      view2D.isDef()) {
    var backgroundColor = this.getBackgroundColor();
    var layerStates = {};
    goog.array.forEach(layersArray, function(layer) {
      layerStates[goog.getUid(layer)] = layer.getLayerState();
    });
    var view2DState = view2D.getView2DState();
    frameState = {
      animate: false,
      backgroundColor: goog.isDef(backgroundColor) ?
          backgroundColor : new ol.Color(1, 1, 1, 1),
      extent: null,
      layersArray: layersArray,
      layerStates: layerStates,
      postRenderFunctions: [],
      size: size,
      tileQueue: this.tileQueue_,
      view2DState: view2DState,
      time: time
    };
  }

  this.preRenderFunctions_ = goog.array.filter(
      this.preRenderFunctions_,
      function(preRenderFunction) {
        return preRenderFunction(this, frameState);
      },
      this);

  if (!goog.isNull(frameState)) {
    var center = view2DState.center;
    var resolution = view2DState.resolution;
    var rotation = view2DState.rotation;
    var x = resolution * size.width / 2;
    var y = resolution * size.height / 2;
    var corners = [
      new ol.Coordinate(-x, -y),
      new ol.Coordinate(-x, y),
      new ol.Coordinate(x, -y),
      new ol.Coordinate(x, y)
    ];
    var corner;
    for (i = 0; i < 4; ++i) {
      corner = corners[i];
      corner.rotate(rotation);
      corner.add(center);
    }
    frameState.extent = ol.Extent.boundingExtent.apply(null, corners);
  }

  this.renderer_.renderFrame(frameState);

  if (!goog.isNull(frameState)) {
    if (frameState.animate) {
      this.requestRenderFrame();
    }
    Array.prototype.push.apply(
        this.postRenderFunctions_, frameState.postRenderFunctions);
  }
  this.frameState_ = frameState;
  this.dirty_ = false;

  goog.global.setTimeout(this.handlePostRender_, 0);

};


/**
 * @param {ol.Color} backgroundColor Background color.
 */
ol.Map.prototype.setBackgroundColor = function(backgroundColor) {
  this.set(ol.MapProperty.BACKGROUND_COLOR, backgroundColor);
};
goog.exportProperty(
    ol.Map.prototype,
    'setBackgroundColor',
    ol.Map.prototype.setBackgroundColor);


/**
 * @param {ol.Collection} layers Layers.
 */
ol.Map.prototype.setLayers = function(layers) {
  this.set(ol.MapProperty.LAYERS, layers);
};
goog.exportProperty(
    ol.Map.prototype,
    'setLayers',
    ol.Map.prototype.setLayers);


/**
 * @param {ol.Size} size Size.
 */
ol.Map.prototype.setSize = function(size) {
  this.set(ol.MapProperty.SIZE, size);
};
goog.exportProperty(
    ol.Map.prototype,
    'setSize',
    ol.Map.prototype.setSize);


/**
 * @param {ol.IView} view View.
 */
ol.Map.prototype.setView = function(view) {
  this.set(ol.MapProperty.VIEW, view);
};
goog.exportProperty(
    ol.Map.prototype,
    'setView',
    ol.Map.prototype.setView);


/**
 * Unfreeze rendering.
 */
ol.Map.prototype.unfreezeRendering = function() {
  goog.asserts.assert(this.freezeRenderingCount_ > 0);
  if (--this.freezeRenderingCount_ === 0 && this.dirty_) {
    this.animationDelay_.fire();
  }
};


/**
 * @param {function(this: T)} f Function.
 * @param {T=} opt_obj Object.
 * @template T
 */
ol.Map.prototype.withFrozenRendering = function(f, opt_obj) {
  this.freezeRendering();
  try {
    f.call(opt_obj);
  } finally {
    this.unfreezeRendering();
  }
};


/**
 * @typedef {{controls: ol.Collection,
 *            interactions: ol.Collection,
 *            rendererConstructor:
 *                function(new: ol.renderer.Map, Element, ol.Map),
 *            target: Element,
 *            values: Object.<string, *>}}
 */
ol.MapOptionsInternal;


/**
 * @param {ol.MapOptions} mapOptions Map options.
 * @return {ol.MapOptionsInternal} Map options.
 */
ol.Map.createOptionsInternal = function(mapOptions) {

  /**
   * @type {Object.<string, *>}
   */
  var values = {};

  values[ol.MapProperty.LAYERS] = goog.isDef(mapOptions.layers) ?
      mapOptions.layers : new ol.Collection();

  values[ol.MapProperty.VIEW] = goog.isDef(mapOptions.view) ?
      mapOptions.view : new ol.View2D();

  /**
   * @type {function(new: ol.renderer.Map, Element, ol.Map)}
   */
  var rendererConstructor = ol.renderer.Map;

  /**
   * @type {Array.<ol.RendererHint>}
   */
  var rendererHints;
  if (goog.isDef(mapOptions.renderers)) {
    rendererHints = mapOptions.renderers;
  } else if (goog.isDef(mapOptions.renderer)) {
    rendererHints = [mapOptions.renderer];
  } else {
    rendererHints = ol.DEFAULT_RENDERER_HINTS;
  }

  var i, rendererHint;
  for (i = 0; i < rendererHints.length; ++i) {
    rendererHint = rendererHints[i];
    if (rendererHint == ol.RendererHint.DOM) {
      if (ol.ENABLE_DOM && ol.renderer.dom.isSupported()) {
        rendererConstructor = ol.renderer.dom.Map;
        break;
      }
    } else if (rendererHint == ol.RendererHint.WEBGL) {
      if (ol.ENABLE_WEBGL && ol.renderer.webgl.isSupported()) {
        rendererConstructor = ol.renderer.webgl.Map;
        break;
      }
    }
  }

  /**
   * @type {ol.Collection}
   */
  var controls;
  if (goog.isDef(mapOptions.controls)) {
    controls = mapOptions.controls;
  } else {
    controls = ol.Map.createControls_(mapOptions);
  }

  /**
   * @type {ol.Collection}
   */
  var interactions;
  if (goog.isDef(mapOptions.interactions)) {
    interactions = mapOptions.interactions;
  } else {
    interactions = ol.Map.createInteractions_(mapOptions);
  }

  /**
   * @type {Element}
   */
  var target = goog.dom.getElement(mapOptions.target);

  return {
    controls: controls,
    interactions: interactions,
    rendererConstructor: rendererConstructor,
    target: target,
    values: values
  };

};


/**
 * @private
 * @param {ol.MapOptions} mapOptions Map options.
 * @return {ol.Collection} Controls.
 */
ol.Map.createControls_ = function(mapOptions) {

  var controls = new ol.Collection();

  controls.push(new ol.control.Attribution({}));

  var zoomDelta = goog.isDef(mapOptions.zoomDelta) ?
      mapOptions.zoomDelta : 4;
  controls.push(new ol.control.Zoom({
    delta: zoomDelta
  }));

  return controls;

};


/**
 * @private
 * @param {ol.MapOptions} mapOptions Map options.
 * @return {ol.Collection} Interactions.
 */
ol.Map.createInteractions_ = function(mapOptions) {

  var interactions = new ol.Collection();

  var rotate = goog.isDef(mapOptions.rotate) ?
      mapOptions.rotate : true;
  if (rotate) {
    interactions.push(
        new ol.interaction.DragRotate(ol.interaction.condition.altKeyOnly));
  }

  var doubleClickZoom = goog.isDef(mapOptions.doubleClickZoom) ?
      mapOptions.doubleClickZoom : true;
  if (doubleClickZoom) {
    var zoomDelta = goog.isDef(mapOptions.zoomDelta) ?
        mapOptions.zoomDelta : 4;
    interactions.push(new ol.interaction.DblClickZoom(zoomDelta));
  }

  var dragPan = goog.isDef(mapOptions.dragPan) ?
      mapOptions.dragPan : true;
  if (dragPan) {
    interactions.push(
        new ol.interaction.DragPan(ol.interaction.condition.noModifierKeys));
  }

  var keyboard = goog.isDef(mapOptions.keyboard) ?
      mapOptions.keyboard : true;
  var keyboardPanOffset = goog.isDef(mapOptions.keyboardPanOffset) ?
      mapOptions.keyboardPanOffset : 80;
  if (keyboard) {
    interactions.push(new ol.interaction.KeyboardPan(keyboardPanOffset));
    interactions.push(new ol.interaction.KeyboardZoom());
  }

  var mouseWheelZoom = goog.isDef(mapOptions.mouseWheelZoom) ?
      mapOptions.mouseWheelZoom : true;
  if (mouseWheelZoom) {
    var mouseWheelZoomDelta =
        goog.isDef(mapOptions.mouseWheelZoomDelta) ?
            mapOptions.mouseWheelZoomDelta : 1;
    interactions.push(new ol.interaction.MouseWheelZoom(mouseWheelZoomDelta));
  }

  var shiftDragZoom = goog.isDef(mapOptions.shiftDragZoom) ?
      mapOptions.shiftDragZoom : true;
  if (shiftDragZoom) {
    interactions.push(
        new ol.interaction.DragZoom(ol.interaction.condition.shiftKeyOnly));
  }

  return interactions;

};
