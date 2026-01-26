/*******************************************************************************
 * Introduction *
 * 
 *   1) Extract the State of Wisconsin based on US Census data.
 * 
 *   2) Derive a rectangular AOI.
 * 
 * Last updated: 1/25/2026
 * 
 * Runtime: 1m
 * 
 * Author: Chenyang Wei (chenyangwei.cwei@gmail.com)
 ******************************************************************************/


/*******************************************************************************
 * Modules *
 ******************************************************************************/

var ENA_mod = require(
  "users/ChenyangWei/Public:Modules/LiDAR-Birds/Eastern_North_America.js");


/*******************************************************************************
 * Objects *
 ******************************************************************************/

// N/A.


/*******************************************************************************
 * Functions *
 ******************************************************************************/

// N/A.


/*******************************************************************************
 * Datasets *
 ******************************************************************************/

// TIGER: US Census States 2018.
var US_States_FC = ee.FeatureCollection("TIGER/2018/States");


/*******************************************************************************
 * 1) Study area and AOI determination. *
 ******************************************************************************/

// Extract the State of Wisconsin.
var Wisconsin_FC = US_States_FC.filter(
  ee.Filter.eq({
    name: "NAME",
    value: "Wisconsin"
  })
);

// Derive a rectangular AOI.
var AOI_Geom = Wisconsin_FC.bounds();

// Load the saved AOI.
var WI_AOI_Geom = ENA_mod.WI_AOI_Geom;


/*******************************************************************************
 * Results *
 ******************************************************************************/

// Whether to export the result(s).
var export_Bool = true; // true/false.

if (!export_Bool) {
  
  /****** Check the dataset(s) and object(s). ******/
  
  print(
    "US_States_FC:",
    US_States_FC.first(),
    US_States_FC.aggregate_array("NAME").distinct(),
    "Wisconsin_FC:",
    Wisconsin_FC.size(),
    "AOI_Geom:",
    AOI_Geom
  );
  
  // Visualization.
  Map.setOptions("Satellite");
  Map.setCenter(-89.178, 44.418, 7);
  
  Map.addLayer(WI_AOI_Geom, 
    {
      color: "0000FF"
    }, 
    "WI_AOI_Geom");
  
  Map.addLayer(AOI_Geom, 
    {
      color: "FFFFFF"
    }, 
    "AOI_Geom");
  
  Map.addLayer(Wisconsin_FC, 
    {
      color: "FF0000"
    }, 
    "Wisconsin_FC");

} else {
  
  /****** Export the result(s). ******/
  
  //// Output to Asset.
  
  var outputName_Str = "StudyArea_Wisconsin";
  
  // Feature Collection.
  Export.table.toAsset({
    collection: Wisconsin_FC, 
    description: outputName_Str, 
    assetId: "projects/wisconsin-gedi/assets/"
      + "Study_Domain/"
      + outputName_Str
  });
}

