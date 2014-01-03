/**
 * @externs
 * @see http://cesium.agi.com/
 */
var Cesium = function() {};


/**
 * @param {Function=} callback
 */
Cesium.requestAnimationFrame = function(callback) {};

/**
 * @constructor
 */
Cesium.Camera = function() {};


/**
 * @type {Cesium.Cartesian3}
 */
Cesium.Camera.prototype.direction;


/**
 * @type {Cesium.PerspectiveFrustrum}
 */
Cesium.Camera.prototype.frustum;


/**
 * @type {Cesium.Cartesian3}
 */
Cesium.Camera.prototype.position;


/**
 * @type {Cesium.Cartesian3}
 */
Cesium.Camera.prototype.right;


/**
 * @type {Cesium.Matrix4}
 */
Cesium.Camera.prototype.transform;


/**
 * @type {Cesium.Cartesian3}
 */
Cesium.Camera.prototype.up;



/**
 * @constructor
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
Cesium.Cartesian3 = function(x, y, z) {};


/**
 * @type {Cesium.Cartesian3}
 */
Cesium.Cartesian3.UNIT_X;


/**
 * @type {Cesium.Cartesian3}
 */
Cesium.Cartesian3.UNIT_Y;


/**
 * @type {Cesium.Cartesian3}
 */
Cesium.Cartesian3.UNIT_Z;


/**
 * @type {Cesium.Cartesian3}
 */
Cesium.Cartesian3.ZERO;


/**
 * @param {Cesium.Cartesian3} cartesian
 * @param {Cesium.Cartesian3} result
 * @return {Cesium.Cartesian3}
 */
Cesium.Cartesian3.normalize = function(cartesian, result) {};


/**
 * @param {Cesium.Cartesian3} cartesian
 * @param {Cesium.Cartesian3} result
 * @return {Cesium.Cartesian3}
 */
Cesium.Cartesian3.negate = function(cartesian, result) {};


/**
 * @param {Cesium.Cartesian3} left
 * @param {Cesium.Cartesian3} right
 * @param {Cesium.Cartesian3} result
 * @return {Cesium.Cartesian3}
 */
Cesium.Cartesian3.cross = function(left, right, result) {};


/**
 * @param {Cesium.Cartesian3} left
 * @param {Cesium.Cartesian3} right
 * @return {number}
 */
Cesium.Cartesian3.dot = function(left, right) {};


/**
 * @param {Cesium.Cartesian3} cartesian
 * @param {Cesium.Cartesian3} result
 * @return {Cesium.Cartesian3}
 */
Cesium.Cartesian3.clone = function(cartesian, result) {};


/**
 * @constructor
 * @param {number} longitude
 * @param {number} latitude
 * @param {number} height
 */
Cesium.Cartographic = function(longitude, latitude, height) {};


/**
 * @type {number}
 */
Cesium.Cartographic.prototype.longitude;


/**
 * @type {number}
 */
Cesium.Cartographic.prototype.latitude;


/**
 * @type {number}
 */
Cesium.Cartographic.prototype.height;



/**
 * @constructor
 * @param {Cesium.Ellipsoid} ellipsoid
 */
Cesium.CentralBody = function(ellipsoid) {};


/**
 * @return {Cesium.ImageryLayerCollection}
 */
Cesium.CentralBody.prototype.getImageryLayers = function() {};



/**
 * @constructor
 */
Cesium.CompositePrimitive = function() {};


/**
 * @return {Cesium.CentralBody}
 */
Cesium.CompositePrimitive.prototype.getCentralBody = function() {};


/**
 * @param {Cesium.CentralBody} centralBody
 */
Cesium.CompositePrimitive.prototype.setCentralBody = function(centralBody) {};



/**
 * @constructor
 */
Cesium.Context = function() {};



/**
 * @constructor
 * @param {string} text
 * @param {string} imageUrl
 * @param {string} link
 */
Cesium.Credit = function(text, imageUrl, link) {};



/**
 * @constructor
 * @param {string} proxy
 */
Cesium.DefaultProxy = function(proxy) {};



/**
 * @constructor
 */
Cesium.Event = function() {};



/**
 * @constructor
 * @extends {Cesium.TilingScheme}
 */
Cesium.GeographicTilingScheme = function() {};



/**
 * @constructor
 * @param {Cesium.ImageryProvider} imageryProvider
 */
Cesium.ImageryLayer = function(imageryProvider) {};


/**
 * @return {Cesium.ImageryProvider} provider
 */
Cesium.ImageryLayer.prototype.getImageryProvider = function() {};



/**
 * @constructor
 */
Cesium.ImageryLayerCollection = function() {};


/**
 * @param {Cesium.ImageryProvider} provider
 */
Cesium.ImageryLayerCollection.prototype.addImageryProvider =
    function(provider) {};


