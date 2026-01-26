/*******************************************************************************
 * Introduction *
 * 
 *  1) Derive GEDI Level-2A variables.
 * 
 * Last updated: 1/25/2026
 * 
 * Runtime: 16m ~ 31m
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

// Growing season.
var startMonth_Num = 5;
var endMonth_Num = 9;

// L2A bands of interest.
var bandNames_List = ["num_detectedmodes", "rh98"];

// Area of interest.
var AOI_Geom = ENA_mod.WI_AOI_Geom;


/*******************************************************************************
 * Functions *
 ******************************************************************************/

// Mask GEDI Level-2A data.
var Mask_L2A = function(L2A_Img) {
  
  var qualityMask_Img = L2A_Img.select("quality_flag")
    .eq(1);
  
  var degradeMask_Img = L2A_Img.select("degrade_flag")
    .eq(0);
  
  // Valid elevation measurement.
  var elevationBiasMask_Img = L2A_Img.select("elevation_bias_flag")
    .eq(0);
  
  // Use GEDI data acquired at night.
  var solarMask_Img = L2A_Img.select("solar_elevation")
    .lt(0);
  
  // High penetration sensitivity.
  var sensitivity_Img = L2A_Img.select("sensitivity");
  
  var sensitivityMask_Img = sensitivity_Img
    .gt(0.95)
    .and(sensitivity_Img.lte(1));
  
  // Full-power beams.
  var beamID_Img = L2A_Img.select("beam");
  
  var fullPowerMask_Img = beamID_Img.eq(5)
    .or(beamID_Img.eq(6))
    .or(beamID_Img.eq(8))
    .or(beamID_Img.eq(11));
  
  // "Leaf-on" vegetation observations.
  var leafOnMask_Img = L2A_Img.select("leaf_off_flag")
    .eq(0);
  
  // Land cover information.
  var urbanMask_Img = L2A_Img.select("urban_proportion")
    .lt(50);
  
  var waterMask_Img = L2A_Img.select("landsat_water_persistence")
    .lt(10);
  
  // Ground surface elevation.
  var surfaceMask_Img = L2A_Img.select("surface_flag")
    .eq(1);
  
  // Lowest mode elevation.
  var lowestModeElv_Img = L2A_Img.select("elev_lowestmode");
  
  var lowestModeMask_Img = lowestModeElv_Img.gt(-200)
    .and(lowestModeElv_Img.lt(9000));
  
  // Highest relative height.
  var rh100_Img = L2A_Img.select("rh100");
  
  var rh100Mask_Img = rh100_Img.gte(0)
    .and(rh100_Img.lt(120));
  
  return L2A_Img.updateMask(qualityMask_Img)
    .updateMask(degradeMask_Img)
    .updateMask(elevationBiasMask_Img)
    .updateMask(solarMask_Img)
    .updateMask(sensitivityMask_Img)
    .updateMask(fullPowerMask_Img)
    .updateMask(leafOnMask_Img)
    .updateMask(urbanMask_Img)
    .updateMask(waterMask_Img)
    .updateMask(surfaceMask_Img)
    .updateMask(lowestModeMask_Img)
    .updateMask(rh100Mask_Img);
};

// Calculate the temporal median variables for each year.
var Calculate_AnnualMedian = function(year_Num) {
  
  // Temporal filtering.
  var annualGEDI_IC = preprocessedL2A_IC.filter(
    ee.Filter.calendarRange({
      start: year_Num,
      field: "year"
    })
  );
  
  // Median calculation.
  var annualMedian_Img = annualGEDI_IC
    .median()
    .setDefaultProjection(GEDIprojection_Prj)
    .clip(studyArea_Geom)
    .toFloat()
    .set({
      Year: year_Num
    });
  
  return annualMedian_Img;
};


/*******************************************************************************
 * Datasets *
 ******************************************************************************/

// Study area geometry.
var studyArea_Geom = ee.Feature(ee.FeatureCollection(
  wd_Main_Str + "Study_Domain/StudyArea_Wisconsin"
).first()).geometry();

// GEDI Level-2A data located within the AOI and
//   collected during the growing season.
var growingSeason_AOI_Filter = ee.Filter.and(
  ee.Filter.bounds(AOI_Geom),
  ee.Filter.calendarRange({
    start: startMonth_Num, 
    end: endMonth_Num, 
    field: "month"
  })
);

var L2A_IC = ee.ImageCollection("LARSE/GEDI/GEDI02_A_002_MONTHLY")
  .filter(growingSeason_AOI_Filter);


/*******************************************************************************
 * 1) Derive GEDI Level-2A variables. *
 ******************************************************************************/

// GEDI data preprocessing.
var preprocessedL2A_IC = L2A_IC
  .map(Mask_L2A)
  .select(bandNames_List);

// Extract the projection of the first GEDI Image.
var GEDIprojection_Prj = preprocessedL2A_IC.first()
  .projection();


/*******************************************************************************
 * Results *
 ******************************************************************************/

var output = true; // true OR false.

if (!output) {
  
  // Check the object(s).
  print(
    "GEDIprojection_Prj:",
    GEDIprojection_Prj
  );
  
  // Visualization.
  Map.setOptions("Satellite");
  Map.centerObject(AOI_Geom, 8);
  
  Map.addLayer(AOI_Geom, 
    {
      color: "FFFFFF"
    }, 
    "AOI_Geom");

  Map.addLayer(studyArea_Geom, 
    {
      color: "FFFFFF"
    }, 
    "studyArea_Geom");

  Map.addLayer(preprocessedL2A_IC, 
    {
      bands: ["rh98"],
      min: 1,
      max: 30,
      palette: ["0000FF", "FFFFFF", "FF0000"]
    }, 
    "rh98");

} else {
  
  // Output to Asset.
  var fileName_Str = "L2A_";
  
  var GEDIprojection_PrjInfo = GEDIprojection_Prj.getInfo();
  
  GEDIyears_List.forEach(function(GEDIyear_Num) {
    
    var annualGEDImedian_Img = Calculate_AnnualMedian(GEDIyear_Num);
  
    Export.image.toAsset({
      image: annualGEDImedian_Img, 
      description: fileName_Str + GEDIyear_Num, 
      assetId: wd_Main_Str
        + "Annual_MedianGEDI/"
        + fileName_Str
        + GEDIyear_Num, 
      region: AOI_Geom, 
      crs: GEDIprojection_PrjInfo.crs,
      crsTransform: GEDIprojection_PrjInfo.transform,
      maxPixels: 1e13
    });
  });
}

