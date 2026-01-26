/*******************************************************************************
 * Introduction *
 * 
 *  1) Visualize the preprocessed GEDI Level-2 variables.
 * 
 * Last updated: 1/26/2026
 * 
 * Runtime: N/A
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

// Major working directories.
var wd_Main_Str = "projects/wisconsin-gedi/assets/";

// Study period.
var GEDIyears_List = [2019, 2020, 2021, 2022, 2024];

// Area of interest.
var AOI_Geom = ENA_mod.WI_AOI_Geom;


/*******************************************************************************
 * Functions *
 ******************************************************************************/

// N/A.


/*******************************************************************************
 * Datasets *
 ******************************************************************************/

// Study area geometry.
var studyArea_Geom = ee.Feature(ee.FeatureCollection(
  wd_Main_Str + "Study_Domain/StudyArea_Wisconsin"
).first()).geometry();

// Load the annual L2A Images.
var L2A_IC = ee.ImageCollection.fromImages(
  GEDIyears_List.map(function(GEDIyear_Num) {
    
    var L2A_Img = ee.Image(
      wd_Main_Str
        + "Annual_MedianGEDI/L2A/"
        + "L2A_"
        + GEDIyear_Num
    );
    
    return L2A_Img;
  })
);

print(
  "L2A_IC:",
  L2A_IC,
  L2A_IC.first().bandNames(),
  L2A_IC.first().projection(),
  L2A_IC.first().projection().nominalScale()
);

// Load the annual L2B Images.
var L2B_IC = ee.ImageCollection.fromImages(
  GEDIyears_List.map(function(GEDIyear_Num) {
    
    var L2B_Img = ee.Image(
      wd_Main_Str
        + "Annual_MedianGEDI/L2B/"
        + "L2B_"
        + GEDIyear_Num
    );
    
    return L2B_Img;
  })
);

print(
  "L2B_IC:",
  L2B_IC,
  L2B_IC.first().bandNames(),
  L2B_IC.first().projection(),
  L2B_IC.first().projection().nominalScale()
);


/*******************************************************************************
 * Visualization *
 ******************************************************************************/

Map.setOptions("Satellite");
Map.centerObject(AOI_Geom, 12);

Map.addLayer(AOI_Geom, 
  {
    color: "808080"
  }, 
  "AOI_Geom");

Map.addLayer(studyArea_Geom, 
  {
    color: "FFFFFF"
  }, 
  "studyArea_Geom");

GEDIyears_List.forEach(function(GEDIyear_Num) {
  
  // L2A variables.
  var L2A_ID_Str = wd_Main_Str
    + "Annual_MedianGEDI/L2A/"
    + "L2A_"
    + GEDIyear_Num;
  
  var L2A_Img = ee.Image(L2A_ID_Str);
  
  var bandName_Str = "rh98";
  
  Map.addLayer(
    L2A_Img.select(bandName_Str),
    {
      min: 0,
      max: 35,
      palette: "FFFFFF, 0000FF"
    },
    bandName_Str + "_" + L2A_ID_Str.split("/").slice(-1)[0], // Layer name = last part.
    true
  );
  
  // bandName_Str = "num_detectedmodes";
  
  // Map.addLayer(
  //   L2A_Img.select(bandName_Str),
  //   {
  //     min: 1,
  //     max: 5,
  //     palette: "0000FF, FFFFFF, FF0000"
  //   },
  //   bandName_Str + "_" + L2A_ID_Str.split("/").slice(-1)[0] // Layer name = last part.
  // );
  
  // L2B variables.
  var L2B_ID_Str = wd_Main_Str
    + "Annual_MedianGEDI/L2B/"
    + "L2B_"
    + GEDIyear_Num;
  
  var L2B_Img = ee.Image(L2B_ID_Str);
  
  bandName_Str = "pavd_0_10";
  
  Map.addLayer(
    L2B_Img.select(bandName_Str),
    {
      min: 0,
      max: 0.2,
      palette: "FFFFFF, FF0000"
    },
    bandName_Str + "_" + L2B_ID_Str.split("/").slice(-1)[0], // Layer name = last part.
    true
  );
});