/**
 * @param {Cesium.ImageryLayer} layer
 */
Cesium.ImageryLayerCollection.prototype.add = function(layer) {};


/**
 * @param {Cesium.ImageryLayer} layer
 * @param {boolean} destroy
 */
Cesium.ImageryLayerCollection.prototype.remove = function(layer, destroy) {};



/**
 * @constructor
 */
Cesium.ImageryProvider = function() {};


/**
 * @return {boolean}
 */
Cesium.ImageryProvider.prototype.isReady = function() {};


/**
 * @return {Cesium.Extent}
 */
Cesium.ImageryProvider.prototype.getExtent = function() {};


/**
 * @return {number}
 */
Cesium.ImageryProvider.prototype.getTileWidth = function() {};


/**
 * @return {number}
 */
Cesium.ImageryProvider.prototype.getTileHeight = function() {};


/**
 * @return {number}
 */
Cesium.ImageryProvider.prototype.getMaximumLevel = function() {};


/**
 * @return {number}
 */
Cesium.ImageryProvider.prototype.getMinimumLevel = function() {};


/**
 *  @return {Cesium.TilingScheme}
 */
Cesium.ImageryProvider.prototype.getTilingScheme = function() {};


/**
 * @return {Cesium.TileDiscardPolicy}
 */
Cesium.ImageryProvider.prototype.getTileDiscardPolicy = function() {};


/**
 * @return {Cesium.Event} The event.
 */
Cesium.ImageryProvider.prototype.getErrorEvent = function() {};


/**
 * @return {HTMLImageElement|HTMLCanvasElement|undefined}
 */
Cesium.ImageryProvider.prototype.getCredit = function() {};


/**
 * @param {Array.<string>} hostnames
 * @param {number} hostnameIndex
 * @param {number} x
 * @param {number} y
 * @param {number} level
 * @return {Cesium.Promise|undefined}
 */
Cesium.ImageryProvider.prototype.requestImage =
    function(hostnames, hostnameIndex, x, y, level) {};


/**
 * @param {Cesium.ImageryProvider} imageryProvider
 * @param {string} url
 * @return {Cesium.Promise}
 */
Cesium.ImageryProvider.loadImage = function(imageryProvider, url) {};



/**
 * @constructor
 * @param {Cesium.Cartesian3} radii
 */
Cesium.Ellipsoid = function(radii) {};


/**
 * @type {Cesium.Ellipsoid}
 */
Cesium.Ellipsoid.WGS84;


/**
 * @param {Cesium.Cartographic} cartographic
 * @param {Cesium.Cartesian3} result
 * @return {Cesium.Cartesian3}
 */
Cesium.Ellipsoid.prototype.cartographicToCartesian = function(cartographic, result) {};


/**
 * @param {Cesium.Cartesian3} cartesian
 * @param {Cesium.Cartographic} result
 * @return {Cesium.Cartographic}
 */
Cesium.Ellipsoid.prototype.cartesianToCartographic = function(cartesian, result) {};



/**
 * @constructor
 * @param {number} west
 * @param {number} south
 * @param {number} east
 * @param {number} north
 */
Cesium.Extent = function(west, south, east, north) {};



/**
 * @constructor
 */
Cesium.FeatureDetection = function() {};


/**
 * @return {boolean}
 */
Cesium.FeatureDetection.supportsCrossOriginImagery = function() {};



/**
 * @constructor
 */
Cesium.Math = function() {};


/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @return {number}
 */
Cesium.Math.clamp = function(value, min, max) {};


/**
 * @type {number}
 */
Cesium.Math.PI_OVER_TWO;


/**
 * @type {number}
 */
Cesium.Math.TWO_PI;



/**
 * @constructor
 */
Cesium.Matrix3 = function() {};


/**
 * @param {Cesium.Quaternion} quaternion
 */
Cesium.Matrix3.fromQuaternion = function(quaternion) {};


/**
 * @param {Cesium.Matrix3} matrix
 * @param {Cesium.Cartesian3} cartesian
 * @param {Cesium.Cartesian3} result
 * @return {Cesium.Cartesian3}
 */
Cesium.Matrix3.multiplyByVector = function(matrix, cartesian, result) {};



/**
 * @constructor
 */
Cesium.Matrix4 = function() {};



/**
 * @constructor
 * @param {Object} options
 * @extends {Cesium.ImageryProvider}
 */
Cesium.OpenStreetMapImageryProvider = function(options) {};



/**
 * @constructor
 */
Cesium.PerspectiveFrustrum = function() {};


/**
 * @type {number}
 */
Cesium.PerspectiveFrustrum.prototype.aspectRatio;


/**
 * @type {number}
 */
Cesium.PerspectiveFrustrum.prototype.far;


/**
 * @type {number}
 */
