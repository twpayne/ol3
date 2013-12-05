/**
 * @externs
 * @see https://github.com/bjornharrtell/jsts
 */


/**
 * @type {Object}
 */
var jsts = {};


/**
 * @type {Object}
 */
jsts.geom;


/**
 * @constructor
 * @param {jsts.geom.Coordinate|null|number|string|undefined} x
 * @param {null|number|string|undefined} opt_y
 */
jsts.geom.Coordinate = function(x, opt_y) {};


/**
 * @type {number}
 */
jsts.geom.Coordinate.prototype.x;


/**
 * @type {number}
 */
jsts.geom.Coordinate.prototype.y;


/**
 * @constructor
 * @param {jsts.geom.GeometryFactory} geometryFactory
 */
jsts.geom.Geometry = function(geometryFactory) {};


/**
 * @return {string}
 */
jsts.geom.Geometry.prototype.getGeometryType = function() {};



/**
 * @constructor
 */
jsts.geom.GeometryFactory = function() {};


/**
 * @param {Array.<jsts.geom.Coordinate>} coordinates
 * @return {jsts.geom.MultiPoint}
 */
jsts.geom.GeometryFactory.prototype.createMultiPoint = function(coordinates) {};
