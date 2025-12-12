/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var samplePt_Geom = /* color: #d63000 */ee.Geometry.Point([-90.32817085096892, 45.62472786808235]);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
/*******************************************************************************
 * Introduction *
 * 
 *  1) Extract GEDI tracks within Wisconsin.
 * 
 * Last updated: 12/12/2025
 * 
 * Runtime: N/A
 * 
 * Author: Chenyang Wei (chenyangwei.cwei@gmail.com)
 ******************************************************************************/


/*******************************************************************************
 * Modules *
 ******************************************************************************/

// var PAL_mod = require(
//   "users/gena/packages:palettes");

// var IMG_mod = require(
//   "users/ChenyangWei/Public:Modules/General/Image_Analysis&Processing.js");


/*******************************************************************************
 * Objects *
 ******************************************************************************/


/*******************************************************************************
 * Functions *
 ******************************************************************************/

// N/A.


/*******************************************************************************
 * Datasets *
 ******************************************************************************/

// US census states 2018.
var US_states_FC = ee.FeatureCollection("TIGER/2018/States");

// GEDI L2B tracks.
var L2B_tracks_FC = ee.FeatureCollection("LARSE/GEDI/GEDI02_B_002_INDEX");


/*******************************************************************************
 * 1) Operation #1 *
 ******************************************************************************/

// Retrieve the boundary of Wisconsin.
var Wisconsin_Geom = US_states_FC.filter(
  ee.Filter.eq({
    name: "NAME",
    value: "Wisconsin"
  })
).first().geometry().geometries().get(2);

Wisconsin_Geom = ee.Geometry(Wisconsin_Geom);

// Derive the bounding box of Wisconsin.
var WI_BBox_Geom = Wisconsin_Geom.bounds();

// Extract the GEDI tracks intersecting Wisconsin.
var WI_tracks_FC = L2B_tracks_FC
  .filterBounds(Wisconsin_Geom)
  .map(function IntersectWI(track_Ftr) {
    return track_Ftr.intersection(Wisconsin_Geom);
  });


/*******************************************************************************
 * Results *
 ******************************************************************************/

// Whether to export the result(s).
var export_Bool = false; // true/false.

if (!export_Bool) {
  
  /****** Check the dataset(s) and object(s). ******/
  
  print("US_states_FC:",
    US_states_FC.aggregate_array({
      property: "NAME"
    })
  );
  
  print("Wisconsin_Geom:", Wisconsin_Geom);
  print("WI_tracks_FC:", 
    WI_tracks_FC.first(), 
    WI_tracks_FC.size()); // 1732.
  
  // Visualization.
  Map.setOptions("Satellite");
  // Map.centerObject(WI_BBox_Geom, 8);
  Map.centerObject(samplePt_Geom, 8);
  
  Map.addLayer(WI_BBox_Geom, 
    {
      color: "FFFFFF"
    }, 
    "WI_BBox_Geom");

  Map.addLayer(Wisconsin_Geom, 
    {
      color: "FF0000"
    }, 
    "Wisconsin_Geom");

  Map.addLayer(WI_tracks_FC.limit(10), 
    {
      color: "00FFFF"
    }, 
    "WI_tracks_FC");

  Map.addLayer(samplePt_Geom.buffer(2.1e3), 
    {
      color: "0000FF"
    }, 
    "samplePt_Geom");

} else {
  
  /****** Export the result(s). ******/
  
  //// Output to Drive.
  
  var outputName_Str = "GEDI_L2Btracks_Wisconsin";
  
  // Feature Collection.
  Export.table.toDrive({
    collection: WI_tracks_FC, 
    description: outputName_Str, 
    folder: outputName_Str, 
    fileFormat: "SHP"
  });
}