Cesium.PerspectiveFrustrum.prototype.fovy;


/**
 * @type {number}
 */
Cesium.PerspectiveFrustrum.prototype.near;



/**
 * @constructor
 */
Cesium.Promise = function() {};



/**
 * @constructor
 */
Cesium.Quaternion = function() {};


/**
 * @param {Cesium.Cartesian3} axis
 * @param {number} angle
 */
Cesium.Quaternion.fromAxisAngle = function(axis, angle) {};



/**
 * @constructor
 * @param {HTMLCanvasElement|Element} canvas
 */
Cesium.Scene = function(canvas) {};


/**
 * @return {Cesium.Camera}
 */
Cesium.Scene.prototype.getCamera = function() {};


/**
 * @return {HTMLCanvasElement}
 */
Cesium.Scene.prototype.getCanvas = function() {};


/**
 * @return {Cesium.Context}
 */
Cesium.Scene.prototype.getContext = function() {};


/**
 * @return {Cesium.CompositePrimitive}
 */
Cesium.Scene.prototype.getPrimitives = function() {};


/**
 */
Cesium.Scene.prototype.initializeFrame = function() {};


/**
 */
Cesium.Scene.prototype.render = function() {};


/**
 */
Cesium.Scene.prototype.destroy = function() {};


/**
 * @type {Cesium.SceneMode}
 */
Cesium.Scene.prototype.mode;


/**
 * @type {Object}
 */
Cesium.Scene.prototype.scene2D;


/**
 * @type {Cesium.SkyBox}
 */
Cesium.Scene.prototype.skyBox;



/**
 * @constructor
 */
Cesium.SceneMode = function() {};


/**
 * @type {Cesium.SceneMode}
 */
Cesium.SceneMode.COLOMBUS_VIEW;


/**
 * @type {Cesium.SceneMode}
 */
Cesium.SceneMode.MORPHING;


/**
 * @type {Cesium.SceneMode}
 */
Cesium.SceneMode.SCENE2D;


/**
 * @type {Cesium.SceneMode}
 */
Cesium.SceneMode.SCENE3D;



/**
 * @constructor
 * @extends {Cesium.ImageryProvider}
 * @param {Cesium.SingleTileImageryProviderOptions} options
 */
Cesium.SingleTileImageryProvider = function(options) {};


/**
 * @typedef {{url: string}}
 */
Cesium.SingleTileImageryProviderOptions;



/**
 * @constructor
 */
Cesium.SkyAtmosphere = function() {};


/**
 * @constructor
 * @param {{positiveX: string, negativeX: string,
 *          positiveY: string, negativeY: string,
 *          positiveZ: string, negativeZ: string}} options
 */
Cesium.SkyBox = function(options) {};



/**
 * @interface
 * HACK This type definition prevents positiveX and friends
 * to be renamed when passing options to Cesium.SkyBox. There
 * must be a better way to do this!
 */
Cesium.SkyBoxOptions_ = function() {};


/**
 * @type {string}
 */
Cesium.SkyBoxOptions_.prototype.positiveX;


/**
 * @type {string}
 */
Cesium.SkyBoxOptions_.prototype.negativeX;


/**
 * @type {string}
 */
Cesium.SkyBoxOptions_.prototype.positiveY;


/**
 * @type {string}
 */
Cesium.SkyBoxOptions_.prototype.negativeY;


/**
 * @type {string}
 */
Cesium.SkyBoxOptions_.prototype.positiveZ;


/**
 * @type {string}
 */
Cesium.SkyBoxOptions_.prototype.negativeZ;


/**
 * @constructor
 */
Cesium.TileDiscardPolicy = function() {};


/**
 * @return {boolean}
 */
Cesium.TileDiscardPolicy.prototype.isReady = function() {};


/**
 * @param {Image|Cesium.Promise} image
 * @return {boolean}
 */
Cesium.TileDiscardPolicy.prototype.shouldDiscardImage = function(image) {};


/**
 * @constructor
 */
Cesium.TilingScheme = function() {};


/**
 * @return {Cesium.Extent}
 */
Cesium.TilingScheme.prototype.getExtent = function() {};



/**
 * @constructor
 * @param {Cesium.Ellipsoid} ellipsoid
 */
Cesium.WebMercatorProjection = function(ellipsoid) {};


/**
 * @param {Cesium.Cartographic} cartographic
 * @return {Cesium.Cartesian3}
 */
Cesium.WebMercatorProjection.prototype.project = function(cartographic) {};


/**
 * @param {Cesium.Cartesian3} cartesian
 * @return {Cesium.Cartographic}
 */
Cesium.WebMercatorProjection.prototype.unproject = function(cartesian) {};



/**
 * @constructor
 * @extends {Cesium.TilingScheme}
 */
Cesium.WebMercatorTilingScheme = function() {};
